'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Summary = { total_campaigns: number; active_campaigns: number; total_impressions: number; total_clicks: number; overall_ctr: number }
type CampaignStat = {
  id: string; title: string; ad_type: string; status: string
  impressions: number; clicks: number; ctr: number
  cta_type: string; starts_at: string | null; expires_at: string | null; days_remaining: number | null
  plan: { name: string; price_tzs: number; duration_days: number } | null
}

const TYPE_ICONS: Record<string, string> = { banner: '🎯', search: '🔍', nearby: '📍', video: '🎬', featured: '⭐', bundle: '📦', directory: '🏪' }
const CTA_LABELS: Record<string, string>  = { whatsapp: '📲 WhatsApp', call: '📞 Simu', website: '🌐 Tovuti' }
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active:         { label: 'Inafanya Kazi',    cls: 'bg-green-100 text-green-700' },
  approved:       { label: 'Imeidhinishwa',    cls: 'bg-blue-100 text-blue-700' },
  pending_review: { label: 'Inasubiri',        cls: 'bg-amber-100 text-amber-700' },
  expired:        { label: 'Imekwisha',        cls: 'bg-gray-100 text-gray-500' },
  rejected:       { label: 'Imekataliwa',      cls: 'bg-red-100 text-red-600' },
  paused:         { label: 'Imesimamishwa',    cls: 'bg-gray-100 text-gray-500' },
  suspended:      { label: 'Imezuiwa',         cls: 'bg-red-100 text-red-600' },
}

function fmtNum(n: number) { return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n) }

function StatBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function AdvertiserAnalyticsPage() {
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    fetch('/api/v1/advertising/analytics')
      .then(async r => {
        if (!r.ok) throw new Error('Hitilafu ya seva')
        return r.json()
      })
      .then(d => { setSummary(d.summary); setCampaigns(d.campaigns ?? []) })
      .catch(() => setError('Imeshindwa kupakua data. Jaribu tena.'))
      .finally(() => setLoading(false))
  }, [])

  const maxImpr = Math.max(...campaigns.map(c => c.impressions), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/advertising/dashboard" className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 flex-shrink-0">←</Link>
          <div>
            <h1 className="text-base font-bold text-gray-900">📊 Analytics ya Matangazo</h1>
            <p className="text-xs text-gray-400">Ufanisi wa matangazo yako</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-6">

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600 text-center">{error}</div>
        )}

        {!loading && !error && summary && (
          <>
            {/* ── Summary KPIs ── */}
            <section>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Muhtasari wa Jumla</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs text-gray-400 mb-1">Maoni Yote (Impressions)</p>
                  <p className="text-2xl font-bold text-primary-600">{fmtNum(summary.total_impressions)}</p>
                  <p className="text-xs text-gray-400 mt-1">mara tangazo lilioonekana</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs text-gray-400 mb-1">Mibonyezo (Clicks / Actions)</p>
                  <p className="text-2xl font-bold text-blue-600">{fmtNum(summary.total_clicks)}</p>
                  <p className="text-xs text-gray-400 mt-1">mara mtu alichukua hatua</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs text-gray-400 mb-1">CTR ya Jumla</p>
                  <p className={`text-2xl font-bold ${summary.overall_ctr >= 3 ? 'text-green-600' : summary.overall_ctr >= 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {summary.overall_ctr}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">click-through rate</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs text-gray-400 mb-1">Kampeni Zinazoendeshwa</p>
                  <p className="text-2xl font-bold text-green-600">{summary.active_campaigns}</p>
                  <p className="text-xs text-gray-400 mt-1">kati ya {summary.total_campaigns} zote</p>
                </div>
              </div>

              {/* CTR guide */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mt-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">CTR inamaanisha nini?</p>
                <p className="text-xs text-blue-600">Kila mtu 100 wanaokiona tangazo lako, <b>{summary.overall_ctr}</b> wanabonyeza. CTR nzuri ni &gt;2%. Kadri CTR inavyokuwa juu, ndivyo tangazo lako linavyovutia zaidi.</p>
              </div>
            </section>

            {/* ── Per-Campaign Stats ── */}
            {campaigns.length > 0 && (
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Ufanisi kwa Kila Kampeni</p>
                <div className="space-y-3">
                  {campaigns.map(c => {
                    const sc = STATUS_CFG[c.status]
                    return (
                      <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        {/* Campaign header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm">{TYPE_ICONS[c.ad_type] ?? '📢'}</span>
                              <h3 className="font-bold text-gray-900 text-sm truncate">{c.title}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                                {sc?.label ?? c.status}
                              </span>
                              {c.plan && <span className="text-[10px] text-gray-400">{c.plan.name}</span>}
                              {CTA_LABELS[c.cta_type] && (
                                <span className="text-[10px] text-gray-400">{CTA_LABELS[c.cta_type]}</span>
                              )}
                            </div>
                          </div>
                          {c.days_remaining !== null && c.status === 'active' && (
                            <div className={`text-center flex-shrink-0 px-2 py-1 rounded-xl ${c.days_remaining <= 3 ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                              <p className={`text-lg font-bold leading-none ${c.days_remaining <= 3 ? 'text-red-600' : 'text-green-600'}`}>{c.days_remaining}</p>
                              <p className={`text-[9px] font-medium ${c.days_remaining <= 3 ? 'text-red-500' : 'text-green-500'}`}>siku zilizobaki</p>
                            </div>
                          )}
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center bg-gray-50 rounded-xl p-2">
                            <p className="text-lg font-bold text-gray-800">{fmtNum(c.impressions)}</p>
                            <p className="text-[10px] text-gray-400">Maoni</p>
                          </div>
                          <div className="text-center bg-gray-50 rounded-xl p-2">
                            <p className="text-lg font-bold text-blue-700">{fmtNum(c.clicks)}</p>
                            <p className="text-[10px] text-gray-400">Hatua Zilizochukuliwa</p>
                          </div>
                          <div className={`text-center rounded-xl p-2 ${c.ctr >= 3 ? 'bg-green-50' : c.ctr >= 1 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                            <p className={`text-lg font-bold ${c.ctr >= 3 ? 'text-green-700' : c.ctr >= 1 ? 'text-amber-700' : 'text-gray-500'}`}>{c.ctr}%</p>
                            <p className="text-[10px] text-gray-400">CTR</p>
                          </div>
                        </div>

                        {/* Impression bar */}
                        {c.impressions > 0 && (
                          <div className="mb-2">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                              <span>Maoni ya kampeni hii</span>
                              <span>{Math.round((c.impressions / maxImpr) * 100)}% ya bora zaidi</span>
                            </div>
                            <StatBar value={c.impressions} max={maxImpr} />
                          </div>
                        )}

                        {/* Date range */}
                        {(c.starts_at || c.expires_at) && (
                          <p className="text-[10px] text-gray-400 mt-2">
                            {c.starts_at && `Ilianza: ${new Date(c.starts_at).toLocaleDateString('sw-TZ')}`}
                            {c.starts_at && c.expires_at && '  ·  '}
                            {c.expires_at && `Inaisha: ${new Date(c.expires_at).toLocaleDateString('sw-TZ')}`}
                          </p>
                        )}

                        {/* No data state */}
                        {c.impressions === 0 && (
                          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-2">
                            <p className="text-xs text-amber-700">
                              {c.status === 'active' ? '⏳ Kampeni imewashwa hivi karibuni — data itaonekana hivi karibuni.' :
                               c.status === 'pending_review' ? '⏳ Kampeni inasubiri idhini — maoni yataanza baada ya kuidhinishwa.' :
                               '📊 Hakuna data ya maoni kwa kampeni hii.'}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {campaigns.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 text-center py-16">
                <div className="text-4xl mb-3">📢</div>
                <p className="font-semibold text-gray-600">Bado hauna kampeni</p>
                <p className="text-sm text-gray-400 mt-1 mb-4">Unda tangazo lako la kwanza ili uone analytics</p>
                <Link href="/advertising/new" className="inline-block bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition">
                  + Unda Kampeni
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-20">
        <div className="flex justify-around max-w-2xl mx-auto">
          {[
            { href: '/advertising/dashboard', icon: '🏠', label: 'Nyumbani' },
            { href: '/advertising/analytics', icon: '📊', label: 'Analytics', active: true },
            { href: '/advertising/new', icon: '➕', label: 'Kampeni Mpya' },
            { href: '/advertising/profile', icon: '👤', label: 'Wasifu' },
          ].map(n => (
            <Link key={n.href} href={n.href}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition ${n.active ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <span className="text-xl">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
