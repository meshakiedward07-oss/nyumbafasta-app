'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlatformStats {
  total_users: number; total_clients: number; total_dalali: number
  new_users_month: number; active_listings: number; pending_listings: number
}
interface IncomeStats {
  revenue_this_month: number; subscription_revenue: number
  unlock_revenue: number; boost_revenue: number
}
interface AdsStats {
  total_advertisers: number; active_advertisers: number; pending_advertisers: number
  total_campaigns: number; active_campaigns: number
  total_impressions: number; total_clicks: number; ctr: number; total_revenue: number
}
interface PropertyStats {
  active_leases: number; total_due_month: number; total_paid_month: number
  rent_collection_rate: number; overdue_count: number
  open_maintenance: number; urgent_maintenance: number
}
interface BrokerageStats {
  total_pipeline: number; deals_closed_this_month: number; pending_commissions: number
  pipeline_by_status: { pending: number; approved: number; listed: number; deal_closed: number }
}
interface VendorStats {
  total: number; verified: number; pending: number; rejected: number
}
interface AlertItem {
  severity: string; status: string; metric: string
  display_name: string; current_value: number; threshold_value: number; created_at: string
}
interface AlertStats {
  total_open: number; total_acknowledged: number
  critical: number; warning: number; info: number
  items: AlertItem[]
}
interface BISummary {
  generated_at: string
  platform: PlatformStats
  income: IncomeStats
  ads: AdsStats
  property: PropertyStats
  brokerage: BrokerageStats
  vendors: VendorStats
  alerts: AlertStats
}

interface PeriodSection {
  title: string; summary: string; highlights: string[]
  metrics?: Record<string, number | string>
}
interface PeriodReport {
  period: string; date_range: { start: string; end: string }
  sections: PeriodSection[]
  generated_at: string
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtTzs(n: number): string {
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `Tsh ${(n / 1_000).toFixed(0)}K`
  return `Tsh ${n.toLocaleString()}`
}
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}
function fmtPct(n: number): string { return `${n.toFixed(1)}%` }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60)  return `dakika ${mins} zilizopita`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `saa ${hrs} zilizopita`
  return `siku ${Math.floor(hrs / 24)} zilizopita`
}

// ── Icons (inline SVG) ─────────────────────────────────────────────────────────

