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
import BlogTab from './BlogTab'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'yote' | 'overview' | 'posts' | 'upload' | 'groups' | 'stories' | 'carousel' | 'marketplace' | 'spam' | 'besttime' | 'comments' | 'dms' | 'postnow' | 'schedule' | 'tiktok' | 'listings' | 'blog'

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
  const cls: Record<string, string> = {
    published:  'bg-emerald-50 text-emerald-700',
    posted:     'bg-emerald-50 text-emerald-700',
    pending:    'bg-amber-50 text-amber-700',
    failed:     'bg-red-50 text-red-700',
    publishing: 'bg-blue-50 text-blue-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}

function CommentTypeBadge({ type }: { type: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    inquiry:  { cls: 'bg-blue-50 text-blue-700',       label: 'Inquiry'  },
    interest: { cls: 'bg-emerald-50 text-emerald-700', label: 'Interest' },
    negative: { cls: 'bg-red-50 text-red-700',         label: 'Negative' },
    spam:     { cls: 'bg-slate-100 text-slate-500',    label: 'Spam'     },
    question: { cls: 'bg-violet-50 text-violet-700',   label: 'Swali'    },
    praise:   { cls: 'bg-emerald-50 text-emerald-700', label: 'Sifa'     },
    unknown:  { cls: 'bg-slate-100 text-slate-500',    label: '?'        },
  }
  const s = map[type]
  return s
    ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">{type}</span>
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
      { id: 'carousel', label: 'Carousel',         icon: 'slideshow' },
      { id: 'blog',     label: 'Blog (SEO)',       icon: 'notes' },
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
    title: 'Ujumbe',
    items: [
      { id: 'dms', label: 'DMs za Kijamii', icon: 'mail' },
    ],
  },
  {
    title: 'Usimamizi',
    items: [
      { id: 'comments', label: 'Maoni',       icon: 'message-circle' },
      { id: 'spam',     label: 'Spam',        icon: 'ban' },
      { id: 'besttime', label: 'Wakati Bora', icon: 'clock' },
    ],
  },
]

const ALL_NAV_ITEMS = SIDEBAR_GROUPS.flatMap(g => g.items)

// ── Main Component ─────────────────────────────────────────────────────────

