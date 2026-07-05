'use client'
import { useState, useEffect, useCallback } from 'react'
import { PlatformLogo } from '@/components/shared/PlatformLogo'
import VideoUploadTab from './VideoUploadTab'
import GroupsTab from './GroupsTab'
import StoriesTab from './StoriesTab'
import CarouselTab from './CarouselTab'
import SpamTab from './SpamTab'
import BestTimeTab from './BestTimeTab'
import MarketplaceTab from './MarketplaceTab'
import TikTokTab from './TikTokTab'
import ListingsTab from './ListingsTab'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'yote' | 'overview' | 'posts' | 'upload' | 'groups' | 'stories' | 'carousel' | 'marketplace' | 'spam' | 'besttime' | 'comments' | 'dms' | 'postnow' | 'schedule' | 'tiktok' | 'listings'

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
  const map: Record<string, { bg: string; text: string }> = {
    published:  { bg: '#eaf3de', text: '#3b6d11' },
    posted:     { bg: '#eaf3de', text: '#3b6d11' },
    pending:    { bg: '#faeeda', text: '#854f0b' },
    failed:     { bg: '#fcebeb', text: '#a32d2d' },
    publishing: { bg: '#e6f1fb', text: '#185fa5' },
  }
  const s = map[status]
  if (s) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
        {status}
      </span>
    )
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>
}

function CommentTypeBadge({ type }: { type: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    inquiry:  { bg: '#e6f1fb', text: '#185fa5', label: 'Inquiry'  },
    interest: { bg: '#eaf3de', text: '#3b6d11', label: 'Interest' },
    negative: { bg: '#fcebeb', text: '#a32d2d', label: 'Negative' },
    spam:     { bg: '#f4f4f0', text: '#666660', label: 'Spam'     },
    question: { bg: '#eeedfe', text: '#534ab7', label: 'Swali'    },
    praise:   { bg: '#eaf3de', text: '#3b6d11', label: 'Sifa'     },
    unknown:  { bg: '#f4f4f0', text: '#666660', label: '?'        },
  }
  const s = map[type]
  if (s) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.text }}>
        {s.label}
      </span>
    )
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{type}</span>
}

const PLATFORM_LOGO_KEYS = new Set(['instagram', 'facebook', 'tiktok', 'whatsapp'])

function PlatformIcon({ platform }: { platform: string }) {
  if (PLATFORM_LOGO_KEYS.has(platform.toLowerCase())) {
    return <PlatformLogo platform={platform} size={16} />
  }
  return <i className="ti ti-world" aria-hidden="true" />
}

// ── Sidebar navigation groups ──────────────────────────────────────────────

const SIDEBAR_GROUPS: { title: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    title: 'Muhtasari',
    items: [
      { id: 'yote',     label: 'Platforms Zote', icon: 'world' },
      { id: 'overview', label: 'Takwimu',        icon: 'chart-bar' },
    ],
  },
  {
    title: 'Chapisha',
    items: [
      { id: 'listings', label: 'Listings Library', icon: 'layout-grid' },
      { id: 'upload',   label: 'Pakia Video',      icon: 'video' },
      { id: 'stories',  label: 'Stories',          icon: 'circle-dot' },
    ],
  },
  {
    title: 'Machapisho',
    items: [
      { id: 'posts',    label: 'Machapisho', icon: 'camera' },
      { id: 'schedule', label: 'Ratiba',     icon: 'calendar' },
      { id: 'tiktok',   label: 'TikTok',     icon: '' },
    ],
  },
  {
    title: 'Jamii & Soko',
    items: [
      { id: 'groups',      label: 'Makundi FB',  icon: 'users' },
      { id: 'marketplace', label: 'Marketplace', icon: 'shopping-cart' },
    ],
  },
  {
    title: 'Usimamizi',
    items: [
      { id: 'comments', label: 'Maoni',       icon: 'message-circle' },
      { id: 'dms',      label: 'DMs',         icon: 'mail' },
      { id: 'spam',     label: 'Spam',        icon: 'ban' },
      { id: 'besttime', label: 'Wakati Bora', icon: 'clock' },
    ],
  },
]

