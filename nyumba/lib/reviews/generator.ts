import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReviewPeriod = 'weekly' | 'monthly'

export interface ReviewReport {
  period:       ReviewPeriod
  period_start: string
  period_end:   string
  generated_at: string

  business: {
    new_clients:         number
    new_dalali:          number
    total_new_users:     number
    contact_unlocks:     number
    unlock_revenue_tshs: number
    new_subscriptions:   number
    new_listings:        number
    approved_listings:   number
    rejected_listings:   number
    active_listings:     number
  }

  operations: {
    kyc_submitted: number
    kyc_approved:  number
    kyc_rejected:  number
    kyc_pending:   number
  }

  alerts: {
    total_fired:          number
    critical:             number
    warning:              number
    info:                 number
    resolved:             number
    acknowledged:         number
    avg_resolution_hours: number | null
    most_common_metric:   string | null
  }

  sop_compliance: Array<{
    slug:             string
    title:            string
    owner_role:       string | null
    review_frequency: string | null
    last_reviewed_at: string | null
    is_overdue:       boolean
  }>

  // Previous period for trend comparison
  prev: {
    new_clients:     number
    new_dalali:      number
    contact_unlocks: number
    new_listings:    number
  }
}

// ── Period helpers ────────────────────────────────────────────────────────────

function periodBounds(period: ReviewPeriod, referenceDate: Date): { start: Date; end: Date } {
  const end   = new Date(referenceDate)
  const start = new Date(referenceDate)
  start.setDate(start.getDate() - (period === 'weekly' ? 7 : 30))
  return { start, end }
}

// ── Safe count helper ─────────────────────────────────────────────────────────
// Returns 0 instead of throwing if the query fails (e.g. column doesn't exist).
// Accepts PromiseLike so Supabase's PostgrestFilterBuilder (not a full Promise)
// is assignable without a type error.

async function safeCount(
  query: () => PromiseLike<{ count: number | null }>,
): Promise<number> {
  try {
    const result = await query()
    return result.count ?? 0
  } catch {
    return 0
  }
}

// ── Business metrics ──────────────────────────────────────────────────────────

async function getBusinessMetrics(start: string, end: string) {
  const [
    newClients,
    newDalali,
    contactUnlocks,
    newSubscriptions,
    newListings,
    approvedListings,
    rejectedListings,
    activeListings,
  ] = await Promise.all([
    safeCount(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
      .eq('role', 'client').gte('created_at', start).lte('created_at', end)),

    safeCount(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
      .eq('role', 'dalali').gte('created_at', start).lte('created_at', end)),

    safeCount(() => supabaseAdmin.from('contact_unlocks').select('id', { count: 'exact', head: true })
      .not('status', 'eq', 'failed').gte('created_at', start).lte('created_at', end)),

    safeCount(() => supabaseAdmin.from('subscriptions').select('id', { count: 'exact', head: true })
      .gte('created_at', start).lte('created_at', end)),

    safeCount(() => supabaseAdmin.from('listings').select('id', { count: 'exact', head: true })
      .gte('created_at', start).lte('created_at', end)),

    safeCount(() => supabaseAdmin.from('listings').select('id', { count: 'exact', head: true })
      .eq('status', 'active').gte('created_at', start).lte('created_at', end)),

    safeCount(() => supabaseAdmin.from('listings').select('id', { count: 'exact', head: true })
      .eq('status', 'rejected').gte('created_at', start).lte('created_at', end)),

    safeCount(() => supabaseAdmin.from('listings').select('id', { count: 'exact', head: true })
      .eq('status', 'active').eq('is_sub_suspended', false)),
  ])

  return {
    new_clients:         newClients,
    new_dalali:          newDalali,
    total_new_users:     newClients + newDalali,
    contact_unlocks:     contactUnlocks,
    unlock_revenue_tshs: contactUnlocks * 2000,
    new_subscriptions:   newSubscriptions,
    new_listings:        newListings,
    approved_listings:   approvedListings,
    rejected_listings:   rejectedListings,
    active_listings:     activeListings,
  }
}

// ── Operations metrics ────────────────────────────────────────────────────────

