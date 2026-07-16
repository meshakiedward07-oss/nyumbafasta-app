'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type AccountStats = {
  totalListings:  number
  activeListings: number
  listingViews:   number
  totalContacts:  number
  thisMonthContacts: number
  ratingAvg:      number
  ratingCount:    number
  username:       string | null
}

type MicrositeStats = {
  viewsToday:    number
  viewsWeek:     number
  viewsMonth:    number
  viewsTotal:    number
  whatsappClicks: number
  shareCount:    number
  sources:       Record<string, number>
  clicks:        Record<string, number>
}

type MonthlyContact = { label: string; count: number }

type UnlockContact = {
  id: string
  created_at: string
  listing: { title: string | null; region: string } | null
  client:  { full_name: string; phone: string } | null
}

type TopListing = {
  id: string
  title: string | null
  type: string
  district: string
  view_count: number
  lead_count: number
}

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  is_verified: boolean
  response: string | null
  response_at: string | null
  reviewer: { full_name: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'leo'
  if (days === 1) return 'jana'
  if (days < 7)  return `siku ${days} zilizopita`
  if (days < 30) return `wiki ${Math.floor(days / 7)} zilizopita`
  return `mwezi ${Math.floor(days / 30)} uliopita`
}

const SOURCE_LABELS: Record<string, string> = {
  direct:    'Moja kwa moja',
  whatsapp:  'WhatsApp',
  facebook:  'Facebook',
  instagram: 'Instagram',
  google:    'Google',
  twitter:   'Twitter/X',
  tiktok:    'TikTok',
  other:     'Nyingine',
}

const MONTHS_SW = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ago','Sep','Okt','Nov','Des']

// ── Main component ─────────────────────────────────────────────────────────────

