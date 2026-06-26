'use client'
import { useState, useEffect, useCallback } from 'react'
import VideoUploadTab from './VideoUploadTab'
import GroupsTab from './GroupsTab'
import StoriesTab from './StoriesTab'
import CarouselTab from './CarouselTab'
import SpamTab from './SpamTab'
import BestTimeTab from './BestTimeTab'
import MarketplaceTab from './MarketplaceTab'
import TikTokTab from './TikTokTab'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'yote' | 'overview' | 'posts' | 'upload' | 'groups' | 'stories' | 'carousel' | 'marketplace' | 'spam' | 'besttime' | 'comments' | 'dms' | 'postnow' | 'schedule' | 'tiktok'

type UnifiedPlatformStat = {
  platform: string; label?: string; totalPosts: number; successPosts: number; failedPosts: number
  totalViews: number; totalLikes: number; totalComments: number; totalShares: number; lastPostAt: string | null
}
type UnifiedTotals = { posts: number; views: number; likes: number; comments: number; shares: number }
type UnifiedRecentPost = { id: string; platform: string; status: string; postId: string | null; created_at: string | null; listing_id: string | null }
type PlatformConnection = { platform: string; label: string; is_connected: boolean }

type SocialStats = {
  totalPosts: number; publishedPosts: number
  totalComments: number; unrepliedComments: number
  totalDMs: number; unrepliedDMs: number
  postsThisWeek: number; commentsToday: number
}

type SocialPost = {
  id: string; platform: string; media_type: string; caption: string
  status: string; published_at: string | null; created_at: string
  instagram_post_id: string | null; facebook_post_id: string | null
  metrics: Record<string, number> | null
  listings: { title: string; type: string; district: string; region: string } | null
}

type Comment = {
  id: string; platform: string; comment_id: string; commenter_name: string | null
  comment_text: string; comment_type: string; reply_sent: boolean; reply_text: string | null
  created_at: string
}

type DM = {
  id: string; platform: string; sender_id: string; sender_name: string | null
  message_text: string; reply_sent: boolean; reply_text: string | null; created_at: string
}

