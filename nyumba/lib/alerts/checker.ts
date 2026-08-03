import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlertThreshold {
  id:              string
  metric:          string
  display_name:    string
  description:     string | null
  operator:        'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  threshold_value: number
  severity:        'info' | 'warning' | 'critical'
  sop_id:          string | null
  is_active:       boolean
  created_at:      string
  updated_at:      string
}

export interface AlertEvent {
  id:              string
  threshold_id:    string
  metric:          string
  display_name:    string
  current_value:   number
  threshold_value: number
  severity:        'info' | 'warning' | 'critical'
  sop_id:          string | null
  status:          'open' | 'acknowledged' | 'resolved'
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_at:     string | null
  notes:           string | null
  created_at:      string
}

export interface MetricResult {
  metric:          string
  display_name:    string
  description:     string | null
  current_value:   number
  threshold_value: number
  operator:        string
  triggered:       boolean
  severity:        'info' | 'warning' | 'critical'
  threshold_id:    string
  sop_id:          string | null
}

export interface CheckResult {
  ran_at:   string
  metrics:  MetricResult[]
  fired:    number   // new alert_events created
  existing: number   // already-open alerts skipped
}

// ── Metric comparison ─────────────────────────────────────────────────────────

function compare(current: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'gt':  return current > threshold
    case 'lt':  return current < threshold
    case 'gte': return current >= threshold
    case 'lte': return current <= threshold
    case 'eq':  return current === threshold
    default:    return false
  }
}

// ── Individual metric fetchers ────────────────────────────────────────────────

async function getKycPendingCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('dalali_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('verification_status', 'pending')
  return count ?? 0
}

async function getKycPendingHours(): Promise<number> {
  const { data } = await supabaseAdmin
    .from('dalali_profiles')
    .select('created_at')
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
  if (!data || data.length === 0) return 0
  return (Date.now() - new Date(data[0].created_at).getTime()) / 3_600_000
}

async function getListingsPendingCount(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
}

async function getListingsPendingHours(): Promise<number> {
  const { data } = await supabaseAdmin
    .from('listings')
    .select('created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
  if (!data || data.length === 0) return 0
  return (Date.now() - new Date(data[0].created_at).getTime()) / 3_600_000
}

async function getPaymentFailures1h(): Promise<number> {
  try {
    const since = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await supabaseAdmin
      .from('contact_unlocks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', since)
    return count ?? 0
  } catch {
    return 0
  }
}

async function getNewDalaliNoListing48h(): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString()
  const { data: dalalis } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'dalali')
    .lt('created_at', cutoff)

  if (!dalalis || dalalis.length === 0) return 0

  const ids = dalalis.map(u => u.id)
  const { data: withListings } = await supabaseAdmin
    .from('listings')
    .select('dalali_id')
    .in('dalali_id', ids)
    .neq('status', 'deleted')

  const idsWithListings = new Set((withListings ?? []).map(l => l.dalali_id))
  return ids.filter(id => !idsWithListings.has(id)).length
}

// ── Metric registry ───────────────────────────────────────────────────────────
// Add new metrics here; the checker picks them up automatically.

const METRIC_FETCHERS: Record<string, () => Promise<number>> = {
  kyc_pending_count:        getKycPendingCount,
  kyc_pending_hours:        getKycPendingHours,
  listings_pending_count:   getListingsPendingCount,
  listings_pending_hours:   getListingsPendingHours,
  payment_failures_1h:      getPaymentFailures1h,
  new_dalali_no_listing_48h: getNewDalaliNoListing48h,
}

async function fetchCurrentValues(
  metrics: string[],
): Promise<Record<string, number>> {
  const needed = [...new Set(metrics)]
  const results = await Promise.allSettled(
    needed.map(async m => {
      const fn = METRIC_FETCHERS[m]
      const value = fn ? await fn() : 0
      return { m, value }
    })
  )
  const out: Record<string, number> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') out[r.value.m] = r.value.value
  }
  return out
}

// ── Main checker ──────────────────────────────────────────────────────────────
// Evaluates all active thresholds, fires new events for triggered ones,
// and auto-resolves events whose condition is no longer true.

export async function runAlertCheck(): Promise<CheckResult> {
  const ran_at = new Date().toISOString()

  // 1. Load active thresholds
  const { data: thresholds, error } = await supabaseAdmin
    .from('alert_thresholds')
    .select('*')
    .eq('is_active', true)

  if (error || !thresholds) {
    console.error('[Alerts] failed to load thresholds:', error?.message)
    return { ran_at, metrics: [], fired: 0, existing: 0 }
  }

  // 2. Fetch current values for all referenced metrics in one pass
  const currentValues = await fetchCurrentValues(thresholds.map(t => t.metric))

  // 3. Load open events so we know what's already firing
  const { data: openEvents } = await supabaseAdmin
    .from('alert_events')
    .select('id, threshold_id')
    .eq('status', 'open')

  const openByThreshold = new Set((openEvents ?? []).map(e => e.threshold_id))

  // 4. Evaluate each threshold
  const metrics: MetricResult[] = []
  let fired    = 0
  let existing = 0

  for (const t of thresholds) {
    const current   = currentValues[t.metric] ?? 0
    const triggered = compare(current, t.operator, t.threshold_value)

    metrics.push({
      metric:          t.metric,
      display_name:    t.display_name,
      description:     t.description ?? null,
      current_value:   current,
      threshold_value: t.threshold_value,
      operator:        t.operator,
      triggered,
      severity:        t.severity,
      threshold_id:    t.id,
      sop_id:          t.sop_id ?? null,
    })

    if (triggered) {
      if (openByThreshold.has(t.id)) {
        existing++
      } else {
        // Fire a new event
        const { error: insertErr } = await supabaseAdmin
          .from('alert_events')
          .insert({
            threshold_id:    t.id,
            metric:          t.metric,
            display_name:    t.display_name,
            current_value:   current,
            threshold_value: t.threshold_value,
            severity:        t.severity,
            sop_id:          t.sop_id ?? null,
            status:          'open',
          })
        if (!insertErr) fired++
        else console.error('[Alerts] insert event failed:', insertErr.message)
      }
    } else {
      // Auto-resolve open events that are no longer triggered
      const openForThis = (openEvents ?? []).filter(e => e.threshold_id === t.id)
      if (openForThis.length > 0) {
        await supabaseAdmin
          .from('alert_events')
          .update({ status: 'resolved', resolved_at: ran_at })
          .in('id', openForThis.map(e => e.id))
      }
    }
  }

  console.log(`[Alerts] check done — ${fired} new, ${existing} existing, ran_at=${ran_at}`)
  return { ran_at, metrics, fired, existing }
}
