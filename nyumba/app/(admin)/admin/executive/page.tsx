'use client'
import { useState, useEffect, useCallback, useId } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type MetricFormat = 'tzs' | 'count' | 'percent'

interface CatalogEntry {
  key:    string
  label:  string
  format: MetricFormat
  link?:  string
  warn?:  boolean
}

interface CustomHeadline {
  id:         string
  metric_key: string
  label:      string
}

type Metrics = Record<string, number | null>

interface AnalyticsData {
  months:       Array<{ label: string; income: number; net: number }>
  thisMonth:    { income: number; expenses: number; net: number; growth: number }
  sources:      { subscription: number; unlock: number; boost: number; extra: number; other: number }
}

interface UsersData {
  total: number; clients: number; dalali: number; staff: number
  active: number; suspended: number; verified_dalali: number
}

interface RentData {
  active_leases: number; total_due_this_month: number; total_paid_this_month: number
  collection_rate: number; overdue_count: number; overdue_amount: number
  total_late_fees: number; pending_count: number
}

interface MaintData {
  open_count: number; urgent_count: number; high_count: number
  by_status:  Record<string, number>; total_actual_cost_this_month: number
}

interface BrokerageData {
  total_pipeline: number; deals_closed_this_month: number; pending_commissions: number
  pipeline_by_status: Record<string, number>; commission_by_status: Record<string, number>
}

// ── Metric catalog (all available values for custom headline picker) ──────────

const CATALOG: CatalogEntry[] = [
  { key: 'today_income',               label: 'Mapato ya Leo',                  format: 'tzs',     link: '/admin/accounting'           },
  { key: 'today_unlocks_count',        label: 'Mawasiliano Yaliyofunguliwa Leo', format: 'count',   link: '/admin/unlocks'              },
  { key: 'today_unlocks_revenue',      label: 'Mapato ya Mawasiliano Leo',       format: 'tzs',     link: '/admin/unlocks'              },
  { key: 'new_registrations_24h',      label: 'Usajili Mpya (masaa 24)',         format: 'count',   link: '/admin/users'                },
  { key: 'pending_listings',           label: 'Matangazo Yanayosubiri',          format: 'count',   link: '/admin/listings', warn: true },
  { key: 'active_dalali_subs',         label: 'Madalali Wenye Usajili Hai',      format: 'count',   link: '/admin/dalali-subscriptions' },
  { key: 'trial_dalali_subs',          label: 'Madalali Wanaojaribu (Trial)',    format: 'count',   link: '/admin/dalali-subscriptions' },
  { key: 'active_org_subs',            label: 'Mashirika Yenye Usajili Hai',     format: 'count',   link: '/admin/subscriptions'        },
  { key: 'total_users',                label: 'Jumla ya Watumiaji',              format: 'count',   link: '/admin/users'                },
  { key: 'total_clients',              label: 'Jumla ya Wateja',                 format: 'count',   link: '/admin/users'                },
  { key: 'total_dalali',               label: 'Jumla ya Madalali',               format: 'count',   link: '/admin/users'                },
  { key: 'active_listings',            label: 'Matangazo Hai',                   format: 'count',   link: '/admin/listings'             },
  { key: 'this_month_income',          label: 'Mapato ya Mwezi Huu',             format: 'tzs',     link: '/admin/accounting'           },
  { key: 'unresolved_fraud_high',      label: 'Ishara za Hatari (Fraud)',         format: 'count',   link: '/admin/fraud', warn: true    },
  { key: 'unresolved_fraud_critical',  label: 'Ishara Hatari Sana (Fraud)',       format: 'count',   link: '/admin/fraud', warn: true    },
  { key: 'pending_kyc',                label: 'KYC Zinazongoja',                 format: 'count',   link: '/admin'                      },
  { key: 'total_leads',                label: 'Jumla ya Leads',                  format: 'count',   link: '/admin/leads'                },
  { key: 'open_maintenance_requests',  label: 'Matengenezo Wazi',                format: 'count',   link: '/admin/property-management'  },
  { key: 'active_leases',              label: 'Upangaji Hai',                    format: 'count',   link: '/admin/property-management'  },
  { key: 'rent_collection_rate',       label: 'Ukusanyaji wa Kodi',              format: 'percent', link: '/admin/property-management'  },
  { key: 'brokerage_pending_commissions', label: 'Komisho Zinazongoja (Brokerage)', format: 'tzs', link: '/admin/property-management'  },
  { key: 'whatsapp_open_sessions',     label: 'Mazungumzo ya WhatsApp Wazi',     format: 'count',   link: '/admin/whatsapp'             },
  { key: 'cascade_miss_count_month',   label: 'Makosa ya Amina (Mwezi Huu)',      format: 'count',   link: '/admin/knowledge'            },
]

