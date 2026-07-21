'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Overview = {
  total_advertisers: number; active_advertisers: number; pending_advertisers: number
  total_campaigns: number; active_campaigns: number
  total_impressions: number; total_clicks: number; overall_ctr: number; total_revenue: number
}
type AdTypeRow = { ad_type: string; campaigns: number; active: number; impressions: number; clicks: number; ctr: number }
type PlanRow   = { name: string; ad_type: string; price_tzs: number; campaign_count: number }
type Campaign  = { id: string; title: string; ad_type: string; status: string; impressions: number; clicks: number; ctr: number; cta_type: string; advertiser: string; expires_at: string | null }
type MonthRev  = { month: string; amount: number }

const TYPE_ICONS: Record<string, string> = { banner: '🎯', search: '🔍', nearby: '📍', video: '🎬', featured: '⭐', bundle: '📦', directory: '🏪' }
const STATUS_DOT: Record<string, string> = { active: 'bg-green-400', pending_review: 'bg-amber-400', approved: 'bg-blue-400', expired: 'bg-gray-300', rejected: 'bg-red-400', paused: 'bg-gray-400', suspended: 'bg-red-500' }

function fmtTZS(n: number) { return `Tsh ${n.toLocaleString('en-TZ')}` }
function fmtNum(n: number) { return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n) }

