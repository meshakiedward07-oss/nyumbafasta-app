'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────
type Overview = {
  total_advertisers: number; active_advertisers: number; pending_advertisers: number
  total_campaigns: number; active_campaigns: number
  total_impressions: number; total_clicks: number; overall_ctr: number; total_revenue: number
}
type AdTypeRow = { ad_type: string; campaigns: number; active: number; impressions: number; clicks: number; ctr: number }
type PlanRow   = { name: string; ad_type: string; price_tzs: number; campaign_count: number }
type Campaign  = { id: string; title: string; ad_type: string; status: string; impressions: number; clicks: number; ctr: number; cta_type: string; advertiser: string; expires_at: string | null }
type MonthRev  = { month: string; amount: number }

// ── SVG Icons ──────────────────────────────────────────────────────────────
const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'w-full h-full' }

function IcChart()     { return <svg {...S}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> }
function IcUsers()     { return <svg {...S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IcBriefcase() { return <svg {...S}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> }
function IcCoins()     { return <svg {...S}><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg> }
function IcPercent()   { return <svg {...S}><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> }
function IcEye()       { return <svg {...S}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function IcCursor()    { return <svg {...S}><path d="M4 4l7.07 18 2.51-7.42L21 12.07z"/></svg> }
function IcArrowLeft() { return <svg {...S}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> }
function IcTrend()     { return <svg {...S}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> }

function AdTypeIcon({ type }: { type: string }) {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75 as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'w-3.5 h-3.5' }
  switch (type) {
    case 'banner':    return <svg {...p}><rect x="3" y="7" width="18" height="10" rx="1"/></svg>
    case 'search':    return <svg {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    case 'nearby':    return <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    case 'video':     return <svg {...p}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
    case 'featured':  return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    case 'bundle':    return <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
    case 'directory': return <svg {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
    default:          return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  }
}

// ── Formatters ─────────────────────────────────────────────────────────────
function fmtTZS(n: number) { return `Tsh ${n.toLocaleString('en-TZ')}` }
function fmtNum(n: number) { return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n) }

// ── KPI Card ───────────────────────────────────────────────────────────────
const ACCENT = {
  green:  { bg: 'bg-emerald-50',  icon: 'text-emerald-600', val: 'text-emerald-700', border: 'border-emerald-100' },
  blue:   { bg: 'bg-blue-50',     icon: 'text-blue-600',    val: 'text-blue-700',    border: 'border-blue-100'    },
  purple: { bg: 'bg-violet-50',   icon: 'text-violet-600',  val: 'text-violet-700',  border: 'border-violet-100'  },
  amber:  { bg: 'bg-amber-50',    icon: 'text-amber-600',   val: 'text-amber-700',   border: 'border-amber-100'   },
} as const

function KPI({ label, value, sub, color = 'green', icon }: {
  label: string; value: string; sub?: string; color?: keyof typeof ACCENT; icon: React.ReactNode
}) {
  const a = ACCENT[color]
  return (
    <div className={`bg-white rounded-2xl border ${a.border} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] font-medium text-gray-400 leading-tight">{label}</p>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 p-1.5 ${a.bg} ${a.icon}`}>
          {icon}
        </span>
      </div>
      <p className={`text-2xl font-bold ${a.val} tabular-nums`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1 leading-snug">{sub}</p>}
    </div>
  )
}

// ── SVG Revenue Bar Chart ──────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ago','Sep','Okt','Nov','Des']

function RevenueChart({ data }: { data: MonthRev[] }) {
  if (!data.length) return null
  const W = 640, H = 220
  const PAD = { top: 20, right: 16, bottom: 48, left: 68 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom
  const maxVal = Math.max(...data.map(d => d.amount), 1)

  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const niceMax   = Math.ceil(maxVal / magnitude) * magnitude
  const ticks     = [0, 0.25, 0.5, 0.75, 1].map(t => niceMax * t)
  const slotW     = cW / data.length
  const barW      = Math.max(slotW * 0.52, 14)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Grafu ya mapato kwa mwezi">
      {ticks.map((val, i) => {
        const y = PAD.top + cH - (val / niceMax) * cH
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke={i === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth={i === 0 ? 1 : 0.75} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af" fontFamily="system-ui,sans-serif">
              {val === 0 ? '0' : val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : `${(val / 1_000).toFixed(0)}K`}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const barH = Math.max((d.amount / niceMax) * cH, 3)
        const x    = PAD.left + i * slotW + (slotW - barW) / 2
        const y    = PAD.top + cH - barH
        const [yr, mo] = d.month.split('-')
        const lbl  = `${MONTHS[parseInt(mo) - 1]} '${yr.slice(2)}`
        return (
          <g key={d.month}>
            <rect x={x} y={PAD.top} width={barW} height={cH} rx={4} fill="#1D9E75" opacity={0.04} />
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill="#1D9E75" />
            {d.amount > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={8.5} fill="#1D9E75" fontWeight={600} fontFamily="system-ui,sans-serif">
                {d.amount >= 1_000_000 ? `${(d.amount / 1_000_000).toFixed(1)}M` : `${(d.amount / 1_000).toFixed(0)}K`}
              </text>
            )}
            <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize={9} fill="#9ca3af" fontFamily="system-ui,sans-serif">
              {lbl}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Status Badge ───────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; dot: string; cls: string }> = {
  active:         { label: 'Inafanya Kazi', dot: 'bg-green-400',  cls: 'bg-green-50 text-green-700'  },
  approved:       { label: 'Imeidhinishwa', dot: 'bg-blue-400',   cls: 'bg-blue-50 text-blue-700'    },
  pending_review: { label: 'Inasubiri',     dot: 'bg-amber-400',  cls: 'bg-amber-50 text-amber-700'  },
  expired:        { label: 'Imekwisha',     dot: 'bg-gray-300',   cls: 'bg-gray-50 text-gray-500'    },
  rejected:       { label: 'Imekataliwa',   dot: 'bg-red-400',    cls: 'bg-red-50 text-red-600'      },
  paused:         { label: 'Imesimama',     dot: 'bg-gray-400',   cls: 'bg-gray-50 text-gray-500'    },
  suspended:      { label: 'Imezuiwa',      dot: 'bg-red-500',    cls: 'bg-red-50 text-red-600'      },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? { label: status, dot: 'bg-gray-300', cls: 'bg-gray-50 text-gray-500' }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ── Loading Skeleton ───────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
      </div>
      <div className="h-56 bg-white rounded-2xl border border-gray-100 animate-pulse" />
      <div className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">{children}</h2>
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdsAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [byType, setByType]     = useState<AdTypeRow[]>([])
  const [byPlan, setByPlan]     = useState<PlanRow[]>([])
  const [topCamps, setTopCamps] = useState<Campaign[]>([])
  const [revenue, setRevenue]   = useState<MonthRev[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    fetch('/api/v1/admin/adverts/analytics')
      .then(async r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => {
        setOverview(d.overview)
        setByType(d.by_ad_type ?? [])
        setByPlan(d.by_plan ?? [])
        setTopCamps(d.top_campaigns ?? [])
        setRevenue(d.revenue_by_month ?? [])
      })
      .catch(() => setError('Imeshindwa kupakua data. Jaribu tena.'))
      .finally(() => setLoading(false))
  }, [])

  const maxImpr = Math.max(...byType.map(t => t.impressions), 1)

  return (
    <div className="min-h-screen bg-gray-50/60 pb-12">

      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/admin/adverts"
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition flex-shrink-0 p-2">
            <IcArrowLeft />
          </Link>
          <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 p-1.5 text-primary-600">
            <IcChart />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">Ads Analytics</h1>
            <p className="text-[11px] text-gray-400">Uchambuzi wa mfumo wa matangazo</p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-8">

        {loading && <PageSkeleton />}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-3 text-xs text-red-400 underline">
              Jaribu tena
            </button>
          </div>
        )}

        {!loading && !error && overview && (
          <>
            {/* KPI Cards */}
            <section>
              <SectionTitle>Muhtasari wa Jumla</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPI label="Wafanyabiashara" color="green"
                  value={String(overview.total_advertisers)}
                  sub={`${overview.active_advertisers} wanaofanya kazi · ${overview.pending_advertisers} wanaosubiri`}
                  icon={<IcUsers />} />
                <KPI label="Kampeni Zote" color="blue"
                  value={String(overview.total_campaigns)}
                  sub={`${overview.active_campaigns} zinazoendeshwa sasa`}
                  icon={<IcBriefcase />} />
                <KPI label="Jumla Mapato" color="purple"
                  value={`Tsh ${fmtNum(overview.total_revenue)}`}
                  sub="Malipo yaliyokamilika"
                  icon={<IcCoins />} />
                <KPI label="CTR ya Jumla" color="amber"
                  value={`${overview.overall_ctr}%`}
                  sub="Click-through rate"
                  icon={<IcPercent />} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <KPI label="Jumla Maoni" color="blue"
                  value={fmtNum(overview.total_impressions)}
                  sub="Impressions zote"
                  icon={<IcEye />} />
                <KPI label="Jumla Clicks" color="green"
                  value={fmtNum(overview.total_clicks)}
                  sub="Hatua zilizochukuliwa"
                  icon={<IcCursor />} />
                <KPI label="Ratio Click / Maoni" color="amber"
                  value={`1 : ${overview.total_clicks > 0 ? Math.round(overview.total_impressions / overview.total_clicks) : '—'}`}
                  sub="Click 1 kwa maoni mangapi"
                  icon={<IcTrend />} />
              </div>
            </section>

            {/* Revenue Chart */}
            {revenue.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle>Mapato kwa Mwezi (Miezi 6 Iliyopita)</SectionTitle>
                  <span className="text-xs text-primary-600 font-semibold tabular-nums">{fmtTZS(overview.total_revenue)}</span>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-4 sm:px-5 sm:py-5 overflow-x-auto">
                  <div className="min-w-[300px]">
                    <RevenueChart data={revenue} />
                  </div>
                </div>
              </section>
            )}

            {/* By Ad Type */}
            {byType.length > 0 && (
              <section>
                <SectionTitle>Ufanisi kwa Aina ya Tangazo</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Aina</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Kampeni</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Maoni</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Clicks</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">CTR</th>
                          <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Kiwango</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {byType.map(row => (
                          <tr key={row.ad_type} className="hover:bg-gray-50/60 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                                  <AdTypeIcon type={row.ad_type} />
                                </span>
                                <div>
                                  <p className="font-semibold text-gray-800 text-xs capitalize">{row.ad_type}</p>
                                  <p className="text-[10px] text-gray-400">{row.active} zinafanya kazi</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 tabular-nums">{row.campaigns}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 tabular-nums">{fmtNum(row.impressions)}</td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-700 tabular-nums">{fmtNum(row.clicks)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold text-sm tabular-nums ${row.ctr >= 3 ? 'text-green-600' : row.ctr >= 1 ? 'text-amber-600' : 'text-gray-400'}`}>
                                {row.ctr}%
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-primary-500 h-1.5 rounded-full"
                                    style={{ width: `${Math.max((row.impressions / maxImpr) * 100, 2)}%` }} />
                                </div>
                                <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">
                                  {Math.round((row.impressions / maxImpr) * 100)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Subscription Plans */}
            {byPlan.length > 0 && (
              <section>
                <SectionTitle>Kampeni kwa Mpango wa Subscription</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byPlan.map(p => (
                    <div key={p.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-gray-400">
                            <AdTypeIcon type={p.ad_type} />
                            <span className="text-xs capitalize">{p.ad_type}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-center bg-primary-50 border border-primary-100 rounded-xl px-2.5 py-1.5">
                          <p className="text-lg font-bold text-primary-700 tabular-nums leading-none">{p.campaign_count}</p>
                          <p className="text-[9px] text-primary-500 font-medium">kampeni</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-50">
                        <p className="text-[11px] text-gray-400">Bei kwa kampeni</p>
                        <p className="text-sm font-semibold text-gray-700 tabular-nums">{fmtTZS(p.price_tzs)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top Campaigns */}
            {topCamps.length > 0 && (
              <section>
                <SectionTitle>Kampeni Bora Zaidi (kwa Maoni)</SectionTitle>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-10">#</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Kampeni</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Mfanyabiashara</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Maoni</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Clicks</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">CTR</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Hali</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {topCamps.map((c, i) => (
                          <tr key={c.id} className="hover:bg-gray-50/60 transition">
                            <td className="px-4 py-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                i === 0 ? 'bg-amber-100 text-amber-700' :
                                i === 1 ? 'bg-gray-200 text-gray-600'   :
                                i === 2 ? 'bg-orange-100 text-orange-600' :
                                'bg-gray-100 text-gray-400'
                              }`}>{i + 1}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                                  <AdTypeIcon type={c.ad_type} />
                                </span>
                                <p className="font-medium text-gray-800 text-xs truncate max-w-[150px]">{c.title}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-[130px] truncate">{c.advertiser}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">{fmtNum(c.impressions)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">{fmtNum(c.clicks)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-bold text-sm tabular-nums ${c.ctr >= 3 ? 'text-green-600' : c.ctr >= 1 ? 'text-amber-600' : 'text-gray-400'}`}>
                                {c.ctr}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={c.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Empty state */}
            {topCamps.length === 0 && byType.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 text-center py-20">
                <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center p-3 text-gray-400">
                  <IcChart />
                </div>
                <p className="font-semibold text-gray-600">Bado hakuna data ya analytics</p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
                  Data itaonekana baada ya kampeni kuanza kupata maoni na clicks.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