export default function DalaliCRMClient() {
  const supabase = createClient()

  const [account,    setAccount]    = useState<AccountStats | null>(null)
  const [microsite,  setMicrosite]  = useState<MicrositeStats | null>(null)
  const [monthly,    setMonthly]    = useState<MonthlyContact[]>([])
  const [contacts,   setContacts]   = useState<UnlockContact[]>([])
  const [topListings, setTopListings] = useState<TopListing[]>([])
  const [reviews,    setReviews]    = useState<Review[]>([])
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState<'overview' | 'microsite' | 'contacts' | 'maoni'>('overview')
  const [replyId,    setReplyId]    = useState<string | null>(null)
  const [replyText,  setReplyText]  = useState('')
  const [replyLoading, setReplyLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const startOfMonth = new Date()
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)

    // 6-month window for growth trend
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0, 0, 0, 0)

    const [
      listingsRes, profileRes, userRes,
      totalContactsRes, monthContactsRes,
      allContactsRes, recentContactsRes,
      reviewsRes,
    ] = await Promise.all([
      supabase.from('listings')
        .select('id, title, type, status, district, view_count, lead_count')
        .eq('dalali_id', user.id),
      supabase.from('dalali_profiles')
        .select('rating_avg, rating_count')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('users')
        .select('username')
        .eq('id', user.id)
        .single(),
      supabase.from('contact_unlocks')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', user.id),
      supabase.from('contact_unlocks')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', user.id)
        .gte('created_at', startOfMonth.toISOString()),
      // all unlocks in last 6 months for growth chart
      supabase.from('contact_unlocks')
        .select('created_at')
        .eq('dalali_id', user.id)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true }),
      // recent 30 contacts for list
      supabase.from('contact_unlocks')
        .select(`id, created_at,
          listing:listing_id(title, region),
          client:client_id(full_name, phone)`)
        .eq('dalali_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      // reviews
      supabase.from('reviews')
        .select('id, rating, comment, created_at, is_verified, response, response_at, reviewer:reviewer_id(full_name)')
        .eq('dalali_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const listings = listingsRes.data ?? []
    const active   = listings.filter(l => l.status === 'active')
    const topByViews = [...listings]
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
      .slice(0, 3)

    setAccount({
      totalListings:     listings.length,
      activeListings:    active.length,
      listingViews:      listings.reduce((s, l) => s + (l.view_count ?? 0), 0),
      totalContacts:     totalContactsRes.count ?? 0,
      thisMonthContacts: monthContactsRes.count ?? 0,
      ratingAvg:         profileRes.data?.rating_avg   ?? 0,
      ratingCount:       profileRes.data?.rating_count ?? 0,
      username:          userRes.data?.username ?? null,
    })

    setTopListings(topByViews as TopListing[])
    setContacts((recentContactsRes.data as unknown as UnlockContact[]) ?? [])
    setReviews((reviewsRes.data as unknown as Review[]) ?? [])

    // Build 6-month trend
    const buckets: Record<string, number> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
    }
    for (const row of allContactsRes.data ?? []) {
      const d = new Date(row.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (key in buckets) buckets[key]++
    }
    setMonthly(Object.entries(buckets).map(([key, count]) => ({
      label: MONTHS_SW[parseInt(key.split('-')[1]) - 1],
      count,
    })))

    // Microsite analytics
    fetch('/api/v1/profile/analytics')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.viewsTotal === 'number') setMicrosite(d) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function submitReply(reviewId: string) {
    if (!replyText.trim()) return
    setReplyLoading(true)
    try {
      const res = await fetch(`/api/v1/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', response: replyText }),
      })
      if (!res.ok) throw new Error()
      const now = new Date().toISOString()
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, response: replyText, response_at: now } : r
      ))
      setReplyId(null)
      setReplyText('')
    } catch {
      // non-fatal — keep UI open
    } finally {
      setReplyLoading(false)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-primary-600 px-4 pt-5 pb-6">
          <div className="h-6 w-40 bg-white/20 rounded-lg mb-4 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-white/20 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
        <div className="px-4 mt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const maxMonthly = Math.max(...monthly.map(m => m.count), 1)

  // ── Sources sorted by count ────────────────────────────────────────────────
  const sourcesArr = Object.entries(microsite?.sources ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxSource = Math.max(...sourcesArr.map(s => s[1]), 1)

  // ── Rating breakdown ───────────────────────────────────────────────────────
  const ratingAvg   = account?.ratingAvg   ?? 0
  const ratingCount = account?.ratingCount ?? 0
  const fiveStar    = reviews.filter(r => r.rating === 5).length

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 px-4 pt-5 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Takwimu Zangu</h1>
            <p className="text-green-100 text-xs mt-0.5">Fuatilia ukuaji wako</p>
          </div>
          <button
            onClick={load}
            className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-white"
          >
            <i className="ti ti-refresh text-base" aria-hidden="true" />
          </button>
        </div>

        {/* 4 hero stat tiles */}
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            icon="ti-eye"
            label="Waliotazama Microsite"
            value={fmtNum(microsite?.viewsMonth ?? 0)}
            sub="mwezi huu"
          />
          <StatTile
            icon="ti-users"
            label="Contacts Zilizofunguliwa"
            value={fmtNum(account?.totalContacts ?? 0)}
            sub={`+${account?.thisMonthContacts ?? 0} mwezi huu`}
          />
          <StatTile
            icon="ti-home"
            label="Listings Hai"
            value={`${account?.activeListings ?? 0}/${account?.totalListings ?? 0}`}
            sub="active / zote"
          />
          <StatTile
            icon="ti-star"
            label="Rating"
            value={ratingCount ? ratingAvg.toFixed(1) : '—'}
            sub={ratingCount ? `${ratingCount} maoni` : 'Bado'}
          />
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm overflow-x-auto scrollbar-none">
        {([
          { key: 'overview',  label: 'Muhtasari', icon: 'ti-layout-dashboard' },
          { key: 'microsite', label: 'Microsite',  icon: 'ti-world'            },
          { key: 'contacts',  label: 'Contacts',   icon: 'ti-address-book'     },
          { key: 'maoni',     label: 'Maoni',      icon: 'ti-star'             },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 min-w-[72px] flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-400'
            }`}
          >
            <i className={`ti ${tab.icon} text-base`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ══ OVERVIEW TAB ════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Growth trend — 6 months */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <i className="ti ti-trending-up text-primary-500" aria-hidden="true" />
                Ukuaji wa Contacts — Miezi 6
              </p>
              <p className="text-xs text-gray-400 mb-4">Wateja waliofungua mawasiliano yako kila mwezi</p>
              <div className="flex items-end gap-2 h-28">
                {monthly.map((m, i) => {
                  const pct = maxMonthly > 0 ? Math.max(4, Math.round((m.count / maxMonthly) * 100)) : 4
                  const isLast = i === monthly.length - 1
                  return (
                    <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-gray-600">{m.count > 0 ? m.count : ''}</span>
                      <div className="w-full relative">
                        <div
                          style={{ height: `${pct}%`, minHeight: 4, maxHeight: 80 }}
                          className={`w-full rounded-t-md transition-all ${
                            isLast ? 'bg-primary-500' : 'bg-primary-200'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{m.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Listing views summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <i className="ti ti-list-details text-primary-500" aria-hidden="true" />
                Listings Bora Zaidi
              </p>
              {topListings.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Bado huna listings</p>
              ) : (
                <div className="space-y-2">
                  {topListings.map((l, i) => (
                    <Link
                      key={l.id}
                      href={`/listings/${l.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-700'
                        : i === 1 ? 'bg-gray-100 text-gray-600'
                        : 'bg-orange-50 text-orange-600'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {l.title ?? `${l.type} – ${l.district}`}
                        </p>
                        <p className="text-[11px] text-gray-400">{l.district}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-gray-700">{fmtNum(l.view_count ?? 0)}</p>
                        <p className="text-[10px] text-gray-400">maoni</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Microsite quick stats preview (no link — full data is in the Microsite tab) */}
            {microsite && (
              <button
                onClick={() => setActiveTab('microsite')}
                className="w-full bg-gradient-to-r from-primary-50 to-green-50 border border-primary-100 rounded-2xl p-4 text-left"
              >
                <p className="text-xs font-semibold text-primary-700 mb-2 flex items-center gap-1.5">
                  <i className="ti ti-world" aria-hidden="true" />
                  Microsite — Maoni Mwezi Huu
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary-700">{fmtNum(microsite.viewsToday)}</p>
                    <p className="text-[10px] text-primary-500">Leo</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary-700">{fmtNum(microsite.viewsWeek)}</p>
                    <p className="text-[10px] text-primary-500">Wiki Hii</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary-700">{fmtNum(microsite.viewsMonth)}</p>
                    <p className="text-[10px] text-primary-500">Mwezi</p>
                  </div>
                </div>
                <p className="text-[10px] text-primary-400 mt-2 text-right flex items-center justify-end gap-1">
                  Angalia microsite kamili <i className="ti ti-arrow-right text-[10px]" aria-hidden="true" />
                </p>
              </button>
            )}
          </>
        )}

        {/* ══ MICROSITE TAB ═══════════════════════════════════════════════════ */}
        {activeTab === 'microsite' && (
          <>
            {!microsite ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <i className="ti ti-world-off text-3xl text-gray-300 block mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-500">Data ya microsite haipatikani</p>
                <p className="text-xs text-gray-400 mt-1">
                  Hakikisha migration ya <code className="bg-gray-100 px-1 rounded">agent_microsite</code> imefanywa kwenye Supabase
                </p>
              </div>
            ) : (
              <>
                {/* Views grid */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <i className="ti ti-eye text-primary-500" aria-hidden="true" />
                    Waliotazama Ukurasa Wako
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <ViewTile label="Leo"       value={microsite.viewsToday}  accent="blue"    />
                    <ViewTile label="Wiki Hii"  value={microsite.viewsWeek}   accent="indigo"  />
                    <ViewTile label="Mwezi Huu" value={microsite.viewsMonth}  accent="primary" />
                    <ViewTile label="Jumla"     value={microsite.viewsTotal}  accent="green"   />
                  </div>
                </div>

                {/* Engagement */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <i className="ti ti-hand-click text-primary-500" aria-hidden="true" />
                    Mwingiliano (mwezi huu)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <EngTile icon="ti-brand-whatsapp" color="text-green-600 bg-green-50"
                      label="WA Clicks" value={microsite.whatsappClicks} />
                    <EngTile icon="ti-share" color="text-blue-600 bg-blue-50"
                      label="Shiriki" value={microsite.shareCount} />
                    <EngTile icon="ti-home" color="text-primary-600 bg-primary-50"
                      label="Listings" value={microsite.clicks['listing_view'] ?? 0} />
                  </div>
                </div>

                {/* Traffic sources */}
                {sourcesArr.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <i className="ti ti-chart-bar text-primary-500" aria-hidden="true" />
                      Chanzo cha Wageni (mwezi huu)
                    </p>
                    <div className="space-y-3">
                      {sourcesArr.map(([src, count]) => {
                        const pct = Math.round((count / maxSource) * 100)
                        const total = sourcesArr.reduce((s, [, c]) => s + c, 0)
                        return (
                          <div key={src}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-700 font-medium">{SOURCE_LABELS[src] ?? src}</span>
                              <span className="text-gray-500">{count} ({total > 0 ? Math.round(count / total * 100) : 0}%)</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Conversion rate */}
                {microsite.viewsMonth > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1.5">
                      <i className="ti ti-percentage" aria-hidden="true" />
                      Kiwango cha Ubadilishaji
                    </p>
                    <p className="text-3xl font-bold text-amber-800">
                      {microsite.viewsMonth > 0
                        ? ((microsite.whatsappClicks / microsite.viewsMonth) * 100).toFixed(1)
                        : '0.0'}%
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {microsite.whatsappClicks} WA click kati ya {microsite.viewsMonth} maoni mwezi huu
                    </p>
                  </div>
                )}

                {/* Total all-time */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <i className="ti ti-infinity text-primary-500" aria-hidden="true" />
                    Jumla ya Wakati Wote
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-800">{fmtNum(microsite.viewsTotal)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Maoni yote</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-800">{fmtNum(microsite.whatsappClicks)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">WA clicks</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-800">{fmtNum(account?.totalContacts ?? 0)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Contacts</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ CONTACTS TAB ════════════════════════════════════════════════════ */}
        {activeTab === 'contacts' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Wateja {contacts.length > 0 ? `wa hivi karibuni (${contacts.length})` : ''}
              </p>
              {account && account.totalContacts > 30 && (
                <span className="text-xs text-amber-600 font-medium">
                  Inaonyesha 30 za hivi karibuni
                </span>
              )}
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <i className="ti ti-mail-opened text-3xl text-gray-300 block mb-2" aria-hidden="true" />
                <p className="text-gray-500 font-medium text-sm">Hakuna contacts bado</p>
                <p className="text-gray-400 text-xs mt-1">
                  Wateja wataonekana hapa baada ya kufungua mawasiliano yako
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">
                          {c.client?.full_name ?? 'Mteja'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          <i className="ti ti-home text-[11px]" aria-hidden="true" />{' '}
                          {c.listing?.title ?? 'Listing'}{' '}
                          · <i className="ti ti-map-pin text-[11px]" aria-hidden="true" />{' '}
                          {c.listing?.region ?? '—'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          <i className="ti ti-calendar text-[11px]" aria-hidden="true" />{' '}
                          {new Date(c.created_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      {c.client?.phone && (
                        <a
                          href={`https://wa.me/${c.client.phone.replace(/\D/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 bg-[#25D366] text-white text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1"
                        >
                          <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                          WA
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ MAONI TAB ═══════════════════════════════════════════════════════ */}
        {activeTab === 'maoni' && (
          <>
            {/* Rating summary */}
            {ratingCount > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="text-center flex-shrink-0">
                    <p className="text-4xl font-bold text-gray-900">{ratingAvg.toFixed(1)}</p>
                    <div className="flex gap-0.5 justify-center mt-1">
                      {[1,2,3,4,5].map(i => (
                        <i key={i} className={`ti ti-star-filled text-sm ${i <= Math.round(ratingAvg) ? 'text-amber-400' : 'text-gray-200'}`} aria-hidden="true" />
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{ratingCount} maoni</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5,4,3,2,1].map(star => {
                      const count = reviews.filter(r => r.rating === star).length
                      const pct   = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-3">{star}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 w-3 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {fiveStar > 0 && (
                  <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2 flex items-center gap-2">
                    <i className="ti ti-star-filled text-amber-400 text-sm" aria-hidden="true" />
                    <p className="text-xs text-amber-700 font-medium">{fiveStar} kati ya {ratingCount} wamekupa nyota 5!</p>
                  </div>
                )}
              </div>
            )}

            {/* Reviews list */}
            {reviews.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <i className="ti ti-star-off text-3xl text-gray-300 block mb-2" aria-hidden="true" />
                <p className="text-gray-500 font-medium text-sm">Hakuna maoni bado</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-[200px] mx-auto">
                  Wateja wataandika maoni baada ya kukupata kupitia listing yako
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                          {r.reviewer?.full_name?.[0] ?? 'W'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">
                            {r.reviewer?.full_name ?? 'Mteja'}
                            {r.is_verified && (
                              <i className="ti ti-circle-check text-primary-500 text-[11px] ml-1" aria-hidden="true" />
                            )}
                          </p>
                          <p className="text-[10px] text-gray-400">{timeAgo(r.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 flex-shrink-0">
                        {[1,2,3,4,5].map(i => (
                          <i key={i} className={`ti ti-star-filled text-xs ${i <= r.rating ? 'text-amber-400' : 'text-gray-200'}`} aria-hidden="true" />
                        ))}
                      </div>
                    </div>

                    {r.comment && (
                      <p className="text-xs text-gray-600 leading-relaxed mb-3">{r.comment}</p>
                    )}

                    {/* Dalali reply */}
                    {r.response ? (
                      <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 mt-2">
                        <p className="text-[10px] font-semibold text-primary-700 mb-1 flex items-center gap-1">
                          <i className="ti ti-corner-down-right text-[10px]" aria-hidden="true" />
                          Jibu lako
                        </p>
                        <p className="text-xs text-primary-800 leading-relaxed">{r.response}</p>
                      </div>
                    ) : (
                      replyId === r.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Andika jibu lako..."
                            rows={3}
                            className="w-full text-xs rounded-xl border border-gray-200 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary-400"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitReply(r.id)}
                              disabled={replyLoading || !replyText.trim()}
                              className="flex-1 py-2 bg-primary-500 text-white text-xs font-semibold rounded-xl disabled:opacity-40"
                            >
                              {replyLoading ? 'Inatuma...' : 'Tuma Jibu'}
                            </button>
                            <button
                              onClick={() => { setReplyId(null); setReplyText('') }}
                              className="px-3 py-2 border border-gray-200 text-gray-500 text-xs rounded-xl"
                            >
                              Ghairi
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setReplyId(r.id); setReplyText('') }}
                          className="mt-1 text-[11px] text-primary-600 font-medium flex items-center gap-1"
                        >
                          <i className="ti ti-corner-down-right text-[11px]" aria-hidden="true" />
                          Jibu Maoni Haya
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}

// ── Small sub-components ───────────────────────────────────────────────────────

function StatTile({ icon, label, value, sub }: {
  icon: string; label: string; value: string; sub: string
}) {
  return (
    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3">
      <i className={`ti ${icon} text-white/70 text-base`} aria-hidden="true" />
      <p className="text-white font-bold text-xl mt-0.5 leading-none">{value}</p>
      <p className="text-green-100 text-[11px] font-medium leading-tight mt-0.5">{label}</p>
      <p className="text-white/50 text-[10px] mt-0.5">{sub}</p>
    </div>
  )
}

function ViewTile({ label, value, accent }: {
  label: string; value: number
  accent: 'blue' | 'indigo' | 'primary' | 'green'
}) {
  const colors = {
    blue:    'bg-blue-50 text-blue-700',
    indigo:  'bg-indigo-50 text-indigo-700',
    primary: 'bg-primary-50 text-primary-700',
    green:   'bg-green-50 text-green-700',
  }
  return (
    <div className={`rounded-xl p-3 text-center ${colors[accent]}`}>
      <p className="text-2xl font-bold leading-none">{fmtNum(value)}</p>
      <p className="text-[11px] font-medium mt-1 opacity-80">{label}</p>
    </div>
  )
}

function EngTile({ icon, color, label, value }: {
  icon: string; color: string; label: string; value: number
}) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mx-auto mb-1.5`}>
        <i className={`ti ${icon} text-base`} aria-hidden="true" />
      </div>
      <p className="text-base font-bold text-gray-800">{fmtNum(value)}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