function KPI({ label, value, sub, color = 'green' }: { label: string; value: string; sub?: string; color?: string }) {
  const border = color === 'green' ? 'border-primary-200' : color === 'blue' ? 'border-blue-200' : color === 'amber' ? 'border-amber-200' : 'border-purple-200'
  const icon = color === 'green' ? 'text-primary-600' : color === 'blue' ? 'text-blue-600' : color === 'amber' ? 'text-amber-600' : 'text-purple-600'
  return (
    <div className={`bg-white rounded-2xl border ${border} p-4 shadow-sm`}>
      <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${icon}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdsAnalyticsPage() {
  const [overview, setOverview]   = useState<Overview | null>(null)
  const [byType, setByType]       = useState<AdTypeRow[]>([])
  const [byPlan, setByPlan]       = useState<PlanRow[]>([])
  const [topCamps, setTopCamps]   = useState<Campaign[]>([])
  const [revenue, setRevenue]     = useState<MonthRev[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch('/api/v1/admin/adverts/analytics')
      .then(r => r.json())
      .then(d => {
        setOverview(d.overview)
        setByType(d.by_ad_type ?? [])
        setByPlan(d.by_plan ?? [])
        setTopCamps(d.top_campaigns ?? [])
        setRevenue(d.revenue_by_month ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const maxRev = Math.max(...revenue.map(r => r.amount), 1)
  const maxImpr = Math.max(...byType.map(t => t.impressions), 1)

  return (
    <div className="min-h-screen bg-gray-50/60 pb-12">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-1">
          <Link href="/admin/adverts" className="hover:text-gray-600">← Kampeni</Link>
          <span>/</span>
          <span className="text-gray-600 font-medium">Analytics</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">📊 Ads Analytics</h1>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-8">

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && overview && (
          <>
            {/* ── KPIs ── */}
            <section>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Muhtasari</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPI label="Wafanyabiashara" value={String(overview.total_advertisers)}
                  sub={`${overview.active_advertisers} wanaofanya kazi · ${overview.pending_advertisers} wanaosubiri`} color="green" />
                <KPI label="Kampeni Zote" value={String(overview.total_campaigns)}
                  sub={`${overview.active_campaigns} zinazoendeshwa`} color="blue" />
                <KPI label="Jumla Mapato" value={fmtTZS(overview.total_revenue)}
                  sub="Malipo yaliyokamilika" color="purple" />
                <KPI label="CTR ya Jumla" value={`${overview.overall_ctr}%`}
                  sub="Click-through rate" color="amber" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                <KPI label="Jumla Maoni (Impressions)" value={fmtNum(overview.total_impressions)} color="blue" />
                <KPI label="Jumla Mibonyezo (Clicks)" value={fmtNum(overview.total_clicks)} color="green" />
                <KPI label="Ratio ya Click/Maoni" value={`1:${overview.total_clicks > 0 ? Math.round(overview.total_impressions / overview.total_clicks) : '∞'}`}
                  sub="Kila click 1 ina maoni mangapi" color="amber" />
              </div>
            </section>

            {/* ── Revenue by Month ── */}
            {revenue.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Mapato kwa Mwezi (Miezi 6 Iliyopita)</h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-end gap-3 h-40">
                    {revenue.map(r => {
                      const pct = (r.amount / maxRev) * 100
                      const [yr, mo] = r.month.split('-')
                      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Ago','Sep','Okt','Nov','Des']
                      const label = `${monthNames[parseInt(mo) - 1]} ${yr.slice(2)}`
                      return (
                        <div key={r.month} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-gray-400 font-medium">{fmtTZS(r.amount).replace('Tsh ', '')}</span>
                          <div className="w-full bg-primary-100 rounded-t-lg relative" style={{ height: `${Math.max(pct, 4)}%` }}>
                            <div className="absolute inset-0 bg-primary-500 rounded-t-lg opacity-80" />
                          </div>
                          <span className="text-[10px] text-gray-400">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* ── By Ad Type ── */}
            {byType.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Ufanisi kwa Aina ya Tangazo</h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left border-b border-gray-100">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500">Aina</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Kampeni</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Maoni</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Clicks</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">CTR</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Mwenendo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {byType.map(row => (
                        <tr key={row.ad_type} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-3">
                            <span className="text-base mr-1.5">{TYPE_ICONS[row.ad_type] ?? '📢'}</span>
                            <span className="font-semibold text-gray-800 capitalize">{row.ad_type}</span>
                            <span className="ml-2 text-xs text-gray-400">{row.active} active</span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">{row.campaigns}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">{fmtNum(row.impressions)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">{fmtNum(row.clicks)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm ${row.ctr >= 3 ? 'text-green-600' : row.ctr >= 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                              {row.ctr}%
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-primary-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.max((row.impressions / maxImpr) * 100, 2)}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── By Subscription Plan ── */}
            {byPlan.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Kampeni kwa Mpango wa Subscription</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byPlan.map(p => (
                    <div key={p.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{p.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{TYPE_ICONS[p.ad_type] ?? '📢'} {p.ad_type}</p>
                        </div>
                        <span className="bg-primary-50 text-primary-700 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0">
                          {p.campaign_count} kampeni
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{fmtTZS(p.price_tzs)} / kwa kampeni</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Top Campaigns ── */}
            {topCamps.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Kampeni Bora Zaidi (kwa Maoni)</h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50 text-left border-b border-gray-100">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500">Kampeni</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500">Mfanyabiashara</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Maoni</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Clicks</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">CTR</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center">Hali</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500">CTA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topCamps.map((c, i) => (
                        <tr key={c.id} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">{i + 1}</span>
                              <div>
                                <p className="font-medium text-gray-800 text-xs truncate max-w-[140px]">{c.title}</p>
                                <p className="text-[10px] text-gray-400 capitalize">{TYPE_ICONS[c.ad_type] ?? '📢'} {c.ad_type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 max-w-[120px] truncate">{c.advertiser}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtNum(c.impressions)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtNum(c.clicks)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold text-sm ${c.ctr >= 3 ? 'text-green-600' : c.ctr >= 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                              {c.ctr}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              c.status === 'active' ? 'bg-green-50 text-green-700' :
                              c.status === 'expired' ? 'bg-gray-100 text-gray-500' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${STATUS_DOT[c.status] ?? 'bg-gray-300'}`} />
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 capitalize">{c.cta_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {topCamps.length === 0 && byType.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 text-center py-20">
                <div className="text-5xl mb-3">📊</div>
                <p className="font-semibold text-gray-600">Bado hakuna data ya analytics</p>
                <p className="text-sm text-gray-400 mt-1">Data itaonekana baada ya kampeni kuanza kupata maoni na clicks</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
