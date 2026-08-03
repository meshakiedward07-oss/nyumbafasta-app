import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// ── Types ─────────────────────────────────────────────────────────────────────

export type KPIStatus = 'good' | 'warning' | 'critical' | 'neutral'
export type DeptStatus = 'good' | 'warning' | 'critical'

export interface KPIItem {
  label:   string
  value:   number
  display: string   // pre-formatted string
  unit:    string
  target:  string
  status:  KPIStatus
}

export interface SopSummary {
  slug:              string
  title:             string
  last_reviewed_at:  string | null
  is_overdue:        boolean
  acknowledged_count: number
}

export interface DepartmentScorecard {
  department:   string
  owner_role:   string
  icon:         string
  overall:      DeptStatus
  score:        number
  kpis:         KPIItem[]
  sop:          SopSummary | null
  open_alerts:  number
  generated_at: string
}

export interface ScorecardReport {
  generated_at: string
  departments:  DepartmentScorecard[]
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function kpiStatus(
  value: number,
  goodThreshold: number,
  warningThreshold: number,
  lowerIsBetter = true,
): KPIStatus {
  if (lowerIsBetter) {
    if (value <= goodThreshold)    return 'good'
    if (value <= warningThreshold) return 'warning'
    return 'critical'
  }
  if (value >= goodThreshold)    return 'good'
  if (value >= warningThreshold) return 'warning'
  return 'critical'
}

function scoreFromKPIs(kpis: KPIItem[]): number {
  const scoreable = kpis.filter(k => k.status !== 'neutral')
  if (scoreable.length === 0) return 100
  const points = scoreable.reduce((sum, k) => {
    if (k.status === 'good')    return sum + 100
    if (k.status === 'warning') return sum + 50
    return sum
  }, 0)
  return Math.round(points / scoreable.length)
}

function overallFromScore(score: number): DeptStatus {
  if (score >= 80) return 'good'
  if (score >= 50) return 'warning'
  return 'critical'
}

function fmtHours(h: number): string {
  if (h === 0)   return '0'
  if (h < 1)     return `${Math.round(h * 60)}dk`
  if (h < 24)    return `${h.toFixed(1)}saa`
  return `${(h / 24).toFixed(1)}siku`
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `Tsh ${(n / 1_000).toFixed(0)}k`
  return `Tsh ${n}`
}

// ── Safe count helper ─────────────────────────────────────────────────────────

async function sc(q: () => PromiseLike<{ count: number | null }>): Promise<number> {
  try { const r = await q(); return r.count ?? 0 } catch { return 0 }
}

// ── Per-department KPI builders ───────────────────────────────────────────────

async function adminKPIs(): Promise<KPIItem[]> {
  const [kycCount, listingCount] = await Promise.all([
    sc(() => supabaseAdmin.from('dalali_profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending')),
    sc(() => supabaseAdmin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
  ])

  const [kycOldestHours, listingOldestHours] = await Promise.all([
    (async () => {
      if (kycCount === 0) return 0
      const { data } = await supabaseAdmin.from('dalali_profiles').select('created_at').eq('verification_status', 'pending').order('created_at', { ascending: true }).limit(1)
      if (!data?.length) return 0
      return (Date.now() - new Date(data[0].created_at).getTime()) / 3_600_000
    })(),
    (async () => {
      if (listingCount === 0) return 0
      const { data } = await supabaseAdmin.from('listings').select('created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(1)
      if (!data?.length) return 0
      return (Date.now() - new Date(data[0].created_at).getTime()) / 3_600_000
    })(),
  ])

  return [
    {
      label: 'KYC Zinasubiri', value: kycCount, display: String(kycCount), unit: 'dalali',
      target: '≤ 5', status: kpiStatus(kycCount, 5, 20),
    },
    {
      label: 'KYC Kongwe Zaidi', value: kycOldestHours, display: kycCount === 0 ? '—' : fmtHours(kycOldestHours), unit: '',
      target: '≤ 24saa', status: kycCount === 0 ? 'good' : kpiStatus(kycOldestHours, 24, 48),
    },
    {
      label: 'Orodha Zinasubiri', value: listingCount, display: String(listingCount), unit: 'orodha',
      target: '≤ 10', status: kpiStatus(listingCount, 10, 30),
    },
    {
      label: 'Orodha Kongwe Zaidi', value: listingOldestHours, display: listingCount === 0 ? '—' : fmtHours(listingOldestHours), unit: '',
      target: '≤ 48saa', status: listingCount === 0 ? 'good' : kpiStatus(listingOldestHours, 48, 96),
    },
  ]
}

interface RawEvent {
  severity: string
  status: string
  metric: string
  created_at: string
  resolved_at: string | null
}

function supportKPIs(allEvents: RawEvent[]): KPIItem[] {
  const openEvents = allEvents.filter(e => e.status === 'open')
  const critical   = openEvents.filter(e => e.severity === 'critical').length

  const resolutionMs = allEvents
    .filter(e => e.status === 'resolved' && e.resolved_at)
    .map(e => new Date(e.resolved_at!).getTime() - new Date(e.created_at).getTime())
  const avgHours = resolutionMs.length > 0
    ? resolutionMs.reduce((a, b) => a + b, 0) / resolutionMs.length / 3_600_000
    : null

  return [
    {
      label: 'Tahadhari Wazi', value: openEvents.length, display: String(openEvents.length), unit: '',
      target: '0', status: kpiStatus(openEvents.length, 0, 5),
    },
    {
      label: 'Tahadhari Muhimu', value: critical, display: String(critical), unit: '',
      target: '0', status: kpiStatus(critical, 0, 1),
    },
    {
      label: 'Muda wa Kutatua', value: avgHours ?? 0, display: avgHours !== null ? fmtHours(avgHours) : '—', unit: '',
      target: '≤ 4saa', status: avgHours === null ? 'neutral' : kpiStatus(avgHours, 4, 12),
    },
  ]
}

async function salesKPIs(): Promise<KPIItem[]> {
  const since7d   = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const cutoff48h = new Date(Date.now() - 48 * 3_600_000).toISOString()

  const [newDalali, newSubs] = await Promise.all([
    sc(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'dalali').gte('created_at', since7d)),
    sc(() => supabaseAdmin.from('subscriptions').select('id', { count: 'exact', head: true }).gte('created_at', since7d)),
  ])

  const { data: oldDalali } = await supabaseAdmin.from('users').select('id').eq('role', 'dalali').lt('created_at', cutoff48h)
  let noListing = 0
  if (oldDalali && oldDalali.length > 0) {
    const ids = oldDalali.map(u => u.id)
    const { data: withListings } = await supabaseAdmin.from('listings').select('dalali_id').in('dalali_id', ids).neq('status', 'deleted')
    const withSet = new Set((withListings ?? []).map(l => l.dalali_id))
    noListing = ids.filter(id => !withSet.has(id)).length
  }

  return [
    {
      label: 'Madalali Wapya (7d)', value: newDalali, display: String(newDalali), unit: 'dalali',
      target: '—', status: 'neutral',
    },
    {
      label: 'Bila Orodha (>48h)', value: noListing, display: String(noListing), unit: 'dalali',
      target: '0', status: kpiStatus(noListing, 0, 3),
    },
    {
      label: 'Usajili Wapya (7d)', value: newSubs, display: String(newSubs), unit: 'usajili',
      target: '—', status: 'neutral',
    },
  ]
}

async function financeKPIs(): Promise<KPIItem[]> {
  const since1h = new Date(Date.now() - 3_600_000).toISOString()
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [payFails, activeSubs, unlocks7d] = await Promise.all([
    sc(() => supabaseAdmin.from('contact_unlocks').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since1h)),
    sc(() => supabaseAdmin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    sc(() => supabaseAdmin.from('contact_unlocks').select('id', { count: 'exact', head: true }).not('status', 'eq', 'failed').gte('created_at', since7d)),
  ])

  return [
    {
      label: 'Makosa ya Malipo (1h)', value: payFails, display: String(payFails), unit: '',
      target: '0', status: kpiStatus(payFails, 0, 3),
    },
    {
      label: 'Mapato Kufungua (7d)', value: unlocks7d * 2000, display: fmtMoney(unlocks7d * 2000), unit: '',
      target: '—', status: 'neutral',
    },
    {
      label: 'Usajili Amilifu', value: activeSubs, display: String(activeSubs), unit: 'usajili',
      target: '—', status: 'neutral',
    },
  ]
}

async function marketingKPIs(): Promise<KPIItem[]> {
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const [newClients, newDalali, activeListings] = await Promise.all([
    sc(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'client').gte('created_at', since7d)),
    sc(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'dalali').gte('created_at', since7d)),
    sc(() => supabaseAdmin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('is_sub_suspended', false)),
  ])