const ALL_NAV_ITEMS = SIDEBAR_GROUPS.flatMap(g => g.items)

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
  const [unifiedStats, setUnifiedStats]     = useState<{ platforms: UnifiedPlatformStat[]; totals: UnifiedTotals; recentPosts: UnifiedRecentPost[] } | null>(null)
  const [connections, setConnections]       = useState<PlatformConnection[]>([])
  const [unifiedPeriod, setUnifiedPeriod]   = useState<'today' | 'week' | 'month' | 'all'>('month')
  const [postAllListing, setPostAllListing] = useState('')
  const [postAllLoading, setPostAllLoading] = useState(false)

  // Listings for the "Chapisha Kwenye Platforms Zote" quick-post in the overview tab
  const [listings, setListings] = useState<Listing[]>([])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchUnified = useCallback(async (period: 'today' | 'week' | 'month' | 'all') => {
    setLoading(true)
    try {
      const [statsResult, connResult, listingsResult] = await Promise.allSettled([
        fetch(`/api/v1/social/stats?period=${period}`),
        fetch('/api/v1/social/connections'),
        fetch('/api/v1/social/listings'),
      ])
      if (statsResult.status === 'fulfilled') {
        const statsData = await statsResult.value.json() as { platforms: UnifiedPlatformStat[]; totals: UnifiedTotals; recentPosts: UnifiedRecentPost[] }
        setUnifiedStats(statsData)
      }
      if (connResult.status === 'fulfilled') {
        const connData = await connResult.value.json() as { platforms?: PlatformConnection[] }
        if (connData.platforms) setConnections(connData.platforms)
      }
      if (listingsResult.status === 'fulfilled') {
        const listData = await listingsResult.value.json() as { listings?: Listing[] }
        setListings(listData.listings ?? [])
      }
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
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [fetchUnified, unifiedPeriod])

  // Fetch platform connection status once on mount — independent of active tab
  useEffect(() => {
    fetch('/api/v1/social/connections')
      .then(r => r.json())
      .then((d: { platforms?: PlatformConnection[] }) => { if (d.platforms) setConnections(d.platforms) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchData(activeTab)
  }, [activeTab, fetchData])

  useEffect(() => {
    if (activeTab === 'yote') fetchUnified(unifiedPeriod)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unifiedPeriod])

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
      showToast(`${data.successCount ?? 0} platforms zilipita${data.failedCount ? `, ${data.failedCount} zilishindwa` : ''}`)
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

  const activeTabInfo = ALL_NAV_ITEMS.find(t => t.id === activeTab)

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#f4f4f0' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm max-w-xs">
          {toast}
        </div>
      )}

      {/* ── Desktop sidebar nav ─────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-[185px] flex-shrink-0 h-full overflow-y-auto bg-white border-r"
        style={{ borderColor: '#e5e5e0' }}
      >
        {/* Brand + back link */}
        <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: '#e5e5e0' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#1a1a18' }}
            >
              <span className="text-white text-xs font-bold">SM</span>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: '#1a1a18' }}>Social Media</p>
              <p className="text-[10px] leading-tight" style={{ color: '#999992' }}>NyumbaFasta</p>
            </div>
          </div>
          <a
            href="/admin"
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2 py-1.5 transition-all hover:bg-gray-100"
            style={{ color: '#666660' }}
          >
            <i className="ti ti-arrow-left text-xs" aria-hidden="true" />
            Admin Panel
          </a>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {SIDEBAR_GROUPS.map(group => (
            <div key={group.title} className="mb-4">
              <p
                className="text-[9px] font-bold uppercase tracking-widest px-2.5 mb-1.5"
                style={{ color: '#999992' }}
              >
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-left ${
                      activeTab === item.id
                        ? 'bg-primary-50 text-primary-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.id === 'tiktok'
                      ? <PlatformLogo platform="tiktok" size={16} className="w-4 flex-shrink-0" />
                      : <i className={`ti ti-${item.icon} text-sm w-4 flex-shrink-0 text-center`} aria-hidden="true" />}
                    <span className="text-xs truncate">{item.label}</span>
                    {activeTab === item.id && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Platform connection status */}
        <div className="px-3 py-3 border-t flex-shrink-0" style={{ borderColor: '#e5e5e0' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#999992' }}>
            Muunganiko
          </p>
          {(connections.length > 0 ? connections : [
            { platform: 'instagram', label: 'Instagram', is_connected: false },
            { platform: 'facebook',  label: 'Facebook',  is_connected: false },
            { platform: 'tiktok',    label: 'TikTok',    is_connected: false },
          ]).map(c => (
            <div key={c.platform} className="flex items-center gap-2 py-0.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.is_connected ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-[11px]" style={{ color: c.is_connected ? '#3b6d11' : '#999992' }}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Topbar */}
        <div
          className="bg-white border-b px-4 lg:px-6 py-3 lg:py-4 flex items-center gap-3 justify-between flex-shrink-0"
          style={{ borderColor: '#e5e5e0' }}
        >
          {/* Mobile: back link + title */}
          <div className="flex items-center gap-2 min-w-0">
            <a
              href="/admin"
              className="lg:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
              style={{ color: '#666660' }}
              aria-label="Rudi Admin"
            >
              <i className="ti ti-arrow-left" aria-hidden="true" />
            </a>
            <div className="min-w-0">
              <h1 className="text-sm lg:text-base font-bold leading-tight truncate" style={{ color: '#1a1a18' }}>
                {activeTabInfo ? activeTabInfo.label : 'Social Media'}
              </h1>
              <p className="text-xs mt-0.5 hidden sm:block" style={{ color: '#999992' }}>
                TikTok, Instagram + Facebook automation — NyumbaFasta
              </p>
            </div>
          </div>
        </div>

        {/* Mobile scrollable tab nav */}
        <div
          className="lg:hidden flex-shrink-0 border-b overflow-x-auto bg-white"
          style={{ borderColor: '#e5e5e0', scrollbarWidth: 'none' }}
        >
          <div className="flex gap-1.5 px-3 py-2.5 min-w-max">
            {ALL_NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                  activeTab === item.id ? 'text-white' : 'text-gray-600'
                }`}
                style={{ background: activeTab === item.id ? '#1D9E75' : '#f4f4f0' }}
              >
                {item.id === 'tiktok'
                  ? <PlatformLogo platform="tiktok" size={12} className="flex-shrink-0" />
                  : <i className={`ti ti-${item.icon} text-[11px] flex-shrink-0`} aria-hidden="true" />}
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Page content — only this area scrolls */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">

          {/* ── PLATFORMS ZOTE (unified) ── */}
          {activeTab === 'yote' && (
            <div className="space-y-5">

              {/* Connection status row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {(connections.length > 0 ? connections : [
                  { platform: 'instagram', label: 'Instagram', is_connected: false },
                  { platform: 'facebook',  label: 'Facebook',  is_connected: false },
                  { platform: 'tiktok',    label: 'TikTok',    is_connected: false },
                ]).map(c => (
                  <div
                    key={c.platform}
                    className="flex items-center gap-3 p-4 rounded-xl border"
                    style={{
                      background: c.is_connected ? '#eaf3de' : '#f8f8f5',
                      borderColor: c.is_connected ? '#b6d99a' : '#e5e5e0',
                    }}
                  >
                    <PlatformLogo platform={c.platform} size={24} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1a1a18' }}>{c.label}</p>
                      <p className="text-xs" style={{ color: c.is_connected ? '#3b6d11' : '#999992' }}>
                        {c.is_connected ? 'Imeunganishwa' : 'Haijaunganishwa'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Period selector + Totals */}
              <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e5e5e0' }}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="font-semibold" style={{ color: '#1a1a18' }}>Takwimu za Pamoja</h3>
                  <div className="flex gap-1 rounded-lg p-0.5" style={{ background: '#f4f4f0' }}>
                    {(['today', 'week', 'month', 'all'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setUnifiedPeriod(p)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          unifiedPeriod === p
                            ? 'bg-white text-primary-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {p === 'today' ? 'Leo' : p === 'week' ? 'Wiki' : p === 'month' ? 'Mwezi' : 'Yote'}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : unifiedStats ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: 'Machapisho', value: unifiedStats.totals.posts,    icon: 'camera' },
                      { label: 'Maoni',      value: unifiedStats.totals.comments, icon: 'message-circle' },
                      { label: 'Likes',      value: unifiedStats.totals.likes,    icon: 'heart' },
                      { label: 'Shares',     value: unifiedStats.totals.shares,   icon: 'repeat' },
                      { label: 'Views',      value: unifiedStats.totals.views,    icon: 'eye' },
                    ].map(c => (
                      <div key={c.label} className="text-center rounded-xl p-3" style={{ background: '#f8f8f5' }}>
                        <i className={`ti ti-${c.icon} text-lg`} aria-hidden="true" />
                        <div className="text-xl font-bold" style={{ color: '#1a1a18' }}>{c.value.toLocaleString()}</div>
                        <div className="text-xs" style={{ color: '#999992' }}>{c.label}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Per-platform breakdown */}
              {unifiedStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unifiedStats.platforms.map(p => {
                    const colors: Record<string, string> = { instagram: '#c13584', facebook: '#1877f2', tiktok: '#1a1a18' }
                    return (
                      <div key={p.platform} className="bg-white rounded-xl border p-4" style={{ borderColor: '#e5e5e0' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <PlatformIcon platform={p.platform} />
                          <span className="font-semibold capitalize text-sm" style={{ color: colors[p.platform] ?? '#1a1a18' }}>
                            {p.platform}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-[10px]" style={{ color: '#999992' }}>Posts</span>
                            <p className="font-bold" style={{ color: '#1a1a18' }}>{p.totalPosts}</p>
                          </div>
                          <div>
                            <span className="text-[10px]" style={{ color: '#999992' }}>Zilipita</span>
                            <p className="font-bold" style={{ color: '#3b6d11' }}>{p.successPosts}</p>
                          </div>
                          <div>
                            <span className="text-[10px]" style={{ color: '#999992' }}>Likes</span>
                            <p className="font-bold" style={{ color: '#1a1a18' }}>{p.totalLikes.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-[10px]" style={{ color: '#999992' }}>Maoni</span>
                            <p className="font-bold" style={{ color: '#1a1a18' }}>{p.totalComments.toLocaleString()}</p>
                          </div>
                          {p.totalViews > 0 && (
                            <div>
                              <span className="text-[10px]" style={{ color: '#999992' }}>Views</span>
                              <p className="font-bold" style={{ color: '#1a1a18' }}>{p.totalViews.toLocaleString()}</p>
                            </div>
                          )}
                          {p.failedPosts > 0 && (
                            <div>
                              <span className="text-[10px]" style={{ color: '#999992' }}>Zilishindwa</span>
                              <p className="font-bold" style={{ color: '#a32d2d' }}>{p.failedPosts}</p>
                            </div>
                          )}
                        </div>
                        {p.lastPostAt && (
                          <p className="text-[10px] mt-3" style={{ color: '#999992' }}>
                            Mwisho: {fmtDate(p.lastPostAt)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Quick post all */}
              <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e5e5e0' }}>
                <h3 className="font-semibold mb-3" style={{ color: '#1a1a18' }}>Chapisha Kwenye Platforms Zote</h3>
                {listings.length === 0 && !loading ? (
                  <div className="text-center py-4 rounded-lg" style={{ background: '#fafafa', border: '1px dashed #e5e5e0' }}>
                    <i className="ti ti-home-off text-2xl text-gray-300" aria-hidden="true" />
                    <p className="text-sm text-gray-500 mt-2">Hakuna listings hai bado</p>
                    <a href="/admin/listings" className="text-xs text-primary-500 font-medium hover:underline mt-1 inline-block">
                      Idhini listings → /admin/listings
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={postAllListing}
                      onChange={e => setPostAllListing(e.target.value)}
                      className="w-full sm:flex-1 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      style={{ border: '1px solid #e5e5e0', color: '#1a1a18' }}
                    >
                      <option value="">-- Chagua listing ({listings.length}) --</option>
                      {listings.map(l => (
                        <option key={l.id} value={l.id}>{l.title} — {l.district}</option>
                      ))}
                    </select>
                    <button
                      onClick={handlePostAll}
                      disabled={postAllLoading || !postAllListing}
                      className="px-5 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-all whitespace-nowrap"
                    >
                      {postAllLoading ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> Inachapisha...</> : <><i className="ti ti-rocket" aria-hidden="true" /> Chapisha Yote</>}
                    </button>
                  </div>
                )}
                <p className="text-xs mt-2" style={{ color: '#999992' }}>
                  Itachapisha kwenye Instagram, Facebook, na TikTok kwa wakati mmoja.
                </p>
              </div>

              {/* Recent posts */}
              {unifiedStats && unifiedStats.recentPosts.length > 0 && (
                <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e5e5e0' }}>
                  <h3 className="font-semibold mb-3" style={{ color: '#1a1a18' }}>Machapisho ya Hivi Karibuni</h3>
                  <div className="space-y-2">
                    {unifiedStats.recentPosts.slice(0, 10).map(rp => {
                      const statusColors: Record<string, string> = {
                        posted: '#3b6d11', published: '#3b6d11',
                        failed: '#a32d2d', posting: '#185fa5', pending: '#854f0b',
                      }
                      return (
                        <div
                          key={rp.id + rp.platform}
                          className="flex items-center gap-3 text-sm py-2 border-b last:border-0"
                          style={{ borderColor: '#f4f4f0' }}
                        >
                          <PlatformIcon platform={rp.platform} />
                          <span className="capitalize w-20 text-xs" style={{ color: '#666660' }}>{rp.platform}</span>
                          <span className="font-medium text-xs" style={{ color: statusColors[rp.status] ?? '#666660' }}>
                            {rp.status}
                          </span>
                          <span className="text-xs ml-auto" style={{ color: '#999992' }}>
                            {rp.created_at ? fmtDate(rp.created_at) : ''}
                          </span>
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
                    { label: 'Machapisho Yote',  value: stats.totalPosts,        icon: 'camera',         bg: '#e6f1fb', color: '#185fa5' },
                    { label: 'Yalichapishwa',     value: stats.publishedPosts,    icon: 'check',          bg: '#eaf3de', color: '#3b6d11' },
                    { label: 'Wiki Hii',          value: stats.postsThisWeek,     icon: 'calendar',       bg: '#eeedfe', color: '#534ab7' },
                    { label: 'Maoni Yote',        value: stats.totalComments,     icon: 'message-circle', bg: '#faeeda', color: '#854f0b' },
                    { label: 'Maoni Bila Jibu',   value: stats.unrepliedComments, icon: 'alert-triangle', bg: '#fcebeb', color: '#a32d2d' },
                    { label: 'Maoni Leo',         value: stats.commentsToday,     icon: 'bell',           bg: '#eeedfe', color: '#534ab7' },
                    { label: 'DMs Zote',          value: stats.totalDMs,          icon: 'mail',           bg: '#e6f1fb', color: '#185fa5' },
                    { label: 'DMs Bila Jibu',     value: stats.unrepliedDMs,      icon: 'mail-x',         bg: '#fcebeb', color: '#a32d2d' },
                  ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#e5e5e0' }}>
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3"
                        style={{ background: card.bg }}
                      >
                        <i className={`ti ti-${card.icon} text-lg`} aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value.toLocaleString()}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#666660' }}>{card.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 transition-all"
                >
                  <i className="ti ti-video" aria-hidden="true" /> Pakia Video Mpya
                </button>
                <button
                  onClick={() => setActiveTab('listings')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-sm font-medium rounded-xl hover:bg-gray-50 transition-all"
                  style={{ border: '1px solid #e5e5e0', color: '#1a1a18' }}
                >
                  <i className="ti ti-pencil" aria-hidden="true" /> Chapisha Listing
                </button>
              </div>

              <div className="mt-4 bg-white rounded-xl border p-5" style={{ borderColor: '#e5e5e0' }}>
                <h3 className="font-semibold mb-3" style={{ color: '#1a1a18' }}>Maarifa ya Mfumo</h3>
                <div className="space-y-2 text-sm" style={{ color: '#666660' }}>
                  <p><i className="ti ti-map-pin" aria-hidden="true" /> <strong>Webhook URL:</strong>{' '}
                    <code className="px-1 rounded text-xs" style={{ background: '#f4f4f0' }}>/api/v1/meta/webhook</code>
                    {' '}— weka kwenye Meta Developer Console
                  </p>
                  <p><i className="ti ti-key" aria-hidden="true" /> <strong>Verify Token:</strong>{' '}
                    <code className="px-1 rounded text-xs" style={{ background: '#f4f4f0' }}>nyumbafasta_meta_webhook_2026</code>
                  </p>
                  <p><i className="ti ti-bolt" aria-hidden="true" /> <strong>Maoni ya Spam:</strong> hayajibiiwi kiotomatiki</p>
                  <p><i className="ti ti-robot" aria-hidden="true" /> <strong>DMs:</strong> zinajibiwa na Amina kwa Kiswahili cha Dar es Salaam</p>
                  <p><i className="ti ti-chart-bar" aria-hidden="true" /> <strong>Metrics:</strong> zinasasishwa kila saa 24 kupitia cron job</p>
                </div>
              </div>
            </div>
          )}

          {/* ── POSTS ── */}
          {activeTab === 'posts' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm" style={{ color: '#666660' }}>Jumla: {total} posts</p>
                <button
                  onClick={handleRefreshMetrics}
                  disabled={loading}
                  className="px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
{loading ? '...' : <><i className="ti ti-refresh" aria-hidden="true" /> Sasisha Metrics</>}
                </button>
              </div>
              <div className="space-y-3">
                {posts.map(post => (
                  <div key={post.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#e5e5e0' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <PlatformIcon platform={post.platform} />
                          <StatusBadge status={post.status} />
                          <span className="text-xs" style={{ color: '#999992' }}>{post.media_type}</span>
                          {post.published_at && (
                            <span className="text-xs" style={{ color: '#999992' }}>{fmtDate(post.published_at)}</span>
                          )}
                        </div>
                        {post.listings && (
                          <p className="text-sm font-medium truncate" style={{ color: '#1a1a18' }}>
                            {post.listings.title} — {post.listings.district}
                          </p>
                        )}
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: '#666660' }}>{post.caption}</p>
                      </div>
                    </div>
                    {post.metrics && Object.keys(post.metrics).length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t" style={{ borderColor: '#f4f4f0' }}>
                        {post.metrics.ig_likes    != null && <MetricChip label="IG Likes"  value={post.metrics.ig_likes}    />}
                        {post.metrics.ig_comments != null && <MetricChip label="IG Maoni"  value={post.metrics.ig_comments} />}
                        {post.metrics.ig_reach    != null && <MetricChip label="IG Reach"  value={post.metrics.ig_reach}    />}
                        {post.metrics.fb_likes    != null && <MetricChip label="FB Likes"  value={post.metrics.fb_likes}    />}
                        {post.metrics.fb_comments != null && <MetricChip label="FB Maoni"  value={post.metrics.fb_comments} />}
                        {post.metrics.fb_shares   != null && <MetricChip label="FB Shares" value={post.metrics.fb_shares}   />}
                      </div>
                    )}
                  </div>
                ))}
                {!loading && posts.length === 0 && (
                  <div className="text-center py-16" style={{ color: '#999992' }}>
                    <div className="text-4xl mb-3"><i className="ti ti-camera" aria-hidden="true" /></div>
                    <p className="font-medium" style={{ color: '#666660' }}>Hakuna machapisho katika kipindi hiki</p>
                    <p className="text-sm mt-1">
                      Jaribu kubadilisha kipindi cha muda, au{' '}
                      <button onClick={() => setActiveTab('listings')} className="text-primary-500 hover:underline">
                        chapisha listing ya kwanza
                      </button>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TIKTOK ── */}
          {activeTab === 'tiktok' && <TikTokTab showToast={showToast} />}

          {/* ── LISTINGS LIBRARY ── */}
          {activeTab === 'listings' && (
            <ListingsTab showToast={showToast} />
          )}

          {/* ── PAKIA VIDEO ── */}
          {activeTab === 'upload' && <VideoUploadTab />}

          {/* ── MAKUNDI ── */}
          {activeTab === 'groups' && <GroupsTab />}

          {/* ── STORIES ── */}
          {activeTab === 'stories' && <StoriesTab />}

          {/* ── CAROUSEL ── */}
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
              <p className="text-sm mb-4" style={{ color: '#666660' }}>Jumla: {total} maoni</p>
              <div className="space-y-3">
                {comments.map(comment => (
                  <div key={comment.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#e5e5e0' }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PlatformIcon platform={comment.platform} />
                          <CommentTypeBadge type={comment.comment_type} />
                          {comment.reply_sent
                            ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eaf3de', color: '#3b6d11' }}>Jibu limetumwa</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#faeeda', color: '#854f0b' }}>Halijalibiwa</span>
                          }
                          <span className="text-xs" style={{ color: '#999992' }}>{fmtDate(comment.created_at)}</span>
                        </div>
                        {comment.commenter_name && (
                          <p className="text-xs font-medium" style={{ color: '#666660' }}>@{comment.commenter_name}</p>
                        )}
                        <p className="text-sm mt-1" style={{ color: '#1a1a18' }}>{comment.comment_text}</p>
                        {comment.reply_text && (
                          <div className="mt-2 pl-3 border-l-2 border-primary-400">
                            <p className="text-xs font-medium" style={{ color: '#999992' }}>Jibu la Amina:</p>
                            <p className="text-xs" style={{ color: '#666660' }}>{comment.reply_text}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!loading && comments.length === 0 && (
                  <div className="text-center py-16" style={{ color: '#999992' }}>
                    <div className="text-4xl mb-3"><i className="ti ti-message-circle" aria-hidden="true" /></div>
                    <p>Hakuna maoni bado</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DMs ── */}
          {activeTab === 'dms' && (
            <div>
              <p className="text-sm mb-4" style={{ color: '#666660' }}>Jumla: {total} DMs</p>
              <div className="space-y-3">
                {dms.map(dm => (
                  <div key={dm.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#e5e5e0' }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PlatformIcon platform={dm.platform} />
                          {dm.reply_sent
                            ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eaf3de', color: '#3b6d11' }}>Jibu limetumwa</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#faeeda', color: '#854f0b' }}>Halijalibiwa</span>
                          }
                          <span className="text-xs" style={{ color: '#999992' }}>{fmtDate(dm.created_at)}</span>
                        </div>
                        {dm.sender_name && (
                          <p className="text-xs font-medium" style={{ color: '#666660' }}>{dm.sender_name}</p>
                        )}
                        <p className="text-sm mt-1" style={{ color: '#1a1a18' }}>{dm.message_text}</p>
                        {dm.reply_text && (
                          <div className="mt-2 pl-3 border-l-2 border-primary-400">
                            <p className="text-xs font-medium" style={{ color: '#999992' }}>Jibu la Amina:</p>
                            <p className="text-xs" style={{ color: '#666660' }}>{dm.reply_text}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!loading && dms.length === 0 && (
                  <div className="text-center py-16" style={{ color: '#999992' }}>
                    <div className="text-4xl mb-3"><i className="ti ti-mail" aria-hidden="true" /></div>
                    <p>Hakuna DMs bado</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SCHEDULE ── */}
          {activeTab === 'schedule' && (
            <div>
              <p className="text-sm mb-4" style={{ color: '#666660' }}>Posts zilizopangwa: {total}</p>
              <div className="space-y-3">
                {(schedule as Array<{
                  id: string; platform: string; scheduled_at: string; status: string
                  listings?: { title: string; district: string }
                }>).map(item => (
                  <div key={item.id} className="bg-white rounded-xl border p-4" style={{ borderColor: '#e5e5e0' }}>
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={item.platform} />
                      <div className="flex-1">
                        {item.listings && (
                          <p className="text-sm font-medium" style={{ color: '#1a1a18' }}>
                            {item.listings.title} — {item.listings.district}
                          </p>
                        )}
                        <p className="text-xs" style={{ color: '#999992' }}>{fmtDate(item.scheduled_at)}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
                {!loading && schedule.length === 0 && (
                  <div className="text-center py-16" style={{ color: '#999992' }}>
                    <div className="text-4xl mb-3"><i className="ti ti-calendar" aria-hidden="true" /></div>
                    <p>Hakuna posts zilizopangwa</p>
                    <p className="text-sm mt-1">Panga kutoka &ldquo;Chapisha Sasa&rdquo;</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {loading && ['posts', 'comments', 'dms', 'schedule'].includes(activeTab) && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

        </div>{/* end .p-6 */}
      </div>{/* end main */}
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg px-3 py-1.5 min-w-[60px]" style={{ background: '#f8f8f5' }}>
      <span className="text-sm font-bold" style={{ color: '#1a1a18' }}>{value.toLocaleString()}</span>
      <span className="text-[10px]" style={{ color: '#999992' }}>{label}</span>
    </div>
  )
}