type Listing = {
  id: string; title: string; type: string; district: string; region: string
  images: string[]; status: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: 'bg-green-100 text-green-700',
    pending:   'bg-yellow-100 text-yellow-700',
    failed:    'bg-red-100 text-red-700',
    publishing:'bg-blue-100 text-blue-700',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

function CommentTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    inquiry:  'bg-blue-100 text-blue-700',
    interest: 'bg-green-100 text-green-700',
    negative: 'bg-red-100 text-red-700',
    spam:     'bg-gray-100 text-gray-500',
    question: 'bg-purple-100 text-purple-700',
    praise:   'bg-emerald-100 text-emerald-700',
    unknown:  'bg-gray-100 text-gray-600',
  }
  const labels: Record<string, string> = {
    inquiry: 'Inquiry', interest: 'Interest', negative: 'Negative',
    spam: 'Spam', question: 'Swali', praise: 'Sifa', unknown: '?',
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>{labels[type] ?? type}</span>
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'instagram') return <span className="text-pink-500">📸</span>
  if (platform === 'facebook') return <span className="text-blue-500">👤</span>
  return <span>🌐</span>
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SocialDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('yote')
  const [stats, setStats]         = useState<SocialStats | null>(null)
  const [posts, setPosts]         = useState<SocialPost[]>([])
  const [comments, setComments]   = useState<Comment[]>([])
  const [dms, setDMs]             = useState<DM[]>([])
  const [schedule, setSchedule]   = useState<unknown[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  // Unified tab state
  const [unifiedStats, setUnifiedStats]       = useState<{ platforms: UnifiedPlatformStat[]; totals: UnifiedTotals; recentPosts: UnifiedRecentPost[] } | null>(null)
  const [connections, setConnections]         = useState<PlatformConnection[]>([])
  const [unifiedPeriod, setUnifiedPeriod]     = useState<'today' | 'week' | 'month' | 'all'>('month')
  const [postAllListing, setPostAllListing]   = useState('')
  const [postAllLoading, setPostAllLoading]   = useState(false)

  // Post Now state
  const [listings, setListings]       = useState<Listing[]>([])
  const [selectedListing, setSelectedListing] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<'instagram' | 'facebook' | 'both'>('both')
  const [postMode, setPostMode]       = useState<'single' | 'carousel'>('single')
  const [generatedCaption, setGeneratedCaption] = useState('')
  const [generatedHashtags, setGeneratedHashtags] = useState('')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [postLoading, setPostLoading] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchUnified = useCallback(async (period: 'today' | 'week' | 'month' | 'all') => {
    setLoading(true)
    try {
      const [statsRes, connRes, listingsRes] = await Promise.all([
        fetch(`/api/v1/social/stats?period=${period}`),
        fetch('/api/v1/social/connections'),
        fetch('/api/v1/listings?status=active&limit=50'),
      ])
      const statsData = await statsRes.json() as { platforms: UnifiedPlatformStat[]; totals: UnifiedTotals; recentPosts: UnifiedRecentPost[] }
      const connData  = await connRes.json() as { platforms: PlatformConnection[] }
      const listData  = await listingsRes.json() as { listings?: Listing[] }
      setUnifiedStats(statsData)
      setConnections(connData.platforms ?? [])
      setListings(listData.listings ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchData = useCallback(async (tab: Tab) => {
    setLoading(true)
    try {
      if (tab === 'yote') {
        await fetchUnified(unifiedPeriod)
        setLoading(false)
        return
      } else if (tab === 'overview') {
        const res = await fetch('/api/v1/social/posts?tab=stats')
        const data = await res.json() as { stats: SocialStats }
        setStats(data.stats)
      } else if (tab === 'posts') {
        const res = await fetch('/api/v1/social/posts?tab=posts&limit=20')
        const data = await res.json() as { posts: SocialPost[]; total: number }
        setPosts(data.posts ?? [])
        setTotal(data.total ?? 0)
      } else if (tab === 'comments') {
        const res = await fetch('/api/v1/social/posts?tab=comments&limit=30')
        const data = await res.json() as { comments: Comment[]; total: number }
        setComments(data.comments ?? [])
        setTotal(data.total ?? 0)
      } else if (tab === 'dms') {
        const res = await fetch('/api/v1/social/posts?tab=dms&limit=30')
        const data = await res.json() as { dms: DM[]; total: number }
        setDMs(data.dms ?? [])
        setTotal(data.total ?? 0)
      } else if (tab === 'schedule') {
        const res = await fetch('/api/v1/social/posts?tab=schedule&limit=20')
        const data = await res.json() as { schedule: unknown[]; total: number }
        setSchedule(data.schedule ?? [])
        setTotal(data.total ?? 0)
      } else if (tab === 'postnow') {
        const res = await fetch('/api/v1/listings?status=active&limit=50')
        const data = await res.json() as { listings?: Listing[] }
        setListings(data.listings ?? [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [fetchUnified, unifiedPeriod])

  useEffect(() => {
    fetchData(activeTab)
  }, [activeTab, fetchData])

  useEffect(() => {
    if (activeTab === 'yote') fetchUnified(unifiedPeriod)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unifiedPeriod])

  async function handleGenerateCaption() {
    if (!selectedListing) { showToast('Chagua listing kwanza'); return }
    setCaptionLoading(true)
    try {
      const res = await fetch('/api/v1/social/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: selectedListing, platform: selectedPlatform === 'both' ? 'instagram' : selectedPlatform }),
      })
      const data = await res.json() as { caption?: string; hashtags?: string; error?: string }
      if (data.error) { showToast(`Hitilafu: ${data.error}`); return }
      setGeneratedCaption(data.caption ?? '')
      setGeneratedHashtags(data.hashtags ?? '')
    } finally {
      setCaptionLoading(false)
    }
  }

  async function handlePost() {
    if (!selectedListing) { showToast('Chagua listing kwanza'); return }
    setPostLoading(true)
    try {
      if (postMode === 'carousel') {
        const res = await fetch('/api/v1/social/carousel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: selectedListing }),
        })
        const data = await res.json() as { success?: boolean; slidesCount?: number; error?: string }
        if (data.error) { showToast(`Hitilafu: ${data.error}`); return }
        showToast(data.success ? `✅ Carousel imechapishwa! (Slides: ${data.slidesCount})` : 'Imeshindwa kuchapisha')
        setSelectedListing('')
        return
      }

      const body: Record<string, unknown> = {
        listingId: selectedListing,
        platform: selectedPlatform,
      }
      if (scheduledAt) body.scheduledAt = scheduledAt

      const res = await fetch('/api/v1/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { ok?: boolean; status?: string; scheduled?: boolean; error?: string }
      if (data.error) { showToast(`Hitilafu: ${data.error}`); return }
      if (data.scheduled) {
        showToast('Post imepangwa kwa mafanikio!')
      } else {
        showToast(data.status === 'published' ? 'Imechapishwa kwa mafanikio!' : `Imeshindwa: ${data.ok}`)
      }
      setGeneratedCaption('')
      setGeneratedHashtags('')
      setSelectedListing('')
    } finally {
      setPostLoading(false)
    }
  }

  async function handlePostAll() {
    if (!postAllListing) { showToast('Chagua listing kwanza'); return }
    setPostAllLoading(true)
    try {
      const res = await fetch('/api/v1/social/post-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: postAllListing }),
      })
      const data = await res.json() as { successCount?: number; failedCount?: number; results?: Array<{ platform: string; success: boolean; error?: string }>; error?: string }
      if (data.error) { showToast(`Hitilafu: ${data.error}`); return }
      showToast(`✅ ${data.successCount ?? 0} platforms zilipita${data.failedCount ? `, ❌ ${data.failedCount} zilishindwa` : ''}`)
      setPostAllListing('')
      fetchUnified(unifiedPeriod)
    } finally {
      setPostAllLoading(false)
    }
  }

  async function handleRefreshMetrics() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_metrics' }),
      })
      const data = await res.json() as { updated?: number; failed?: number }
      showToast(`Metrics zimesasishwa: ${data.updated ?? 0} posts`)
      fetchData('posts')
    } finally {
      setLoading(false)
    }
  }

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: 'yote',        label: 'Platforms Zote', emoji: '🌐' },
    { id: 'overview',    label: 'Muhtasari',   emoji: '📊' },
    { id: 'tiktok',      label: 'TikTok',      emoji: '🎵' },
    { id: 'posts',       label: 'Machapisho',  emoji: '📸' },
    { id: 'upload',      label: 'Pakia Video', emoji: '📹' },
    { id: 'groups',      label: 'Makundi',     emoji: '👥' },
    { id: 'stories',     label: 'Stories',     emoji: '🔴' },
    { id: 'carousel',    label: 'Carousel',    emoji: '🖼️' },
    { id: 'marketplace', label: 'Marketplace', emoji: '🛒' },
    { id: 'spam',        label: 'Spam',        emoji: '🚫' },
    { id: 'besttime',    label: 'Wakati Bora', emoji: '⏰' },
    { id: 'comments',    label: 'Maoni',       emoji: '💬' },
    { id: 'dms',         label: 'DMs',         emoji: '📨' },
    { id: 'postnow',     label: 'Chapisha',    emoji: '✍️' },
    { id: 'schedule',    label: 'Ratiba',      emoji: '📅' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Social Media</h1>
        <p className="text-sm text-gray-500 mt-0.5">TikTok, Instagram + Facebook automation — NyumbaFasta</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-white text-primary-500 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── PLATFORMS ZOTE (unified) ── */}
      {activeTab === 'yote' && (
        <div className="space-y-6">

          {/* Connection status row */}
          <div className="grid grid-cols-3 gap-4">
            {(connections.length > 0 ? connections : [
              { platform: 'instagram', label: 'Instagram', is_connected: false },
              { platform: 'facebook',  label: 'Facebook',  is_connected: false },
              { platform: 'tiktok',    label: 'TikTok',    is_connected: false },
            ]).map(c => (
              <div key={c.platform} className={`flex items-center gap-3 p-4 rounded-xl border ${c.is_connected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${c.is_connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.label}</p>
                  <p className={`text-xs ${c.is_connected ? 'text-green-600' : 'text-gray-400'}`}>
                    {c.is_connected ? 'Imeunganishwa' : 'Haijaunganishwa'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Period selector + Totals */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Takwimu za Pamoja</h3>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {(['today', 'week', 'month', 'all'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setUnifiedPeriod(p)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      unifiedPeriod === p ? 'bg-white text-primary-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {p === 'today' ? 'Leo' : p === 'week' ? 'Wiki' : p === 'month' ? 'Mwezi' : 'Yote'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : unifiedStats ? (
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Machapisho',  value: unifiedStats.totals.posts,    emoji: '📸' },
                  { label: 'Maoni',       value: unifiedStats.totals.comments, emoji: '💬' },
                  { label: 'Likes',       value: unifiedStats.totals.likes,    emoji: '❤️' },
                  { label: 'Shares',      value: unifiedStats.totals.shares,   emoji: '🔁' },
                  { label: 'Views',       value: unifiedStats.totals.views,    emoji: '👁️' },
                ].map(c => (
                  <div key={c.label} className="text-center bg-gray-50 rounded-xl p-3">
                    <div className="text-lg">{c.emoji}</div>
                    <div className="text-xl font-bold text-gray-900">{c.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{c.label}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Per-platform breakdown */}
          {unifiedStats && (
            <div className="grid grid-cols-3 gap-4">
              {unifiedStats.platforms.map(p => {
                const icons: Record<string, string> = { instagram: '📸', facebook: '👤', tiktok: '🎵' }
                const colors: Record<string, string> = { instagram: 'text-pink-600', facebook: 'text-blue-600', tiktok: 'text-gray-900' }
                return (
                  <div key={p.platform} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">{icons[p.platform] ?? '🌐'}</span>
                      <span className={`font-semibold ${colors[p.platform] ?? 'text-gray-800'} capitalize`}>{p.platform}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400 text-xs">Posts</span>
                        <p className="font-bold text-gray-900">{p.totalPosts}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Zilipita</span>
                        <p className="font-bold text-green-600">{p.successPosts}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Likes</span>
                        <p className="font-bold text-gray-900">{p.totalLikes.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-xs">Maoni</span>
                        <p className="font-bold text-gray-900">{p.totalComments.toLocaleString()}</p>
                      </div>
                      {p.totalViews > 0 && (
                        <div>
                          <span className="text-gray-400 text-xs">Views</span>
                          <p className="font-bold text-gray-900">{p.totalViews.toLocaleString()}</p>
                        </div>
                      )}
                      {p.failedPosts > 0 && (
                        <div>
                          <span className="text-gray-400 text-xs">Zilishindwa</span>
                          <p className="font-bold text-red-600">{p.failedPosts}</p>
                        </div>
                      )}
                    </div>
                    {p.lastPostAt && (
                      <p className="text-[10px] text-gray-400 mt-3">Mwisho: {fmtDate(p.lastPostAt)}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Quick post all */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Chapisha Kwenye Platforms Zote</h3>
            <div className="flex gap-3">
              <select
                value={postAllListing}
                onChange={e => setPostAllListing(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Chagua listing --</option>
                {listings.map(l => (
                  <option key={l.id} value={l.id}>{l.title} — {l.district}</option>
                ))}
              </select>
              <button
                onClick={handlePostAll}
                disabled={postAllLoading || !postAllListing}
                className="px-5 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all whitespace-nowrap"
              >
                {postAllLoading ? '⏳ Inachapisha...' : '🚀 Chapisha Yote'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Itachapisha kwenye Instagram, Facebook, na TikTok kwa wakati mmoja.</p>
          </div>

          {/* Recent posts (unified) */}
          {unifiedStats && unifiedStats.recentPosts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Machapisho ya Hivi Karibuni</h3>
              <div className="space-y-2">
                {unifiedStats.recentPosts.slice(0, 10).map(rp => {
                  const pIcons: Record<string, string> = { instagram: '📸', facebook: '👤', tiktok: '🎵' }
                  const statusColors: Record<string, string> = {
                    posted: 'text-green-600', published: 'text-green-600',
                    failed: 'text-red-600', posting: 'text-blue-600', pending: 'text-yellow-600',
                  }
                  return (
                    <div key={rp.id + rp.platform} className="flex items-center gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                      <span>{pIcons[rp.platform] ?? '🌐'}</span>
                      <span className="capitalize text-gray-600 w-20">{rp.platform}</span>
                      <span className={`font-medium ${statusColors[rp.status] ?? 'text-gray-600'}`}>{rp.status}</span>
                      <span className="text-gray-400 text-xs ml-auto">{rp.created_at ? fmtDate(rp.created_at) : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Machapisho Yote',      value: stats.totalPosts,        emoji: '📸', color: 'text-blue-600'   },
                { label: 'Yalichapishwa',         value: stats.publishedPosts,    emoji: '✅', color: 'text-green-600'  },
                { label: 'Wiki Hii',              value: stats.postsThisWeek,     emoji: '📅', color: 'text-purple-600' },
                { label: 'Maoni Yote',            value: stats.totalComments,     emoji: '💬', color: 'text-orange-600' },
                { label: 'Maoni Bila Jibu',       value: stats.unrepliedComments, emoji: '⚠️', color: 'text-red-600'    },
                { label: 'Maoni Leo',             value: stats.commentsToday,     emoji: '🔔', color: 'text-pink-600'   },
                { label: 'DMs Zote',              value: stats.totalDMs,          emoji: '📨', color: 'text-indigo-600' },
                { label: 'DMs Bila Jibu',         value: stats.unrepliedDMs,      emoji: '📬', color: 'text-red-600'    },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-2xl mb-1">{card.emoji}</div>
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setActiveTab('upload')}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 transition-all"
            >
              📹 Pakia Video Mpya
            </button>
            <button
              onClick={() => setActiveTab('postnow')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all"
            >
              ✍️ Chapisha Listing
            </button>
          </div>

          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Maarifa ya Mfumo</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>📌 <strong>Webhook URL:</strong> <code className="bg-gray-100 px-1 rounded">/api/v1/meta/webhook</code> — weka kwenye Meta Developer Console</p>
              <p>🔑 <strong>Verify Token:</strong> <code className="bg-gray-100 px-1 rounded">nyumbafasta_meta_webhook_2026</code></p>
              <p>⚡ <strong>Maoni ya Spam:</strong> hayajibiiwi kiotomatiki</p>
              <p>🤖 <strong>DMs:</strong> zinajibiwa na Amina kwa Kiswahili cha Dar es Salaam</p>
              <p>📊 <strong>Metrics:</strong> zinasasishwa kila saa 24 kupitia cron job</p>
            </div>
          </div>
        </div>
      )}

      {/* ── POSTS ── */}
      {activeTab === 'posts' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Jumla: {total} posts</p>
            <button
              onClick={handleRefreshMetrics}
              disabled={loading}
              className="px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? '...' : '🔄 Sasisha Metrics'}
            </button>
          </div>
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PlatformIcon platform={post.platform} />
                      <StatusBadge status={post.status} />
                      <span className="text-xs text-gray-400">{post.media_type}</span>
                      {post.published_at && (
                        <span className="text-xs text-gray-400">{fmtDate(post.published_at)}</span>
                      )}
                    </div>
                    {post.listings && (
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {post.listings.title} — {post.listings.district}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.caption}</p>
                  </div>
                </div>
                {post.metrics && Object.keys(post.metrics).length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
                    {post.metrics.ig_likes    != null && <MetricChip label="IG Likes"    value={post.metrics.ig_likes}    />}
                    {post.metrics.ig_comments != null && <MetricChip label="IG Maoni"    value={post.metrics.ig_comments} />}
                    {post.metrics.ig_reach    != null && <MetricChip label="IG Reach"    value={post.metrics.ig_reach}    />}
                    {post.metrics.fb_likes    != null && <MetricChip label="FB Likes"    value={post.metrics.fb_likes}    />}
                    {post.metrics.fb_comments != null && <MetricChip label="FB Maoni"    value={post.metrics.fb_comments} />}
                    {post.metrics.fb_shares   != null && <MetricChip label="FB Shares"   value={post.metrics.fb_shares}   />}
                  </div>
                )}
              </div>
            ))}
            {!loading && posts.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📸</div>
                <p>Hakuna machapisho bado</p>
                <p className="text-sm mt-1">Chapisha listing ya kwanza kutoka kichupo cha &ldquo;Chapisha&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TIKTOK ── */}
      {activeTab === 'tiktok' && <TikTokTab showToast={showToast} />}

      {/* ── PAKIA VIDEO ── */}
      {activeTab === 'upload' && <VideoUploadTab />}

      {/* ── MAKUNDI (Facebook Groups) ── */}
      {activeTab === 'groups' && <GroupsTab />}

      {/* ── STORIES (Instagram Stories) ── */}
      {activeTab === 'stories' && <StoriesTab />}

      {/* ── CAROUSEL (Instagram Carousel) ── */}
      {activeTab === 'carousel' && <CarouselTab />}

      {/* ── MARKETPLACE ── */}
      {activeTab === 'marketplace' && <MarketplaceTab />}

      {/* ── SPAM ── */}
      {activeTab === 'spam' && <SpamTab />}

      {/* ── BEST TIME ── */}
      {activeTab === 'besttime' && <BestTimeTab />}

      {/* ── COMMENTS ── */}
      {activeTab === 'comments' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Jumla: {total} maoni</p>
          <div className="space-y-3">
            {comments.map(comment => (
              <div key={comment.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <PlatformIcon platform={comment.platform} />
                      <CommentTypeBadge type={comment.comment_type} />
                      {comment.reply_sent
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Jibu limetumwa</span>
                        : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Halijalibiwa</span>
                      }
                      <span className="text-xs text-gray-400">{fmtDate(comment.created_at)}</span>
                    </div>
                    {comment.commenter_name && (
                      <p className="text-xs font-medium text-gray-600">@{comment.commenter_name}</p>
                    )}
                    <p className="text-sm text-gray-800 mt-1">{comment.comment_text}</p>
                    {comment.reply_text && (
                      <div className="mt-2 pl-3 border-l-2 border-primary-500">
                        <p className="text-xs text-gray-500 font-medium">Jibu la Amina:</p>
                        <p className="text-xs text-gray-600">{comment.reply_text}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!loading && comments.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">💬</div>
                <p>Hakuna maoni bado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DMs ── */}
      {activeTab === 'dms' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Jumla: {total} DMs</p>
          <div className="space-y-3">
            {dms.map(dm => (
              <div key={dm.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <PlatformIcon platform={dm.platform} />
                      {dm.reply_sent
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Jibu limetumwa</span>
                        : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Halijalibiwa</span>
                      }
                      <span className="text-xs text-gray-400">{fmtDate(dm.created_at)}</span>
                    </div>
                    {dm.sender_name && (
                      <p className="text-xs font-medium text-gray-600">{dm.sender_name}</p>
                    )}
                    <p className="text-sm text-gray-800 mt-1">{dm.message_text}</p>
                    {dm.reply_text && (
                      <div className="mt-2 pl-3 border-l-2 border-primary-500">
                        <p className="text-xs text-gray-500 font-medium">Jibu la Amina:</p>
                        <p className="text-xs text-gray-600">{dm.reply_text}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!loading && dms.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📨</div>
                <p>Hakuna DMs bado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── POST NOW ── */}
      {activeTab === 'postnow' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="font-semibold text-gray-800 text-lg">Chapisha Listing</h2>

            {/* Listing selector */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Chagua Listing</label>
              {loading ? (
                <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={selectedListing}
                  onChange={(e) => { setSelectedListing(e.target.value); setGeneratedCaption('') }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Chagua listing --</option>
                  {listings.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.title} — {l.district}, {l.region}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Post mode */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Aina ya Post</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPostMode('single')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    postMode === 'single'
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  📸 Picha Moja
                </button>
                <button
                  onClick={() => setPostMode('carousel')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    postMode === 'carousel'
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  🖼️ Carousel
                </button>
              </div>
              {postMode === 'carousel' && (
                <p className="text-xs text-gray-500 mt-1">Picha zote zinaonekana — wateja wanaswipe ➡️ (Instagram tu, inahitaji picha 2+)</p>
              )}
            </div>

            {/* Platform — only shown for single post mode */}
            {postMode === 'single' && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Jukwaa</label>
              <div className="flex gap-2">
                {(['instagram', 'facebook', 'both'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      selectedPlatform === p
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {p === 'instagram' ? '📸 Instagram' : p === 'facebook' ? '👤 Facebook' : '🌐 Vyote Viwili'}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Caption + Schedule — only for single post mode */}
            {postMode === 'single' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-gray-700">Caption</label>
                    <button
                      onClick={handleGenerateCaption}
                      disabled={captionLoading || !selectedListing}
                      className="text-xs px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {captionLoading ? '⏳ Inaandika...' : '✨ Tengeneza kwa AI'}
                    </button>
                  </div>
                  <textarea
                    value={generatedCaption}
                    onChange={(e) => setGeneratedCaption(e.target.value)}
                    rows={6}
                    placeholder="Caption itaonekana hapa baada ya kugeneratea, au andika mwenyewe..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                  {generatedHashtags && (
                    <p className="text-xs text-gray-500 mt-1">Hashtags: {generatedHashtags}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Panga Muda (hiari)</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Acha wazi kwa kuchapisha sasa hivi</p>
                </div>
              </>
            )}

            {/* Carousel info box */}
            {postMode === 'carousel' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                Caption ya AI itazalishwa kiotomatiki. Watermark itawekwa kwenye kila slide.
                Mchakato huchukua dakika 1-2 — usifunge dirisha.
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handlePost}
                disabled={postLoading || !selectedListing}
                className="btn-primary flex-1 py-3"
              >
                {postLoading
                  ? '⏳ Inachapisha...'
                  : postMode === 'carousel'
                  ? '🖼️ Chapisha Carousel'
                  : scheduledAt ? '📅 Panga' : '🚀 Chapisha Sasa'}
              </button>
              <button
                onClick={() => { setGeneratedCaption(''); setGeneratedHashtags(''); setSelectedListing(''); setScheduledAt('') }}
                className="px-5 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50"
              >
                Futa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {activeTab === 'schedule' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Posts zilizopangwa: {total}</p>
          <div className="space-y-3">
            {(schedule as Array<{
              id: string; platform: string; scheduled_at: string; status: string
              listings?: { title: string; district: string }
            }>).map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={item.platform} />
                  <div className="flex-1">
                    {item.listings && (
                      <p className="text-sm font-medium text-gray-800">
                        {item.listings.title} — {item.listings.district}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">{fmtDate(item.scheduled_at)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
            {!loading && schedule.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📅</div>
                <p>Hakuna posts zilizopangwa</p>
                <p className="text-sm mt-1">Panga kutoka kichupo cha &ldquo;Chapisha&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && activeTab !== 'overview' && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-gray-50 rounded-lg px-3 py-1.5 min-w-[60px]">
      <span className="text-sm font-bold text-gray-800">{value.toLocaleString()}</span>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  )
}