const CATALOG_MAP = Object.fromEntries(CATALOG.map(c => [c.key, c]))
const LS_KEY = 'nf_exec_custom_headlines'

// ── Fixed headline definitions ────────────────────────────────────────────────

const FIXED_HEADLINES = [
  'today_income',
  'today_unlocks_count',
  'today_unlocks_revenue',
  'new_registrations_24h',
  'pending_listings',
] as const

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtTzs(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `Tsh ${(n / 1_000).toFixed(0)}K`
  return `Tsh ${n.toLocaleString()}`
}
function fmtCount(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString()
}
function fmtPercent(n: number | null): string {
  if (n === null) return '—'
  return `${n.toFixed(1)}%`
}
function fmt(val: number | null, format: MetricFormat): string {
  if (format === 'tzs')     return fmtTzs(val)
  if (format === 'percent') return fmtPercent(val)
  return fmtCount(val)
}

// ── HeadlineCard ──────────────────────────────────────────────────────────────

function HeadlineCard({
  label, value, format, loading, link, warn = false, onRemove,
}: {
  label: string; value: number | null; format: MetricFormat
  loading: boolean; link?: string; warn?: boolean; onRemove?: () => void
}) {
  const displayed = fmt(value, format)
  const isAlert   = warn && typeof value === 'number' && value > 0

  const inner = (
    <div className={`relative bg-white rounded-2xl p-4 border transition group
      ${isAlert ? 'border-amber-300 bg-amber-50' : 'border-gray-100 hover:border-primary-200'}
    `}>
      {onRemove && (
        <button
          onClick={e => { e.preventDefault(); onRemove() }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-0.5 rounded-full hover:bg-red-100 text-gray-300 hover:text-red-500"
          aria-label="Ondoa"
        >
          <i className="ti ti-x text-xs" aria-hidden="true" />
        </button>
      )}
      {loading ? (
        <div className="animate-shimmer h-7 w-24 bg-gray-100 rounded mb-1" />
      ) : (
        <p className={`text-2xl font-bold tabular-nums leading-none ${isAlert ? 'text-amber-700' : 'text-gray-900'}`}>
          {displayed}
        </p>
      )}
      <p className={`text-xs mt-1.5 font-medium ${isAlert ? 'text-amber-600' : 'text-gray-400'}`}>
        {label}
      </p>
      {isAlert && <i className="ti ti-alert-triangle text-amber-400 absolute top-3 right-3 text-base" aria-hidden="true" />}
    </div>
  )

  if (link && !onRemove) return <Link href={link} className="block">{inner}</Link>
  return inner
}

// ── Shimmer section placeholder ───────────────────────────────────────────────

function SectionShimmer() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="animate-shimmer h-4 w-32 bg-gray-100 rounded" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-shimmer h-14 bg-gray-50 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ── Mini bar chart (Tailwind div-bar — same pattern as TakwimuTab) ─────────────

function MiniBar({ data }: { data: Array<{ label: string; value: number; current?: boolean }> }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const H = 56
  return (
    <div className="flex items-end gap-0.5 h-14">
      {data.map((d, i) => (
        <div key={i} className="group relative flex-1 flex flex-col items-center justify-end h-full">
          <div
            className={`w-full rounded-t transition-all ${d.current ? 'bg-primary-500' : 'bg-primary-100'}`}
            style={{ height: `${Math.max(3, Math.round((d.value / max) * H))}px` }}
          />
          {data.length <= 7 && (
            <span className="text-[9px] text-gray-400 mt-0.5 truncate w-full text-center leading-none">{d.label}</span>
          )}
          <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
            <div className="bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
              {d.label}: {fmtTzs(d.value)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatRow({ label, value, format = 'count', link }: { label: string; value: number | null; format?: MetricFormat; link?: string }) {
  const v = fmt(value, format)
  if (link) return (
    <Link href={link} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0 hover:text-primary-600 transition">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900 tabular-nums">{v}</span>
    </Link>
  )
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900 tabular-nums">{v}</span>
    </div>
  )
}

function HBar({ label, value, max, color = 'bg-primary-400' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Revenue Section ───────────────────────────────────────────────────────────

function RevenueSection() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/admin/analytics')
      .then(r => r.json())
      .then(j => {
        if (!j.revenueByMonth) return
        setData({
          months:    j.revenueByMonth ?? [],
          thisMonth: {
            income:   j.thisMonthIncome       ?? 0,
            expenses: j.expenses?.thisMonth   ?? 0,
            net:      j.expenses?.profit      ?? 0,
            growth:   j.growth                ?? 0,
          },
          sources: {
            subscription: j.totals?.subscription   ?? 0,
            unlock:       j.totals?.contact_unlock ?? 0,
            boost:        j.totals?.boost_listing  ?? 0,
            extra:        j.totals?.extra_listing  ?? 0,
            other:        0,
          },
        })
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SectionShimmer />

  const months     = (data?.months ?? []).slice(-12)
  const thisMonth  = data?.thisMonth
  const sources    = data?.sources ?? { subscription: 0, unlock: 0, boost: 0, extra: 0, other: 0 }
  const totalSrc   = (Object.values(sources) as number[]).reduce((s, v) => s + v, 0)

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Mapato</h2>
        <Link href="/admin/accounting" className="text-xs text-primary-600 hover:underline">Angalia zaidi →</Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-primary-50 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-gray-900 tabular-nums">{fmtTzs(thisMonth?.income ?? null)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Mapato Mwezi</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-gray-900 tabular-nums">{fmtTzs(thisMonth?.expenses ?? null)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Matumizi Mwezi</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${(thisMonth?.net ?? 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className={`text-lg font-bold tabular-nums ${(thisMonth?.net ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {fmtTzs(thisMonth?.net ?? null)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Faida Mwezi</p>
        </div>
      </div>

      {months.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-400 mb-2">Mapato (miezi 12)</p>
          <MiniBar data={months.map((m, i) => ({ label: m.label, value: m.income, current: i === months.length - 1 }))} />
        </div>
      )}

      {totalSrc > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Chanzo cha Mapato</p>
          <HBar label="Usajili"    value={sources.subscription ?? 0} max={totalSrc} color="bg-primary-500" />
          <HBar label="Mawasiliano" value={sources.unlock ?? 0}      max={totalSrc} color="bg-primary-300" />
          <HBar label="Boost"      value={sources.boost ?? 0}        max={totalSrc} color="bg-primary-200" />
          <HBar label="Nyingine"   value={sources.other ?? 0}        max={totalSrc} color="bg-gray-300"    />
        </div>
      )}
    </section>
  )
}

// ── Users Section ─────────────────────────────────────────────────────────────

function UsersSection({ metrics }: { metrics: Metrics | null }) {
  const [data,    setData]    = useState<UsersData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/admin/users/summary')
      .then(r => r.json()).then(setData).catch(() => null).finally(() => setLoading(false))
  }, [])

  if (loading) return <SectionShimmer />

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Watumiaji</h2>
        <Link href="/admin/users" className="text-xs text-primary-600 hover:underline">Angalia zaidi →</Link>
      </div>
      <StatRow label="Jumla ya Watumiaji"     value={data?.total           ?? null} link="/admin/users" />
      <StatRow label="Wateja"                  value={data?.clients         ?? null} />
      <StatRow label="Madalali"                value={data?.dalali          ?? null} link="/admin/dalali-subscriptions" />
      <StatRow label="Madalali Walioidhinishwa" value={data?.verified_dalali ?? null} link="/admin/verifications" />
      <StatRow label="KYC Zinazongoja"         value={metrics?.pending_kyc  ?? null} link="/admin" />
      {(data?.suspended ?? 0) > 0 && (
        <StatRow label="Waliozuiwa"  value={data?.suspended ?? null} link="/admin/users" />
      )}
    </section>
  )
}

// ── Property Section ──────────────────────────────────────────────────────────

function PropertySection() {
  const [rent,      setRent]      = useState<RentData | null>(null)
  const [maint,     setMaint]     = useState<MaintData | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/admin/rent-collection').then(r => r.json()),
      fetch('/api/v1/admin/maintenance-summary').then(r => r.json()),
    ]).then(([r, m]) => { setRent(r); setMaint(m) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SectionShimmer />

  const rate = rent?.collection_rate ?? 0
  const rateColor = rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-amber-600' : 'text-red-600'

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Mali & Kodi</h2>
        <Link href="/admin/property-management" className="text-xs text-primary-600 hover:underline">Angalia zaidi →</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xl font-bold text-gray-900 tabular-nums">{fmtCount(rent?.active_leases ?? null)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Upangaji Hai</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className={`text-xl font-bold tabular-nums ${rateColor}`}>{fmtPercent(rent?.collection_rate ?? null)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Ukusanyaji wa Kodi</p>
        </div>
      </div>

      {rent && (
        <div className="mb-4">
          <StatRow label="Kinachodaiwa Mwezi"    value={rent.total_due_this_month}  format="tzs" />
          <StatRow label="Kilicholipwa Mwezi"    value={rent.total_paid_this_month} format="tzs" />
          {rent.overdue_count > 0 && (
            <StatRow label={`Malipo ${rent.overdue_count} Yaliyochelewa`} value={rent.overdue_amount} format="tzs" />
          )}
        </div>
      )}

      {maint && (
        <div className="pt-3 border-t border-gray-50">
          <p className="text-xs text-gray-400 mb-2">Matengenezo</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-base font-bold text-gray-900 tabular-nums">{maint.open_count}</p>
              <p className="text-xs text-gray-400">Wazi</p>
            </div>
            <div className="text-center">
              <p className={`text-base font-bold tabular-nums ${maint.urgent_count > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {maint.urgent_count}
              </p>
              <p className="text-xs text-gray-400">Dharura</p>
            </div>
            <div className="text-center">
              <p className={`text-base font-bold tabular-nums ${maint.high_count > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {maint.high_count}
              </p>
              <p className="text-xs text-gray-400">Kipaumbele</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Brokerage Section ─────────────────────────────────────────────────────────

function BrokerageSection() {
  const [data,    setData]    = useState<BrokerageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/admin/brokerage-summary')
      .then(r => r.json()).then(setData).catch(() => null).finally(() => setLoading(false))
  }, [])

  if (loading) return <SectionShimmer />
  if (!data || data.total_pipeline === 0) return null

  const pipeline = data.pipeline_by_status

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">NF Brokerage</h2>
        <Link href="/admin/property-management" className="text-xs text-primary-600 hover:underline">Angalia zaidi →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xl font-bold text-gray-900 tabular-nums">{data.total_pipeline}</p>
          <p className="text-xs text-gray-500 mt-0.5">Mikataba Pipeline</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xl font-bold text-green-700 tabular-nums">{data.deals_closed_this_month}</p>
          <p className="text-xs text-gray-500 mt-0.5">Iliyofungwa Mwezi</p>
        </div>
      </div>
      {data.pending_commissions > 0 && (
        <StatRow label="Komisho Zinazongoja" value={data.pending_commissions} format="tzs" />
      )}
      <div className="mt-3">
        <p className="text-xs text-gray-400 mb-2">Pipeline</p>
        <HBar label="Wanasubiri"    value={pipeline.pending    ?? 0} max={data.total_pipeline} />
        <HBar label="Zilizoidhinishwa" value={pipeline.approved ?? 0} max={data.total_pipeline} color="bg-blue-300" />
        <HBar label="Zimeorodheshwa" value={pipeline.listed    ?? 0} max={data.total_pipeline} color="bg-primary-300" />
        <HBar label="Zilizofungwa"  value={pipeline.deal_closed ?? 0} max={data.total_pipeline} color="bg-green-400" />
      </div>
    </section>
  )
}

// ── Security Section ──────────────────────────────────────────────────────────

function SecuritySection({ metrics }: { metrics: Metrics | null }) {
  const critical = metrics?.unresolved_fraud_critical ?? 0
  const high     = metrics?.unresolved_fraud_high     ?? 0

  if (!metrics) return <SectionShimmer />

  if (critical === 0 && high === 0) return (
    <section className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-2">
      <i className="ti ti-shield-check text-green-500 text-lg" aria-hidden="true" />
      <span className="text-sm text-green-700 font-medium">Usalama: Hakuna ishara za ulaghai</span>
      <Link href="/admin/fraud" className="ml-auto text-xs text-green-600 hover:underline shrink-0">Angalia →</Link>
    </section>
  )

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <i className="ti ti-shield-exclamation text-amber-600 text-lg" aria-hidden="true" />
          <h2 className="font-semibold text-amber-800">Usalama</h2>
        </div>
        <Link href="/admin/fraud" className="text-xs text-amber-700 hover:underline">Angalia zaidi →</Link>
      </div>
      {critical > 0 && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm font-bold text-red-700 tabular-nums">{critical}</span>
          <span className="text-sm text-red-600">ishara hatari sana (critical)</span>
        </div>
      )}
      {high > 0 && (
        <div className="flex items-center gap-2 p-2 bg-amber-100 rounded-xl">
          <span className="text-sm font-bold text-amber-800 tabular-nums">{high}</span>
          <span className="text-sm text-amber-700">ishara za hatari (high+critical)</span>
        </div>
      )}
    </section>
  )
}

// ── Add Custom Headline Modal ─────────────────────────────────────────────────

function AddHeadlineModal({ onAdd, onClose }: { onAdd: (h: CustomHeadline) => void; onClose: () => void }) {
  const uid    = useId()
  const [label,      setLabel]      = useState('')
  const [metricKey,  setMetricKey]  = useState('')
  const [error,      setError]      = useState('')

  function handleAdd() {
    if (!metricKey) { setError('Chagua kipimo'); return }
    if (!label.trim()) { setError('Andika kichwa cha kadi'); return }
    onAdd({ id: `${Date.now()}`, metric_key: metricKey, label: label.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Ongeza Kichwa cha Haraka</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <i className="ti ti-x text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor={`${uid}-metric`} className="text-xs font-medium text-gray-500 block mb-1">Kipimo</label>
            <select
              id={`${uid}-metric`}
              value={metricKey}
              onChange={e => { setMetricKey(e.target.value); setError('') }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">— Chagua kipimo —</option>
              {CATALOG.map(c => (
                <option key={c.key} value={c.key}>{c.label} ({c.format === 'tzs' ? 'Tsh' : c.format === 'percent' ? '%' : '#'})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${uid}-label`} className="text-xs font-medium text-gray-500 block mb-1">Kichwa (kinachoonekana)</label>
            <input
              id={`${uid}-label`}
              value={label}
              onChange={e => { setLabel(e.target.value); setError('') }}
              placeholder={metricKey ? (CATALOG_MAP[metricKey]?.label ?? '') : 'Andika kichwa chako…'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleAdd}
            className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition"
          >
            Ongeza
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm hover:bg-gray-50 transition"
          >
            Ghairi
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const [metrics,       setMetrics]       = useState<Metrics | null>(null)
  const [metricsLoading,setMetricsLoading]= useState(true)
  const [customCards,   setCustomCards]   = useState<CustomHeadline[]>([])
  const [showModal,     setShowModal]     = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Load custom cards from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setCustomCards(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const saveCustomCards = useCallback((cards: CustomHeadline[]) => {
    setCustomCards(cards)
    try { localStorage.setItem(LS_KEY, JSON.stringify(cards)) } catch { /* ignore */ }
  }, [])

  const fetchMetrics = useCallback(() => {
    setMetricsLoading(true)
    fetch('/api/v1/admin/executive/metrics')
      .then(r => r.json())
      .then(j => { setMetrics(j); setLastRefreshed(new Date()) })
      .catch(() => null)
      .finally(() => setMetricsLoading(false))
  }, [])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  function addCustomCard(h: CustomHeadline) {
    saveCustomCards([...customCards, h])
  }
  function removeCustomCard(id: string) {
    saveCustomCards(customCards.filter(c => c.id !== id))
  }

  const timeLabel = lastRefreshed
    ? lastRefreshed.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Muhtasari wa Biashara</h1>
            {timeLabel && (
              <p className="text-xs text-gray-400 mt-0.5">Ilisasishwa {timeLabel}</p>
            )}
          </div>
          <button
            onClick={fetchMetrics}
            disabled={metricsLoading}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 transition disabled:opacity-50"
            aria-label="Onyesha upya"
          >
            <i className={`ti ti-refresh text-gray-500 ${metricsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>

        {/* Fixed + Custom headline cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {FIXED_HEADLINES.map(key => {
            const entry = CATALOG_MAP[key]
            return (
              <HeadlineCard
                key={key}
                label={entry?.label ?? key}
                value={metrics?.[key] ?? null}
                format={entry?.format ?? 'count'}
                loading={metricsLoading}
                link={entry?.link}
                warn={entry?.warn}
              />
            )
          })}

          {customCards.map(card => {
            const entry = CATALOG_MAP[card.metric_key]
            return (
              <HeadlineCard
                key={card.id}
                label={card.label}
                value={metrics?.[card.metric_key] ?? null}
                format={entry?.format ?? 'count'}
                loading={metricsLoading}
                warn={entry?.warn}
                onRemove={() => removeCustomCard(card.id)}
              />
            )
          })}

          {/* Add custom card button */}
          <button
            onClick={() => setShowModal(true)}
            className="flex flex-col items-center justify-center bg-white border border-dashed border-gray-200 rounded-2xl p-4 min-h-[80px] hover:border-primary-300 hover:bg-primary-50 transition group"
            aria-label="Ongeza kichwa kipya"
          >
            <i className="ti ti-plus text-gray-300 group-hover:text-primary-400 text-xl mb-0.5" aria-hidden="true" />
            <span className="text-xs text-gray-300 group-hover:text-primary-400">Ongeza</span>
          </button>
        </div>

        {/* Secondary sections — load progressively */}
        <div className="space-y-4">
          <SecuritySection metrics={metrics} />
          <RevenueSection />
          <UsersSection metrics={metrics} />
          <PropertySection />
          <BrokerageSection />
        </div>

        {/* Quick links footer */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-3">Viungo vya haraka</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Matangazo',    href: '/admin/listings',    icon: 'home'        },
              { label: 'Watumiaji',    href: '/admin/users',       icon: 'users'       },
              { label: 'Malipo',       href: '/admin/unlocks',     icon: 'lock-open'   },
              { label: 'Usajili',      href: '/admin/subscriptions', icon: 'credit-card' },
              { label: 'WhatsApp',     href: '/admin/whatsapp',    icon: 'brand-whatsapp' },
              { label: 'Ulaghai',      href: '/admin/fraud',       icon: 'shield-lock' },
            ].map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-white border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition"
              >
                <i className={`ti ti-${l.icon} text-primary-500 text-lg`} aria-hidden="true" />
                <span className="text-xs text-gray-500 text-center leading-tight">{l.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <AddHeadlineModal
          onAdd={addCustomCard}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