async function getOperationsMetrics(start: string, end: string) {
  const [submitted, approved, rejected, pending] = await Promise.all([
    safeCount(() => supabaseAdmin.from('dalali_profiles').select('id', { count: 'exact', head: true })
      .not('verification_status', 'eq', 'unverified').gte('created_at', start).lte('created_at', end)),

    safeCount(() => supabaseAdmin.from('dalali_profiles').select('id', { count: 'exact', head: true })
      .eq('verification_status', 'verified').gte('updated_at', start).lte('updated_at', end)),

    safeCount(() => supabaseAdmin.from('dalali_profiles').select('id', { count: 'exact', head: true })
      .eq('verification_status', 'rejected').gte('updated_at', start).lte('updated_at', end)),

    safeCount(() => supabaseAdmin.from('dalali_profiles').select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending')),
  ])

  return { kyc_submitted: submitted, kyc_approved: approved, kyc_rejected: rejected, kyc_pending: pending }
}

// ── Alert metrics ─────────────────────────────────────────────────────────────

async function getAlertMetrics(start: string, end: string) {
  const { data: events } = await supabaseAdmin
    .from('alert_events')
    .select('severity, status, created_at, resolved_at, metric')
    .gte('created_at', start)
    .lte('created_at', end)

  if (!events || events.length === 0) {
    return {
      total_fired: 0, critical: 0, warning: 0, info: 0,
      resolved: 0, acknowledged: 0,
      avg_resolution_hours: null, most_common_metric: null,
    }
  }

  const critical     = events.filter(e => e.severity === 'critical').length
  const warning      = events.filter(e => e.severity === 'warning').length
  const info         = events.filter(e => e.severity === 'info').length
  const resolved     = events.filter(e => e.status === 'resolved').length
  const acknowledged = events.filter(e => e.status === 'acknowledged').length

  // Average resolution time
  const resolutionTimes = events
    .filter(e => e.status === 'resolved' && e.resolved_at)
    .map(e => (new Date(e.resolved_at!).getTime() - new Date(e.created_at).getTime()) / 3_600_000)
  const avg_resolution_hours = resolutionTimes.length > 0
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
    : null

  // Most common metric
  const metricCounts: Record<string, number> = {}
  for (const e of events) metricCounts[e.metric] = (metricCounts[e.metric] ?? 0) + 1
  const most_common_metric = Object.entries(metricCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    total_fired: events.length, critical, warning, info,
    resolved, acknowledged, avg_resolution_hours, most_common_metric,
  }
}

// ── SOP compliance ────────────────────────────────────────────────────────────

const OVERDUE_DAYS: Record<string, number> = {
  weekly: 7, monthly: 30, quarterly: 90, biannual: 180, annually: 365,
}

async function getSopCompliance() {
  const { data: sops } = await supabaseAdmin
    .from('knowledge_base')
    .select('slug, title, owner_role, review_frequency, last_reviewed_at')
    .eq('audience', 'internal')
    .eq('is_active', true)
    .order('owner_role')

  const now = Date.now()
  return (sops ?? []).map(sop => {
    let is_overdue = false
    if (sop.review_frequency && sop.last_reviewed_at) {
      const days      = OVERDUE_DAYS[sop.review_frequency] ?? 30
      const threshold = days * 24 * 60 * 60 * 1000
      is_overdue      = now - new Date(sop.last_reviewed_at).getTime() > threshold
    } else if (sop.review_frequency && !sop.last_reviewed_at) {
      is_overdue = true // has a frequency set but never reviewed
    }
    return {
      slug:             sop.slug,
      title:            sop.title,
      owner_role:       sop.owner_role ?? null,
      review_frequency: sop.review_frequency ?? null,
      last_reviewed_at: sop.last_reviewed_at ?? null,
      is_overdue,
    }
  })
}

// ── Previous period (for trend arrows) ────────────────────────────────────────

async function getPrevMetrics(prevStart: string, prevEnd: string) {
  const [newClients, newDalali, contactUnlocks, newListings] = await Promise.all([
    safeCount(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
      .eq('role', 'client').gte('created_at', prevStart).lte('created_at', prevEnd)),
    safeCount(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
      .eq('role', 'dalali').gte('created_at', prevStart).lte('created_at', prevEnd)),
    safeCount(() => supabaseAdmin.from('contact_unlocks').select('id', { count: 'exact', head: true })
      .not('status', 'eq', 'failed').gte('created_at', prevStart).lte('created_at', prevEnd)),
    safeCount(() => supabaseAdmin.from('listings').select('id', { count: 'exact', head: true })
      .gte('created_at', prevStart).lte('created_at', prevEnd)),
  ])
  return { new_clients: newClients, new_dalali: newDalali, contact_unlocks: contactUnlocks, new_listings: newListings }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function generateReview(
  period: ReviewPeriod,
  referenceDate: Date = new Date(),
): Promise<ReviewReport> {
  const { start, end }           = periodBounds(period, referenceDate)
  const { start: prevStart, end: prevEnd } = periodBounds(period, new Date(start))

  const startIso    = start.toISOString()
  const endIso      = end.toISOString()
  const prevStartIso = prevStart.toISOString()
  const prevEndIso   = prevEnd.toISOString()

  const [business, operations, alerts, sopCompliance, prev] = await Promise.all([
    getBusinessMetrics(startIso, endIso),
    getOperationsMetrics(startIso, endIso),
    getAlertMetrics(startIso, endIso),
    getSopCompliance(),
    getPrevMetrics(prevStartIso, prevEndIso),
  ])

  return {
    period,
    period_start: startIso,
    period_end:   endIso,
    generated_at: new Date().toISOString(),
    business,
    operations,
    alerts,
    sop_compliance: sopCompliance,
    prev,
  }
}
