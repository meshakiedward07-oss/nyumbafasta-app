'use client'
import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'posts' | 'comments' | 'dms' | 'postnow' | 'schedule'

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
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [stats, setStats]         = useState<SocialStats | null>(null)
  const [posts, setPosts]         = useState<SocialPost[]>([])
  const [comments, setComments]   = useState<Comment[]>([])
  const [dms, setDMs]             = useState<DM[]>([])
  const [schedule, setSchedule]   = useState<unknown[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  // Post Now state
  const [listings, setListings]       = useState<Listing[]>([])
  const [selectedListing, setSelectedListing] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<'instagram' | 'facebook' | 'both'>('both')
  const [generatedCaption, setGeneratedCaption] = useState('')
  const [generatedHashtags, setGeneratedHashtags] = useState('')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [postLoading, setPostLoading] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = useCallback(async (tab: Tab) => {
    setLoading(true)
    try {
      if (tab === 'overview') {
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
  }, [])

  useEffect(() => {
    fetchData(activeTab)
  }, [activeTab, fetchData])

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
    { id: 'overview', label: 'Muhtasari',  emoji: '📊' },
    { id: 'posts',    label: 'Machapisho', emoji: '📸' },
    { id: 'comments', label: 'Maoni',      emoji: '💬' },
    { id: 'dms',      label: 'DMs',        emoji: '📨' },
    { id: 'postnow',  label: 'Chapisha',   emoji: '✍️' },
    { id: 'schedule', label: 'Ratiba',     emoji: '📅' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Social Media</h1>
        <p className="text-sm text-gray-500 mt-0.5">Instagram + Facebook automation — NyumbaFasta</p>
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
                ? 'bg-white text-[#1D9E75] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

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

          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
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
              className="px-3 py-1.5 bg-[#1D9E75] text-white text-sm rounded-lg hover:bg-[#178a65] disabled:opacity-50"
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
                      <div className="mt-2 pl-3 border-l-2 border-[#1D9E75]">
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
                      <div className="mt-2 pl-3 border-l-2 border-[#1D9E75]">
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
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

            {/* Platform */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Jukwaa</label>
              <div className="flex gap-2">
                {(['instagram', 'facebook', 'both'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPlatform(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      selectedPlatform === p
                        ? 'bg-[#1D9E75] text-white border-[#1D9E75]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {p === 'instagram' ? '📸 Instagram' : p === 'facebook' ? '👤 Facebook' : '🌐 Vyote Viwili'}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
              />
              {generatedHashtags && (
                <p className="text-xs text-gray-500 mt-1">Hashtags: {generatedHashtags}</p>
              )}
            </div>

            {/* Schedule (optional) */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Panga Muda (hiari)</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
              />
              <p className="text-xs text-gray-400 mt-1">Acha wazi kwa kuchapisha sasa hivi</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handlePost}
                disabled={postLoading || !selectedListing}
                className="flex-1 py-3 bg-[#1D9E75] text-white font-semibold rounded-xl hover:bg-[#178a65] disabled:opacity-50 transition-all"
              >
                {postLoading ? '⏳ Inachapisha...' : scheduledAt ? '📅 Panga' : '🚀 Chapisha Sasa'}
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
          <div className="w-6 h-6 border-2 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
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