export default function SocialDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('yote')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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
  const [replyComment, setReplyComment] = useState<Comment | null>(null)
  const [replyText,    setReplyText]    = useState('')
  const [replying,     setReplying]     = useState(false)

  // DM panel state (used in Muhtasari tab)
  const [selectedDmId,     setSelectedDmId]     = useState<string | null>(null)
  const [dmPlatformFilter, setDmPlatformFilter] = useState<'all' | 'instagram' | 'facebook'>('all')

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
        const statsData = await statsResult.value.json() as { platforms?: UnifiedPlatformStat[]; totals?: UnifiedTotals; recentPosts?: UnifiedRecentPost[]; error?: string }
        setUnifiedStats({
          platforms:   statsData.platforms   ?? [],
          totals:      statsData.totals      ?? { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
          recentPosts: statsData.recentPosts ?? [],
        })
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
        const res = await fetch('/api/v1/social/posts?tab=dms&limit=50')
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


  async function handleCommentReply() {
    if (!replyComment || !replyText.trim()) return
    setReplying(true)
    try {
      const res = await fetch('/api/v1/social/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: replyComment.comment_id,
          platform:  replyComment.platform,
          message:   replyText.trim(),
        }),
      })
      const d = await res.json() as { ok?: boolean; error?: string }
      if (d.ok) {
        setComments(prev => prev.map(c =>
          c.id === replyComment.id
            ? { ...c, reply_sent: true, reply_text: replyText.trim() }
            : c
        ))
        setReplyComment(null)
        setReplyText('')
        showToast('Jibu limetumwa!')
      } else {
        showToast(d.error ?? 'Imeshindwa kutuma jibu')
      }
    } finally {
      setReplying(false)
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
    <div className="h-full flex overflow-hidden bg-slate-50">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm max-w-xs">
          {toast}
        </div>
      )}

      {/* Mobile sidebar drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col shadow-2xl bg-slate-900">
            <div className="px-4 py-4 border-b border-slate-800 flex-shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-teal-600">
                  <span className="text-white text-xs font-bold">SM</span>
                </div>
                <p className="text-sm font-bold text-white">Social Media</p>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-1.5 rounded-lg text-slate-400">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              {SIDEBAR_GROUPS.map(group => (
                <div key={group.title} className="mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest px-2.5 mb-1.5 text-slate-500">{group.title}</p>
                  <div className="space-y-0.5">
                    {group.items.map(item => (
                      <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileNavOpen(false) }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                          activeTab === item.id ? 'bg-teal-600 text-white' : 'text-slate-400'
                        }`}>
                        {item.id === 'tiktok'
                          ? <PlatformLogo platform="tiktok" size={14} className="flex-shrink-0" />
                          : <i className={`ti ti-${item.icon} text-base w-4 flex-shrink-0 text-center`} aria-hidden="true" />}
                        <span>{item.label}</span>
                        {activeTab === item.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="px-3 py-3 border-t border-slate-800 flex-shrink-0">
              <a href="/admin" className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-slate-400">
                <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
                <span>Admin Panel</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop sidebar nav ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[185px] flex-shrink-0 h-full overflow-y-auto bg-white border-r border-slate-200">
        {/* Brand + back link */}
        <div className="px-4 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-900">
              <span className="text-white text-xs font-bold">SM</span>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">Social Media</p>
              <p className="text-[10px] leading-tight text-slate-400">NyumbaFasta</p>
            </div>
          </div>
          <a
            href="/admin"
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2 py-1.5 transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <i className="ti ti-arrow-left text-xs" aria-hidden="true" />
            Admin Panel
          </a>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {SIDEBAR_GROUPS.map(group => (
            <div key={group.title} className="mb-4">
              <p className="text-[9px] font-bold uppercase tracking-widest px-2.5 mb-1.5 text-slate-400">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-left ${
                      activeTab === item.id
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    {item.id === 'tiktok'
                      ? <PlatformLogo platform="tiktok" size={16} className="w-4 flex-shrink-0" />
                      : <i className={`ti ti-${item.icon} text-sm w-4 flex-shrink-0 text-center`} aria-hidden="true" />}
                    <span className="text-xs truncate">{item.label}</span>
                    {activeTab === item.id && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Platform connection status */}
        <div className="px-3 py-3 border-t border-slate-200 flex-shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2 text-slate-400">
            Muunganiko
          </p>
          {(connections.length > 0 ? connections : [
            { platform: 'instagram', label: 'Instagram', is_connected: false },
            { platform: 'facebook',  label: 'Facebook',  is_connected: false },
            { platform: 'tiktok',    label: 'TikTok',    is_connected: false },
          ]).map(c => (
            <div key={c.platform} className="flex items-center gap-2 py-0.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.is_connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className={`text-[11px] ${c.is_connected ? 'text-emerald-700' : 'text-slate-400'}`}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Topbar */}
        <div className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex items-center gap-3 justify-between flex-shrink-0">
          {/* Mobile: menu + back + title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500"
              aria-label="Fungua menyu"
            >
              <i className="ti ti-layout-sidebar" aria-hidden="true" />
            </button>
            <a
              href="/admin"
              className="lg:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Rudi Admin"
            >
              <i className="ti ti-arrow-left" aria-hidden="true" />
            </a>
            <div className="min-w-0">
              <h1 className="text-sm lg:text-base font-bold leading-tight truncate text-slate-900">
                {activeTabInfo ? activeTabInfo.label : 'Social Media'}
              </h1>
              <p className="text-xs mt-0.5 hidden sm:block text-slate-400">
                TikTok, Instagram + Facebook automation — NyumbaFasta
              </p>
            </div>
          </div>
        </div>

        {/* Mobile scrollable tab nav */}
        <div className="lg:hidden flex-shrink-0 border-b border-slate-200 overflow-x-auto bg-white" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1.5 px-3 py-2.5 min-w-max">
            {ALL_NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                  activeTab === item.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
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
                    className={`flex items-center gap-3 p-4 rounded-xl border ${
                      c.is_connected ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <PlatformLogo platform={c.platform} size={24} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                      <p className={`text-xs ${c.is_connected ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {c.is_connected ? 'Imeunganishwa' : 'Haijaunganishwa'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Period selector + Totals */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="font-semibold text-slate-800">Takwimu za Pamoja</h3>
                  <div className="flex gap-1 rounded-lg p-0.5 bg-slate-100">
                    {(['today', 'week', 'month', 'all'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setUnifiedPeriod(p)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          unifiedPeriod === p
                            ? 'bg-white text-teal-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
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
                      <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
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
                      <div key={c.label} className="text-center rounded-xl p-3 bg-slate-50 border border-slate-100">
                        <i className={`ti ti-${c.icon} text-lg text-slate-400`} aria-hidden="true" />
                        <div className="text-xl font-semibold text-slate-800 mt-0.5">{c.value.toLocaleString()}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{c.label}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Per-platform breakdown */}
              {unifiedStats && (unifiedStats.platforms?.length ?? 0) > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(unifiedStats.platforms ?? []).map(p => {
                    const colors: Record<string, string> = { instagram: '#c13584', facebook: '#1877f2', tiktok: '#131c24' }
                    return (
                      <div key={p.platform} className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <PlatformIcon platform={p.platform} />
                          <span className="font-semibold capitalize text-sm" style={{ color: colors[p.platform] ?? '#131c24' }}>
                            {p.platform}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-[10px] text-slate-400">Posts</span>
                            <p className="font-semibold text-slate-800">{p.totalPosts}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400">Zilipita</span>
                            <p className="font-semibold text-emerald-700">{p.successPosts}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400">Likes</span>
                            <p className="font-semibold text-slate-800">{p.totalLikes.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400">Maoni</span>
                            <p className="font-semibold text-slate-800">{p.totalComments.toLocaleString()}</p>
                          </div>
                          {p.totalViews > 0 && (
                            <div>
                              <span className="text-[10px] text-slate-400">Views</span>
                              <p className="font-semibold text-slate-800">{p.totalViews.toLocaleString()}</p>
                            </div>
                          )}
                          {p.failedPosts > 0 && (
                            <div>
                              <span className="text-[10px] text-slate-400">Zilishindwa</span>
                              <p className="font-semibold text-red-600">{p.failedPosts}</p>
                            </div>
                          )}
                        </div>
                        {p.lastPostAt && (
                          <p className="text-[10px] mt-3 text-slate-400">
                            Mwisho: {fmtDate(p.lastPostAt)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Quick post all */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold mb-3 text-slate-800">Chapisha Kwenye Platforms Zote</h3>
                {listings.length === 0 && !loading ? (
                  <div className="text-center py-4 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                    <i className="ti ti-home-off text-2xl text-slate-300" aria-hidden="true" />
                    <p className="text-sm text-slate-500 mt-2">Hakuna listings hai bado</p>
                    <a href="/admin/listings" className="text-xs text-teal-600 font-medium hover:underline mt-1 inline-block">
                      Idhini listings → /admin/listings
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={postAllListing}
                      onChange={e => setPostAllListing(e.target.value)}
                      className="w-full sm:flex-1 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 border border-slate-200 text-slate-800"
                    >
                      <option value="">-- Chagua listing ({listings.length}) --</option>
                      {listings.map(l => (
                        <option key={l.id} value={l.id}>{l.title} — {l.district}</option>
                      ))}
                    </select>
                    <button
                      onClick={handlePostAll}
                      disabled={postAllLoading || !postAllListing}
                      className="px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-all whitespace-nowrap"
                    >
                      {postAllLoading ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> Inachapisha...</> : <><i className="ti ti-rocket" aria-hidden="true" /> Chapisha Yote</>}
                    </button>
                  </div>
                )}
                <p className="text-xs mt-2 text-slate-400">
                  Itachapisha kwenye Instagram, Facebook, na TikTok kwa wakati mmoja.
                </p>
              </div>

              {/* Recent posts */}
              {unifiedStats && (unifiedStats.recentPosts?.length ?? 0) > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold mb-3 text-slate-800">Machapisho ya Hivi Karibuni</h3>
                  <div className="space-y-2">
                    {(unifiedStats.recentPosts ?? []).slice(0, 10).map(rp => {
                      const statusCls: Record<string, string> = {
                        posted: 'text-emerald-700', published: 'text-emerald-700',
                        failed: 'text-red-600', posting: 'text-blue-600', pending: 'text-amber-700',
                      }
                      return (
                        <div
                          key={rp.id + rp.platform}
                          className="flex items-center gap-3 text-sm py-2 border-b border-slate-50 last:border-0"
                        >
                          <PlatformIcon platform={rp.platform} />
                          <span className="capitalize w-20 text-xs text-slate-500">{rp.platform}</span>
                          <span className={`font-medium text-xs ${statusCls[rp.status] ?? 'text-slate-500'}`}>
                            {rp.status}
                          </span>
                          <span className="text-xs ml-auto text-slate-400">
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
                    <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Machapisho Yote',  value: stats.totalPosts,        icon: 'camera',         iconCls: 'bg-blue-50 text-blue-700',    valCls: 'text-blue-700'    },
                    { label: 'Yalichapishwa',     value: stats.publishedPosts,    icon: 'check',          iconCls: 'bg-emerald-50 text-emerald-700', valCls: 'text-emerald-700' },
                    { label: 'Wiki Hii',          value: stats.postsThisWeek,     icon: 'calendar',       iconCls: 'bg-violet-50 text-violet-700', valCls: 'text-violet-700'  },
                    { label: 'Maoni Yote',        value: stats.totalComments,     icon: 'message-circle', iconCls: 'bg-amber-50 text-amber-700',  valCls: 'text-amber-700'   },
                    { label: 'Maoni Bila Jibu',   value: stats.unrepliedComments, icon: 'alert-triangle', iconCls: 'bg-red-50 text-red-600',      valCls: 'text-red-600'     },
                    { label: 'Maoni Leo',         value: stats.commentsToday,     icon: 'bell',           iconCls: 'bg-violet-50 text-violet-700', valCls: 'text-violet-700' },
                    { label: 'DMs Zote',          value: stats.totalDMs,          icon: 'mail',           iconCls: 'bg-blue-50 text-blue-700',    valCls: 'text-blue-700'    },
                    { label: 'DMs Bila Jibu',     value: stats.unrepliedDMs,      icon: 'mail-x',         iconCls: 'bg-red-50 text-red-600',      valCls: 'text-red-600'     },
                  ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${card.iconCls}`}>
                        <i className={`ti ti-${card.icon}`} aria-hidden="true" />
                      </div>
                      <div className={`text-2xl font-bold ${card.valCls}`}>{card.value.toLocaleString()}</div>
                      <div className="text-xs mt-0.5 text-slate-500">{card.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-all"
                >
                  <i className="ti ti-video" aria-hidden="true" /> Pakia Video Mpya
                </button>
                <button
                  onClick={() => setActiveTab('listings')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
                >
                  <i className="ti ti-pencil" aria-hidden="true" /> Chapisha Listing
                </button>
              </div>

              <div className="mt-4 bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold mb-3 text-slate-800">Maarifa ya Mfumo</h3>
                <div className="space-y-2 text-sm text-slate-500">
                  <p><i className="ti ti-map-pin" aria-hidden="true" /> <strong>Webhook URL:</strong>{' '}
                    <code className="px-1 rounded text-xs bg-slate-100 text-slate-700">/api/v1/meta/webhook</code>
                    {' '}— weka kwenye Meta Developer Console
                  </p>
                  <p><i className="ti ti-key" aria-hidden="true" /> <strong>Verify Token:</strong>{' '}
                    tazama <code className="px-1 rounded text-xs bg-slate-100 text-slate-700">META_WEBHOOK_VERIFY_TOKEN</code> kwenye Vercel env vars
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
                <p className="text-sm text-slate-500">Jumla: {total} posts</p>
                <button
                  onClick={handleRefreshMetrics}
                  disabled={loading}
                  className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading ? '...' : <><i className="ti ti-refresh" aria-hidden="true" /> Sasisha Metrics</>}
                </button>
              </div>
              <div className="space-y-3">
                {posts.map(post => (
                  <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <PlatformIcon platform={post.platform} />
                          <StatusBadge status={post.status} />
                          <span className="text-xs text-slate-400">{post.media_type}</span>
                          {post.published_at && (
                            <span className="text-xs text-slate-400">{fmtDate(post.published_at)}</span>
                          )}
                        </div>
                        {post.listings && (
                          <p className="text-sm font-medium truncate text-slate-800">
                            {post.listings.title} — {post.listings.district}
                          </p>
                        )}
                        <p className="text-xs mt-1 line-clamp-2 text-slate-500">{post.caption}</p>
                      </div>
                    </div>
                    {post.metrics && Object.keys(post.metrics).length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
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
                  <div className="text-center py-16 text-slate-400">
                    <div className="text-4xl mb-3"><i className="ti ti-camera" aria-hidden="true" /></div>
                    <p className="font-medium text-slate-500">Hakuna machapisho katika kipindi hiki</p>
                    <p className="text-sm mt-1">
                      Jaribu kubadilisha kipindi cha muda, au{' '}
                      <button onClick={() => setActiveTab('listings')} className="text-teal-600 hover:underline">
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

          {activeTab === 'blog' && <BlogTab />}

          {/* ── MARKETPLACE ── */}
          {activeTab === 'marketplace' && <MarketplaceTab />}

          {/* ── SPAM ── */}
          {activeTab === 'spam' && <SpamTab />}

          {/* ── BEST TIME ── */}
          {activeTab === 'besttime' && <BestTimeTab />}

          {/* ── COMMENTS ── */}
          {activeTab === 'comments' && (
            <div>
              <p className="text-sm mb-4 text-slate-500">Jumla: {total} maoni</p>
              <div className="space-y-3">
                {comments.map(comment => (
                  <div key={comment.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <PlatformIcon platform={comment.platform} />
                          <CommentTypeBadge type={comment.comment_type} />
                          {comment.reply_sent
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Jibu limetumwa</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Halijalibiwa</span>
                          }
                          <span className="text-xs text-slate-400">{fmtDate(comment.created_at)}</span>
                        </div>
                        {comment.commenter_name && (
                          <p className="text-xs font-medium text-slate-500">@{comment.commenter_name}</p>
                        )}
                        <p className="text-sm mt-1 text-slate-800">{comment.comment_text}</p>
                        {comment.reply_text && (
                          <div className="mt-2 pl-3 border-l-2 border-teal-400">
                            <p className="text-xs font-medium text-slate-400">
                              {comment.reply_sent ? 'Jibu lililotumwa:' : 'Jibu la Amina:'}
                            </p>
                            <p className="text-xs text-slate-500">{comment.reply_text}</p>
                          </div>
                        )}
                      </div>
                      {!comment.reply_sent && (comment.platform === 'instagram' || comment.platform === 'facebook') && (
                        <button
                          onClick={() => { setReplyComment(comment); setReplyText('') }}
                          className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 mt-0.5 bg-blue-50 text-blue-700"
                        >
                          Jibu
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!loading && comments.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <div className="text-4xl mb-3"><i className="ti ti-message-circle" aria-hidden="true" /></div>
                    <p>Hakuna maoni bado</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DMs za Kijamii ── */}
          {activeTab === 'dms' && (() => {
            const filteredDms = dms.filter(dm => dmPlatformFilter === 'all' || dm.platform === dmPlatformFilter)
            const selectedDm  = dms.find(d => d.id === selectedDmId) ?? null
            return (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

                {/* Header */}
                <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0 bg-slate-900">
                  <div className="flex items-center gap-2.5">
                    <i className="ti ti-mail text-white" aria-hidden="true" />
                    <span className="font-semibold text-white text-sm">DMs za Kijamii</span>
                    {dms.filter(d => !d.reply_sent).length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600">
                        {dms.filter(d => !d.reply_sent).length}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 rounded-lg p-0.5 bg-white/10">
                    {(['all', 'instagram', 'facebook'] as const).map(p => (
                      <button key={p}
                        onClick={() => { setDmPlatformFilter(p); setSelectedDmId(null) }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          dmPlatformFilter === p ? 'bg-white text-slate-800' : 'text-white/60'
                        }`}
                      >
                        {p === 'all' ? 'Zote' : p === 'instagram' ? 'IG' : 'FB'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Two-panel body */}
                <div className="flex" style={{ height: '540px' }}>

                  {/* Left: DM list */}
                  <div className="w-[220px] sm:w-[280px] flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
                    {filteredDms.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                        <i className="ti ti-mail-off text-3xl" aria-hidden="true" />
                        <p className="text-xs text-center px-4">Hakuna DMs{dmPlatformFilter !== 'all' ? ` za ${dmPlatformFilter}` : ''} bado</p>
                      </div>
                    ) : (
                      filteredDms.map(dm => (
                        <button key={dm.id}
                          onClick={() => setSelectedDmId(dm.id)}
                          className="w-full text-left border-b border-slate-200 transition-all"
                        >
                          <div className={`px-3.5 py-3 border-l-2 transition-all ${
                            selectedDmId === dm.id ? 'border-l-teal-600 bg-teal-50' : 'border-l-transparent'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                dm.platform === 'instagram' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {(dm.sender_name ?? dm.sender_id ?? '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <p className="text-xs font-semibold truncate text-slate-800">
                                    {dm.sender_name ?? dm.sender_id}
                                  </p>
                                  <span className="flex-shrink-0"><PlatformIcon platform={dm.platform} /></span>
                                </div>
                                <p className="text-[11px] truncate text-slate-400">{dm.message_text}</p>
                              </div>
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${dm.reply_sent ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Right: conversation view */}
                  <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                    {!selectedDm ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center text-slate-400">
                        <i className="ti ti-messages text-4xl" aria-hidden="true" />
                        <p className="text-sm font-medium text-slate-500">Chagua DM kushoto</p>
                        <p className="text-xs">Bonyeza DM kwenye orodha kushoto kuona mazungumzo yake yote</p>
                      </div>
                    ) : (
                      <>
                        {/* Chat header */}
                        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-shrink-0 bg-white">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            selectedDm.platform === 'instagram' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {(selectedDm.sender_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight truncate text-slate-800">
                              {selectedDm.sender_name ?? selectedDm.sender_id}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <PlatformIcon platform={selectedDm.platform} />
                              <span className="text-[11px] capitalize text-slate-400">{selectedDm.platform}</span>
                              <span className="text-[11px] text-slate-400">· {fmtDate(selectedDm.created_at)}</span>
                            </div>
                          </div>
                          {selectedDm.reply_sent
                            ? <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-emerald-50 text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Imejibiwa
                              </span>
                            : <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-amber-50 text-amber-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Haijalibiwa
                              </span>
                          }
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-slate-50">
                          <div className="flex items-end gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              selectedDm.platform === 'instagram' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {(selectedDm.sender_name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="max-w-[75%]">
                              <div className="px-4 py-2.5 rounded-2xl rounded-bl-none text-sm shadow-sm bg-white text-slate-800">
                                {selectedDm.message_text}
                              </div>
                              <p className="text-[10px] mt-1 ml-1 text-slate-400">{fmtDate(selectedDm.created_at)}</p>
                            </div>
                          </div>

                          {selectedDm.reply_text ? (
                            <div className="flex items-end gap-2 flex-row-reverse">
                              <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                A
                              </div>
                              <div className="max-w-[75%]">
                                <div className="px-4 py-2.5 rounded-2xl rounded-br-none text-sm shadow-sm text-white bg-teal-600">
                                  {selectedDm.reply_text}
                                </div>
                                <p className="text-[10px] mt-1 mr-1 text-right text-slate-400">Amina AI · auto-reply</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <span className="text-[11px] px-3 py-1.5 rounded-full bg-slate-200 text-slate-500">
                                <i className="ti ti-robot mr-1" aria-hidden="true" />Amina bado hajajibu · inasubiri...
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Footer info */}
                        <div className="px-4 py-2.5 border-t border-slate-200 flex items-center gap-2 flex-shrink-0 bg-white">
                          <i className="ti ti-robot text-sm flex-shrink-0 text-slate-400" aria-hidden="true" />
                          <p className="text-[11px] text-slate-400">
                            DMs zinajibiwa otomatiki na Amina AI kwa Kiswahili cha Dar es Salaam
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>
            )
          })()}

          {/* ── SCHEDULE ── */}
          {activeTab === 'schedule' && (
            <div>
              <p className="text-sm mb-4 text-slate-500">Posts zilizopangwa: {total}</p>
              <div className="space-y-3">
                {(schedule as Array<{
                  id: string; platform: string; scheduled_at: string; status: string
                  listings?: { title: string; district: string }
                }>).map(item => (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={item.platform} />
                      <div className="flex-1">
                        {item.listings && (
                          <p className="text-sm font-medium text-slate-800">
                            {item.listings.title} — {item.listings.district}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">{fmtDate(item.scheduled_at)}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
                {!loading && schedule.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
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
              <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

        </div>{/* end .p-6 */}
      </div>{/* end main */}

      {/* ── Comment reply modal ─────────────────────────────────────────── */}
      {replyComment && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4"
          onClick={e => { if (e.target === e.currentTarget) setReplyComment(null) }}
        >
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-lg">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900 text-base">Jibu Maoni</h2>
                <button onClick={() => setReplyComment(null)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500">
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <PlatformIcon platform={replyComment.platform} />
                  {replyComment.commenter_name && <span className="text-xs font-medium text-gray-700">@{replyComment.commenter_name}</span>}
                </div>
                <p className="text-sm text-gray-800">{replyComment.comment_text}</p>
              </div>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={3}
                placeholder="Andika jibu lako..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 resize-none"
              />
              <button
                onClick={handleCommentReply}
                disabled={replying || !replyText.trim()}
                className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {replying ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-send" aria-hidden="true" />}
                {replying ? 'Inatuma...' : 'Tuma Jibu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg px-3 py-1.5 min-w-[60px] bg-slate-50 border border-slate-100">
      <span className="text-sm font-semibold text-slate-800">{value.toLocaleString()}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  )
}