const IC = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75 as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function IcTrend()    { return <svg {...IC} className="w-5 h-5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> }
function IcUsers()    { return <svg {...IC} className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IcHome()     { return <svg {...IC} className="w-5 h-5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function IcBulb()     { return <svg {...IC} className="w-5 h-5"><path d="M9 21h6M12 2a7 7 0 0 1 4 12.93V17H8v-2.07A7 7 0 0 1 12 2z"/></svg> }
function IcBriefcase(){ return <svg {...IC} className="w-5 h-5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> }
function IcTools()    { return <svg {...IC} className="w-5 h-5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> }
function IcAlert()    { return <svg {...IC} className="w-5 h-5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function IcReport()   { return <svg {...IC} className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function IcBars()     { return <svg {...IC} className="w-5 h-5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> }
function IcRefresh()  { return <svg {...IC} className="w-4 h-4"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg> }
function IcChevron(p: { open: boolean }) {
  return <svg {...IC} className={`w-4 h-4 transition-transform ${p.open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

type Tab = 'muhtasari' | 'tahadhari' | 'mifumo' | 'ripoti'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'muhtasari', label: 'Muhtasari',    icon: <IcBars /> },
  { id: 'tahadhari', label: 'Tahadhari',    icon: <IcAlert /> },
  { id: 'mifumo',    label: 'Mifumo',       icon: <IcBriefcase /> },
  { id: 'ripoti',    label: 'Ripoti',        icon: <IcReport /> },
]

// ── KPI Card ───────────────────────────────────────────────────────────────────

const CARD_COLORS = {
  green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
  blue:   'bg-blue-50 border-blue-200 text-blue-700',
  purple: 'bg-violet-50 border-violet-200 text-violet-700',
  amber:  'bg-amber-50 border-amber-200 text-amber-700',
  red:    'bg-red-50 border-red-200 text-red-700',
  gray:   'bg-gray-50 border-gray-200 text-gray-700',
} as const
type CardColor = keyof typeof CARD_COLORS

function KpiCard({ label, value, sub, color = 'green', icon, href, warn }: {
  label: string; value: string; sub?: string
  color?: CardColor; icon: React.ReactNode; href?: string; warn?: boolean
}) {
  const cls = `rounded-xl border p-4 shadow-sm flex flex-col gap-2 ${warn ? 'bg-red-50 border-red-200' : CARD_COLORS[color].split(' ').slice(0, 2).join(' ')}`
  const inner = (
    <>
      <div className={`w-8 h-8 ${warn ? 'text-red-500' : CARD_COLORS[color].split(' ')[2]}`}>{icon}</div>
      <div className={`text-2xl font-bold tabular-nums leading-none ${warn && value !== '0' ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      <div>
        <div className="text-sm font-medium text-gray-700 leading-snug">{label}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
      </div>
    </>
  )
  if (href) return <Link href={href} className={`${cls} hover:shadow-md transition-shadow`}>{inner}</Link>
  return <div className={cls}>{inner}</div>
}

// ── Bar chart (horizontal mini bar) ──────────────────────────────────────────

function MiniBar({ label, value, total, color = '#10b981' }: { label: string; value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 text-gray-600 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right font-medium tabular-nums text-gray-700">{value}</span>
    </div>
  )
}

// ── Section card wrapper ───────────────────────────────────────────────────────

function Section({ title, icon, children, href, accent = 'text-gray-800' }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; href?: string; accent?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className={`flex items-center gap-2 font-semibold ${accent}`}>
          <span className="w-5 h-5">{icon}</span>
          <span>{title}</span>
        </div>
        {href && (
          <Link href={href} className="text-xs text-primary-600 hover:underline font-medium">
            Fungua →
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Collapsible section ────────────────────────────────────────────────────────

function Collapsible({ title, icon, badge, accent, children }: {
  title: string; icon: React.ReactNode; badge?: React.ReactNode; accent?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-gray-100 text-left"
      >
        <div className={`flex items-center gap-2 font-semibold ${accent ?? 'text-gray-800'}`}>
          <span className="w-5 h-5">{icon}</span>
          <span>{title}</span>
          {badge}
        </div>
        <IcChevron open={open} />
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

// ── Severity badge ─────────────────────────────────────────────────────────────

const SEV = {
  critical: { cls: 'bg-red-100 text-red-700', icon: '🔴', label: 'Muhimu' },
  warning:  { cls: 'bg-amber-100 text-amber-700', icon: '🟡', label: 'Tahadhari' },
  info:     { cls: 'bg-blue-100 text-blue-700', icon: '🔵', label: 'Taarifa' },
} as const

function SevBadge({ severity }: { severity: string }) {
  const s = SEV[severity as keyof typeof SEV] ?? SEV.info
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.icon} {s.label}</span>
}

// ── Period report renderer ─────────────────────────────────────────────────────

function ReportView({ report }: { report: PeriodReport }) {
  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500">
        {report.date_range.start} → {report.date_range.end}
      </div>
      {report.sections.map((sec, i) => (
        <div key={i} className="rounded-xl border border-gray-100 p-4 bg-gray-50">
          <div className="font-semibold text-gray-800 mb-1">{sec.title}</div>
          <p className="text-sm text-gray-600 mb-2">{sec.summary}</p>
          {sec.highlights?.length > 0 && (
            <ul className="list-disc list-inside space-y-0.5">
              {sec.highlights.map((h, j) => (
                <li key={j} className="text-xs text-gray-600">{h}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BiasharaPage() {
  const [tab, setTab]         = useState<Tab>('muhtasari')
  const [data, setData]       = useState<BISummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Period report state
  const [period, setPeriod]     = useState<'weekly' | 'monthly'>('weekly')
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [report, setReport]     = useState<PeriodReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError, setReportError]     = useState<string | null>(null)

  const loadData = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/admin/bi-summary${force ? '?force=1' : ''}`)
      if (!res.ok) throw new Error('Imeshindwa kupata data')
      const json = await res.json() as BISummary
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const loadReport = useCallback(async (force = false) => {
    setLoadingReport(true)
    setReportError(null)
    try {
      const res = await fetch(`/api/v1/admin/period-report?period=${period}&date=${reportDate}${force ? '&force=1' : ''}`)
      if (!res.ok) throw new Error('Imeshindwa kupata ripoti')
      const json = await res.json() as { report: PeriodReport }
      setReport(json.report)
    } catch (e) {
      setReportError((e as Error).message)
    } finally {
      setLoadingReport(false)
    }
  }, [period, reportDate])

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error ?? 'Hitilafu isiyojulikana'}
        </div>
        <button onClick={() => void loadData()} className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm">
          Jaribu Tena
        </button>
      </div>
    )
  }

  const { platform, income, ads, property, brokerage, vendors, alerts } = data

  // ── Top alert strip ────────────────────────────────────────────────────────
  const hasAlerts = alerts.total_open > 0

  return (
    <div className="max-w-5xl mx-auto px-4 pb-10 pt-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Akili ya Biashara</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Imesasishwa: {new Date(data.generated_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={() => void loadData(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
        >
          <IcRefresh /> Sasisha
        </button>
      </div>

      {/* Alert banner */}
      {hasAlerts && (
        <button
          onClick={() => setTab('tahadhari')}
          className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
            alerts.critical > 0
              ? 'bg-red-50 border-red-300 text-red-700'
              : 'bg-amber-50 border-amber-300 text-amber-700'
          }`}
        >
          <IcAlert />
          <span>
            Tahadhari {alerts.total_open}: {alerts.critical > 0 && `${alerts.critical} muhimu, `}
            {alerts.warning > 0 && `${alerts.warning} tahadhari`}
            {alerts.info > 0 && `, ${alerts.info} taarifa`}
          </span>
          <span className="ml-auto text-xs opacity-70">Bonyeza kuona →</span>
        </button>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="hidden sm:block w-4 h-4">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Muhtasari ───────────────────────────────────────────────────── */}
      {tab === 'muhtasari' && (
        <div className="space-y-5">

          {/* Platform KPIs */}
          <Section title="Platform" icon={<IcBars />} accent="text-gray-800">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard label="Mapato Mwezi Huu" value={fmtTzs(income.revenue_this_month)}
                sub="Subscriptions + Unlocks + Boosts" color="green" icon={<IcTrend />}
                href="/admin/accounting" />
              <KpiCard label="Watumiaji Wote" value={fmtNum(platform.total_users)}
                sub={`${platform.new_users_month} wapya mwezi huu`} color="blue" icon={<IcUsers />}
                href="/admin/users" />
              <KpiCard label="Matangazo Hai" value={fmtNum(platform.active_listings)}
                sub={`${platform.pending_listings} yanayosubiri idhini`}
                color={platform.pending_listings > 0 ? 'amber' : 'green'} icon={<IcHome />}
                href="/admin/listings" warn={platform.pending_listings > 5} />
              <KpiCard label="Wateja" value={fmtNum(platform.total_clients)}
                color="blue" icon={<IcUsers />} href="/admin/users" />
              <KpiCard label="Madalali" value={fmtNum(platform.total_dalali)}
                color="purple" icon={<IcUsers />} href="/admin/users" />
              <KpiCard label="Wauzaji wa Ads" value={fmtNum(ads.total_advertisers)}
                sub={`${ads.active_advertisers} hai, ${ads.pending_advertisers} wanaongoja`}
                color="purple" icon={<IcBriefcase />} href="/admin/adverts/advertisers"
                warn={ads.pending_advertisers > 0} />
            </div>
          </Section>

          {/* Income breakdown */}
          <Section title="Mapato ya Mwezi Huu" icon={<IcTrend />} accent="text-emerald-700" href="/admin/accounting">
            <div className="space-y-2">
              <MiniBar label="Subscription" value={income.subscription_revenue}
                total={income.revenue_this_month} color="#10b981" />
              <MiniBar label="Mawasiliano" value={income.unlock_revenue}
                total={income.revenue_this_month} color="#3b82f6" />
              <MiniBar label="Boosts" value={income.boost_revenue}
                total={income.revenue_this_month} color="#8b5cf6" />
              <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Jumla</span>
                <span className="text-emerald-700">{fmtTzs(income.revenue_this_month)}</span>
              </div>
            </div>
          </Section>

          {/* Quick links grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Usimamizi wa Mali', href: '/admin/property-management', color: 'text-blue-600 bg-blue-50 border-blue-100' },
              { label: 'Mfumo wa Brokerage', href: '/admin/organizations', color: 'text-violet-600 bg-violet-50 border-violet-100' },
              { label: 'Mfumo wa Ads', href: '/admin/adverts', color: 'text-amber-600 bg-amber-50 border-amber-100' },
              { label: 'Vendors/Mafundi', href: '/admin/fundi', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
            ].map(l => (
              <Link key={l.href} href={l.href}
                className={`text-center py-3 px-2 rounded-xl border text-sm font-medium hover:shadow-sm transition-all ${l.color}`}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Tahadhari ───────────────────────────────────────────────────── */}
      {tab === 'tahadhari' && (
        <div className="space-y-4">
          {/* Summary chips */}
          <div className="flex gap-2 flex-wrap">
            {alerts.critical > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                🔴 {alerts.critical} Muhimu
              </span>
            )}
            {alerts.warning > 0 && (
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                🟡 {alerts.warning} Tahadhari
              </span>
            )}
            {alerts.info > 0 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                🔵 {alerts.info} Taarifa
              </span>
            )}
            {alerts.total_acknowledged > 0 && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                ✓ {alerts.total_acknowledged} Zimetambuliwa
              </span>
            )}
          </div>

          {alerts.items.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-700 text-sm">
              ✅ Hakuna tahadhari wazi. Mfumo uko sawa!
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.items.map((a, i) => (
                <div key={i}
                  className={`rounded-xl border p-4 ${
                    a.severity === 'critical' ? 'bg-red-50 border-red-200'
                    : a.severity === 'warning' ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SevBadge severity={a.severity} />
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.status === 'acknowledged' ? 'bg-gray-200 text-gray-600' : 'bg-white text-gray-700'
                        }`}>
                          {a.status === 'acknowledged' ? 'Imetambuliwa' : 'Wazi'}
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium text-gray-900 text-sm">{a.display_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Thamani: <strong>{a.current_value}</strong> (kiwango: {a.threshold_value})
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link href="/admin/alerts" className="text-sm text-primary-600 hover:underline font-medium">
              Simamia Tahadhari Zote →
            </Link>
          </div>
        </div>
      )}

      {/* ── Tab: Mifumo ─────────────────────────────────────────────────────── */}
      {tab === 'mifumo' && (
        <div className="space-y-4">

          {/* Ads System */}
          <Collapsible title="Mfumo wa Matangazo (Ads)" icon={<IcBriefcase />} accent="text-violet-700"
            badge={ads.pending_advertisers > 0
              ? <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                  {ads.pending_advertisers} wanaongoja
                </span>
              : undefined}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="text-center p-3 bg-violet-50 rounded-xl">
                <div className="text-2xl font-bold text-violet-700">{ads.active_campaigns}</div>
                <div className="text-xs text-gray-600 mt-1">Kampeni Hai</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-700">{fmtNum(ads.total_impressions)}</div>
                <div className="text-xs text-gray-600 mt-1">Maonyesho</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-700">{fmtNum(ads.total_clicks)}</div>
                <div className="text-xs text-gray-600 mt-1">Mabonyezo</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-xl">
                <div className="text-2xl font-bold text-amber-700">{fmtPct(ads.ctr)}</div>
                <div className="text-xs text-gray-600 mt-1">CTR</div>
              </div>
            </div>
            <div className="space-y-2">
              <MiniBar label="Hai" value={ads.active_advertisers} total={ads.total_advertisers} color="#8b5cf6" />
              <MiniBar label="Wanaongoja" value={ads.pending_advertisers} total={ads.total_advertisers} color="#f59e0b" />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-600">Mapato ya Ads (jumla)</span>
              <span className="font-semibold text-violet-700">{fmtTzs(ads.total_revenue)}</span>
            </div>
            <Link href="/admin/adverts/analytics" className="mt-2 block text-xs text-primary-600 hover:underline">
              Angalia analytics kamili →
            </Link>
          </Collapsible>

          {/* Property Management */}
          <Collapsible title="Usimamizi wa Mali" icon={<IcHome />} accent="text-blue-700"
            badge={property.urgent_maintenance > 0
              ? <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                  {property.urgent_maintenance} ya haraka
                </span>
              : undefined}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-700">{property.active_leases}</div>
                <div className="text-xs text-gray-600 mt-1">Upangaji Hai</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${property.rent_collection_rate < 70 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                <div className={`text-2xl font-bold ${property.rent_collection_rate < 70 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {fmtPct(property.rent_collection_rate)}
                </div>
                <div className="text-xs text-gray-600 mt-1">Ukusanyaji wa Kodi</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${property.overdue_count > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${property.overdue_count > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                  {property.overdue_count}
                </div>
                <div className="text-xs text-gray-600 mt-1">Kodi Zilizochelewa</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-500 mb-1">Kodi Inayotarajiwa (mwezi huu)</div>
                <div className="font-semibold text-gray-800">{fmtTzs(property.total_due_month)}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <div className="text-xs text-gray-500 mb-1">Kodi Iliyolipwa</div>
                <div className="font-semibold text-emerald-700">{fmtTzs(property.total_paid_month)}</div>
              </div>
            </div>
            <div className={`mt-3 p-3 rounded-xl flex items-center justify-between text-sm ${
              property.open_maintenance > 0 ? 'bg-amber-50' : 'bg-gray-50'
            }`}>
              <span className="text-gray-700">Matengenezo Wazi</span>
              <span className={`font-bold ${property.open_maintenance > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                {property.open_maintenance}
                {property.urgent_maintenance > 0 && ` (${property.urgent_maintenance} ya haraka)`}
              </span>
            </div>
            <Link href="/admin/property-management" className="mt-2 block text-xs text-primary-600 hover:underline">
              Simamia mali →
            </Link>
          </Collapsible>

          {/* Brokerage System */}
          <Collapsible title="Mfumo wa Brokerage" icon={<IcBriefcase />} accent="text-emerald-700">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-emerald-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-700">{brokerage.total_pipeline}</div>
                <div className="text-xs text-gray-600 mt-1">Jumla ya Pipeline</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-700">{brokerage.deals_closed_this_month}</div>
                <div className="text-xs text-gray-600 mt-1">Mikataba Mwezi Huu</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${brokerage.pending_commissions > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <div className={`text-lg font-bold leading-tight ${brokerage.pending_commissions > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                  {fmtTzs(brokerage.pending_commissions)}
                </div>
                <div className="text-xs text-gray-600 mt-1">Komisho Zinaongoja</div>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(brokerage.pipeline_by_status).map(([s, n]) => {
                const labels: Record<string, string> = {
                  pending: 'Zinaongoja', approved: 'Zilizoidhinishwa',
                  listed: 'Zimewekwa', deal_closed: 'Mikataba Iliyofungwa',
                }
                const colors: Record<string, string> = {
                  pending: '#f59e0b', approved: '#3b82f6',
                  listed: '#8b5cf6', deal_closed: '#10b981',
                }
                return (
                  <MiniBar key={s} label={labels[s] ?? s} value={n as number}
                    total={brokerage.total_pipeline} color={colors[s] ?? '#6b7280'} />
                )
              })}
            </div>
            <Link href="/admin/organizations" className="mt-2 block text-xs text-primary-600 hover:underline">
              Simamia mashirika →
            </Link>
          </Collapsible>

          {/* Vendors & Mafundi */}
          <Collapsible title="Vendors & Mafundi" icon={<IcTools />} accent="text-gray-700"
            badge={vendors.pending > 0
              ? <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                  {vendors.pending} wanaongoja ukaguzi
                </span>
              : undefined}
          >
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-800">{vendors.total}</div>
                <div className="text-xs text-gray-600 mt-1">Jumla</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-700">{vendors.verified}</div>
                <div className="text-xs text-gray-600 mt-1">Waliothibitishwa</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${vendors.pending > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${vendors.pending > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                  {vendors.pending}
                </div>
                <div className="text-xs text-gray-600 mt-1">Wanaongoja</div>
              </div>
            </div>
            <div className="space-y-2">
              <MiniBar label="Waliothibitishwa" value={vendors.verified} total={vendors.total} color="#10b981" />
              <MiniBar label="Wanaongoja" value={vendors.pending} total={vendors.total} color="#f59e0b" />
              <MiniBar label="Walikataliwa" value={vendors.rejected} total={vendors.total} color="#ef4444" />
            </div>
            <Link href="/admin/fundi" className="mt-2 block text-xs text-primary-600 hover:underline">
              Simamia vendors →
            </Link>
          </Collapsible>

        </div>
      )}

      {/* ── Tab: Ripoti ──────────────────────────────────────────────────────── */}
      {tab === 'ripoti' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Unda Ripoti ya Kipindi</h2>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 mb-4">
              {/* Period toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
                {(['weekly', 'monthly'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => { setPeriod(p); setReport(null) }}
                    className={`px-4 py-2 font-medium transition-colors ${
                      period === p ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p === 'weekly' ? 'Wiki' : 'Mwezi'}
                  </button>
                ))}
              </div>

              {/* Date picker */}
              <input
                type="date"
                value={reportDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => { setReportDate(e.target.value); setReport(null) }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />

              <button
                onClick={() => void loadReport(false)}
                disabled={loadingReport}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                {loadingReport ? 'Inaunda...' : 'Unda Ripoti'}
              </button>

              {report && (
                <button
                  onClick={() => void loadReport(true)}
                  disabled={loadingReport}
                  className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <IcRefresh /> Unda Upya
                </button>
              )}
            </div>

            {reportError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm mb-4">
                {reportError}
              </div>
            )}

            {loadingReport && (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-xl" />
                ))}
              </div>
            )}

            {report && !loadingReport && <ReportView report={report} />}

            {!report && !loadingReport && !reportError && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Chagua kipindi na tarehe kisha bonyeza "Unda Ripoti"
              </div>
            )}
          </div>

          <div className="text-center">
            <Link href="/admin/reports" className="text-sm text-primary-600 hover:underline font-medium">
              Angalia Ripoti Zote zilizohifadhiwa →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