  return [
    {
      label: 'Wateja Wapya (7d)', value: newClients, display: String(newClients), unit: 'wateja',
      target: '—', status: 'neutral',
    },
    {
      label: 'Madalali Wapya (7d)', value: newDalali, display: String(newDalali), unit: 'dalali',
      target: '—', status: 'neutral',
    },
    {
      label: 'Orodha Amilifu', value: activeListings, display: String(activeListings), unit: 'orodha',
      target: '≥ 100', status: kpiStatus(activeListings, 100, 50, false),
    },
  ]
}

// ── SOP lookup ────────────────────────────────────────────────────────────────

const OVERDUE_DAYS: Record<string, number> = {
  weekly: 7, monthly: 30, quarterly: 90, biannual: 180, annually: 365,
}

async function sopForRole(ownerRole: string): Promise<SopSummary | null> {
  const { data } = await supabaseAdmin
    .from('knowledge_base')
    .select('id, slug, title, review_frequency, last_reviewed_at')
    .eq('audience', 'internal')
    .eq('is_active', true)
    .eq('owner_role', ownerRole)
    .limit(1)
    .maybeSingle()

  if (!data) return null

  let is_overdue = false
  if (data.review_frequency) {
    if (!data.last_reviewed_at) {
      is_overdue = true
    } else {
      const days = OVERDUE_DAYS[data.review_frequency] ?? 30
      is_overdue = Date.now() - new Date(data.last_reviewed_at).getTime() > days * 86_400_000
    }
  }

  // Count how many staff have acknowledged this SOP (gracefully returns 0 if table missing)
  let acknowledged_count = 0
  try {
    const { count } = await supabaseAdmin
      .from('sop_acknowledgements')
      .select('id', { count: 'exact', head: true })
      .eq('sop_id', data.id)
    acknowledged_count = count ?? 0
  } catch { /* table not yet created */ }

  return {
    slug:              data.slug,
    title:             data.title,
    last_reviewed_at:  data.last_reviewed_at ?? null,
    is_overdue,
    acknowledged_count,
  }
}

