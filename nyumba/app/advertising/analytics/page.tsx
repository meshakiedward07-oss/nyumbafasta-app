'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────
type Summary = {
  total_campaigns: number; active_campaigns: number
  total_impressions: number; total_clicks: number; overall_ctr: number
}
type CampaignStat = {
  id: string; title: string; ad_type: string; status: string
  impressions: number; clicks: number; ctr: number
  cta_type: string; starts_at: string | null; expires_at: string | null
  days_remaining: number | null
  plan: { name: string; price_tzs: number; duration_days: number } | null
}

// ── SVG Icons ──────────────────────────────────────────────────────────────
const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'w-full h-full' }

function IcChart()     { return <svg {...S}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> }
function IcEye()       { return <svg {...S}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> }
function IcCursor()    { return <svg {...S}><path d="M4 4l7.07 18 2.51-7.42L21 12.07z"/></svg> }
function IcPercent()   { return <svg {...S}><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> }
function IcBriefcase() { return <svg {...S}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> }
function IcArrowLeft() { return <svg {...S}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> }
function IcHome()      { return <svg {...S}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function IcPlus()      { return <svg {...S}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function IcUser()      { return <svg {...S}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function IcInfo()      { return <svg {...S}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> }
function IcClock()     { return <svg {...S}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }

function AdTypeIcon({ type, className = 'w-4 h-4' }: { type: string; className?: string }) {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75 as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className }
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
function fmtNum(n: number) { return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n) }

// ── Status Config ──────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; dot: string; stripe: string }> = {
  active:         { label: 'Inafanya Kazi',  cls: 'bg-green-100 text-green-700',  dot: 'bg-green-400', stripe: 'bg-green-400'  },
  approved:       { label: 'Imeidhinishwa',  cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400',  stripe: 'bg-blue-400'   },
  pending_review: { label: 'Inasubiri',      cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400', stripe: 'bg-amber-400'  },
  expired:        { label: 'Imekwisha',      cls: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300',  stripe: 'bg-gray-200'   },
  rejected:       { label: 'Imekataliwa',    cls: 'bg-red-100 text-red-600',      dot: 'bg-red-400',   stripe: 'bg-red-400'    },
  paused:         { label: 'Imesimamishwa',  cls: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400',  stripe: 'bg-gray-300'   },
  suspended:      { label: 'Imezuiwa',       cls: 'bg-red-100 text-red-600',      dot: 'bg-red-500',   stripe: 'bg-red-500'    },
}

const CTA_LABELS: Record<string, string> = { whatsapp: 'WhatsApp', call: 'Simu', website: 'Tovuti' }

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdvertiserAnalyticsPage() {
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    fetch('/api/v1/advertising/analytics')
      .then(async r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setSummary(d.summary); setCampaigns(d.campaigns ?? []) })
      .catch(() => setError('Imeshindwa kupakua data. Jaribu tena.'))
      .finally(() => setLoading(false))
  }, [])

  const maxImpr = Math.max(...campaigns.map(c => c.impressions), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* Sticky header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/advertising/dashboard"
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition flex-shrink-0 p-2">
            <IcArrowLeft />
          </Link>
          <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center p-1.5 text-primary-600 flex-shrink-0">
            <IcChart />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Analytics ya Matangazo</h1>
            <p className="text-[11px] text-gray-400">Ufanisi wa matangazo yako</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-6">

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-xs text-red-400 underline">
              Jaribu tena
            </button>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            {/* Summary KPI cards */}
            <section>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Muhtasari wa Jumla</p>

              <div className="grid grid-cols-2 gap-3">
                {/* Impressions */}
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-gray-400">Maoni (Impressions)</p>
                    <span className="w-7 h-7 bg-blue-50 rounded-xl p-1.5 text-blue-500 flex-shrink-0">
                      <IcEye />
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmtNum(summary.total_impressions)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">mara tangazo lilionekana</p>
                </div>

                {/* Clicks */}
                <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-gray-400">Hatua (Clicks)</p>
                    <span className="w-7 h-7 bg-emerald-50 rounded-xl p-1.5 text-emerald-500 flex-shrink-0">
                      <IcCursor />
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmtNum(summary.total_clicks)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">mtu alichukua hatua</p>
                </div>

                {/* CTR */}
                <div className={`bg-white rounded-2xl border shadow-sm p-4 ${
                  summary.overall_ctr >= 3 ? 'border-green-100' :
                  summary.overall_ctr >= 1 ? 'border-amber-100' : 'border-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-gray-400">CTR ya Jumla</p>
                    <span className={`w-7 h-7 rounded-xl p-1.5 flex-shrink-0 ${
                      summary.overall_ctr >= 3 ? 'bg-green-50 text-green-500' :
                      summary.overall_ctr >= 1 ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-400'
                    }`}>
                      <IcPercent />
                    </span>
                  </div>
                  <p className={`text-2xl font-bold tabular-nums ${
                    summary.overall_ctr >= 3 ? 'text-green-700' :
                    summary.overall_ctr >= 1 ? 'text-amber-700' : 'text-gray-600'
                  }`}>{summary.overall_ctr}%</p>
                  <p className="text-[10px] text-gray-400 mt-1">click-through rate</p>
                </div>

                {/* Active campaigns */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-gray-400">Kampeni Hai</p>
                    <span className="w-7 h-7 bg-primary-50 rounded-xl p-1.5 text-primary-600 flex-shrink-0">
                      <IcBriefcase />
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">{summary.active_campaigns}</p>
                  <p className="text-[10px] text-gray-400 mt-1">kati ya {summary.total_campaigns} zote</p>
                </div>
              </div>

              {/* CTR insight banner */}
              <div className={`mt-3 rounded-xl p-3.5 border ${
                summary.overall_ctr >= 3 ? 'bg-green-50 border-green-100' :
                summary.overall_ctr >= 1 ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
              }`}>
                <div className="flex items-start gap-2.5">
                  <span className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                    summary.overall_ctr >= 3 ? 'text-green-600' :
                    summary.overall_ctr >= 1 ? 'text-amber-600' : 'text-blue-500'
                  }`}>
                    <IcInfo />
                  </span>
                  <div>
                    <p className={`text-xs font-semibold leading-snug ${
                      summary.overall_ctr >= 3 ? 'text-green-800' :
                      summary.overall_ctr >= 1 ? 'text-amber-800' : 'text-blue-800'
                    }`}>
                      {summary.overall_ctr >= 3
                        ? 'CTR nzuri sana — wateja wanaitika kwa matangazo yako'
                        : summary.overall_ctr >= 1
                        ? 'CTR ya wastani — matangazo yanafanya kazi vizuri'
                        : 'CTR bado iko chini — jaribu kuongeza picha na maelezo mazuri'}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${
                      summary.overall_ctr >= 3 ? 'text-green-700' :
                      summary.overall_ctr >= 1 ? 'text-amber-700' : 'text-blue-700'
                    }`}>
                      Kati ya watu 100 wanaokiona tangazo lako, <strong>{summary.overall_ctr}</strong> wanachukua hatua. CTR nzuri ni zaidi ya 2%.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Per-campaign stats */}
            {campaigns.length > 0 && (
              <section>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Ufanisi kwa Kila Kampeni</p>
                <div className="space-y-3">
                  {campaigns.map(c => {
                    const sc = STATUS_CFG[c.status] ?? { label: c.status, cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300', stripe: 'bg-gray-200' }
                    const imprPct = maxImpr > 0 ? Math.round((c.impressions / maxImpr) * 100) : 0

                    return (
                      <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Status stripe */}
                        <div className={`h-1 ${sc.stripe}`} />

                        <div className="p-4">
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 p-2">
                                <AdTypeIcon type={c.ad_type} className="w-full h-full" />
                              </span>
                              <div className="min-w-0">
                                <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{c.title}</h3>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.cls}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                                    {sc.label}
                                  </span>
                                  {c.plan && (
                                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                      {c.plan.name}
                                    </span>
                                  )}
                                  {CTA_LABELS[c.cta_type] && (
                                    <span className="text-[10px] text-gray-400">{CTA_LABELS[c.cta_type]}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Days remaining pill */}
                            {c.days_remaining !== null && c.status === 'active' && (
                              <div className={`flex-shrink-0 px-2.5 py-1.5 rounded-xl text-center border ${
                                c.days_remaining <= 3
                                  ? 'bg-red-50 border-red-100'
                                  : 'bg-primary-50 border-primary-100'
                              }`}>
                                <p className={`text-lg font-bold leading-none tabular-nums ${
                                  c.days_remaining <= 3 ? 'text-red-600' : 'text-primary-700'
                                }`}>{c.days_remaining}</p>
                                <p className={`text-[9px] font-medium ${
                                  c.days_remaining <= 3 ? 'text-red-500' : 'text-primary-500'
                                }`}>siku</p>
                              </div>
                            )}
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                              <p className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{fmtNum(c.impressions)}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">Maoni</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                              <p className="text-lg font-bold text-blue-700 tabular-nums leading-tight">{fmtNum(c.clicks)}</p>
                              <p className="text-[10px] text-blue-500 mt-0.5">Clicks</p>
                            </div>
                            <div className={`rounded-xl p-2.5 text-center ${
                              c.ctr >= 3 ? 'bg-green-50' : c.ctr >= 1 ? 'bg-amber-50' : 'bg-gray-50'
                            }`}>
                              <p className={`text-lg font-bold tabular-nums leading-tight ${
                                c.ctr >= 3 ? 'text-green-700' : c.ctr >= 1 ? 'text-amber-700' : 'text-gray-500'
                              }`}>{c.ctr}%</p>
                              <p className={`text-[10px] mt-0.5 ${
                                c.ctr >= 3 ? 'text-green-500' : c.ctr >= 1 ? 'text-amber-500' : 'text-gray-400'
                              }`}>CTR</p>
                            </div>
                          </div>

                          {/* Impression progress bar */}
                          {c.impressions > 0 && (
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] text-gray-400">Maoni ya kampeni hii</p>
                                <p className="text-[10px] font-semibold text-gray-500 tabular-nums">{imprPct}% ya bora zaidi</p>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${imprPct}%` }} />
                              </div>
                            </div>
                          )}

                          {/* No impressions notice */}
                          {c.impressions === 0 && (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-3.5 h-3.5 flex-shrink-0 text-amber-500"><IcClock /></span>
                                <p className="text-[11px] text-amber-700">
                                  {c.status === 'active'
                                    ? 'Kampeni imewashwa hivi karibuni — data itaonekana hivi karibuni.'
                                    : c.status === 'pending_review'
                                    ? 'Inasubiri idhini — maoni yataanza baada ya kuidhinishwa.'
                                    : 'Hakuna data ya maoni kwa kampeni hii.'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Date range */}
                          {(c.starts_at || c.expires_at) && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="w-3 h-3 text-gray-300 flex-shrink-0"><IcClock /></span>
                              <p className="text-[10px] text-gray-400">
                                {c.starts_at && `Ilianza: ${new Date(c.starts_at).toLocaleDateString('sw-TZ')}`}
                                {c.starts_at && c.expires_at && '  ·  '}
                                {c.expires_at && `Inaisha: ${new Date(c.expires_at).toLocaleDateString('sw-TZ')}`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Empty state */}
            {campaigns.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 text-center py-16">
                <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center p-3 text-gray-400">
                  <IcBriefcase />
                </div>
                <p className="font-semibold text-gray-600">Bado hauna kampeni</p>
                <p className="text-sm text-gray-400 mt-1 mb-4">Unda tangazo lako la kwanza ili uone analytics</p>
                <Link href="/advertising/new"
                  className="inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition">
                  <span className="w-4 h-4"><IcPlus /></span>
                  Unda Kampeni
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom nav — SVG icons, no emojis */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">
        <div className="flex justify-around max-w-2xl mx-auto px-2 py-2">
          {([
            { href: '/advertising/dashboard', icon: <IcHome />,      label: 'Nyumbani'     },
            { href: '/advertising/analytics', icon: <IcChart />,     label: 'Analytics', active: true },
            { href: '/advertising/new',       icon: <IcPlus />,      label: 'Kampeni Mpya' },
            { href: '/advertising/profile',   icon: <IcUser />,      label: 'Wasifu'       },
          ] as { href: string; icon: React.ReactNode; label: string; active?: boolean }[]).map(n => (
            <Link key={n.href} href={n.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition ${
                n.active ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="w-5 h-5">{n.icon}</span>
              <span className="text-[10px] font-medium">{n.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