// ── Alert-to-department mapping ───────────────────────────────────────────────

const METRIC_DEPT: Record<string, string> = {
  kyc_pending_count:         'admin',
  kyc_pending_hours:         'admin',
  listings_pending_count:    'admin',
  listings_pending_hours:    'admin',
  payment_failures_1h:       'finance',
  new_dalali_no_listing_48h: 'sales',
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function generateScorecards(): Promise<ScorecardReport> {
  const generated_at = new Date().toISOString()

  // Fetch recent alert events once
  const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: rawEvents } = await supabaseAdmin
    .from('alert_events')
    .select('severity, status, metric, created_at, resolved_at')
    .gte('created_at', since30d)

  const allEvents: RawEvent[] = rawEvents ?? []

  // Count open alerts per department
  const openByDept: Record<string, number> = {}
  for (const e of allEvents.filter(ev => ev.status === 'open')) {
    const dept = METRIC_DEPT[e.metric]
    if (dept) openByDept[dept] = (openByDept[dept] ?? 0) + 1
  }

  // Run KPI fetches + SOP lookups in parallel
  const [
    aKPIs, sKPIs, slKPIs, fKPIs, mKPIs,
    adminSOP, staffSOP, salesSOP, financeSOP, marketingSOP,
  ] = await Promise.all([
    adminKPIs(),
    Promise.resolve(supportKPIs(allEvents)),
    salesKPIs(),
    financeKPIs(),
    marketingKPIs(),
    sopForRole('admin'),
    sopForRole('staff'),
    sopForRole('sales'),
    sopForRole('finance'),
    sopForRole('marketing'),
  ])

  const allOpenCount = allEvents.filter(e => e.status === 'open').length

  const build = (
    department: string,
    owner_role: string,
    icon:       string,
    kpis:       KPIItem[],
    sop:        SopSummary | null,
    open_alerts: number,
  ): DepartmentScorecard => {
    const score   = scoreFromKPIs(kpis)
    const overall = overallFromScore(score)
    return { department, owner_role, icon, overall, score, kpis, sop, open_alerts, generated_at }
  }

  return {
    generated_at,
    departments: [
      build('Uthibitisho', 'admin',     'shield-check',   aKPIs,  adminSOP,     openByDept.admin     ?? 0),
      build('Msaada',      'staff',     'headset',        sKPIs,  staffSOP,     allOpenCount),
      build('Mauzo',       'sales',     'trending-up',    slKPIs, salesSOP,     openByDept.sales     ?? 0),
      build('Fedha',       'finance',   'coin',           fKPIs,  financeSOP,   openByDept.finance   ?? 0),
      build('Masoko',      'marketing', 'speakerphone',   mKPIs,  marketingSOP, openByDept.marketing ?? 0),
    ],
  }
}
