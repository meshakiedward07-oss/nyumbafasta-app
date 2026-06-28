'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback } from 'react'
import { VideoPlayer } from '@/components/listings/VideoPlayer'

// ── Types ──────────────────────────────────────────────────────────────────

type TikTokConnection = {
  id: string
  open_id: string
  display_name: string
  avatar_url: string
  follower_count: number
  connected_at: string
  token_expires_at: string
  is_active: boolean
}

type TikTokPost = {
  id: string
  listing_id: string | null
  publish_id: string | null
  video_id: string | null
  caption: string | null
  video_url: string
  status: string
  error_message: string | null
  tiktok_video_url: string | null
  privacy_level: string
  published_at: string | null
  created_at: string
  listings?: {
    id: string
    title: string
    type: string
    district: string
    region: string
    images: string[]
    location_display: string | null
  } | null
}

type Listing = {
  id: string
  title: string
  type: string
  district: string
  region: string
  images: string[]
  video_url: string | null
  location_display: string | null
  price_monthly: number
  bedrooms: number | null
  furnished: string
}

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Inasubiri'       },
  uploading:  { bg: 'bg-blue-50',    text: 'text-blue-600',   label: 'Inapakia'         },
  processing: { bg: 'bg-amber-50',   text: 'text-amber-600',  label: 'Inashughulikia'  },
  published:  { bg: 'bg-green-50',   text: 'text-green-600',  label: 'Imechapishwa'     },
  failed:     { bg: 'bg-red-50',     text: 'text-red-600',    label: 'Imeshindwa'        },
  cancelled:  { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Imesimamishwa'    },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function buildCaption(listing: Listing): string {
  const price = listing.price_monthly.toLocaleString('sw-TZ')
  const location = listing.location_display ?? `${listing.district}, ${listing.region}`
  const typeMap: Record<string, string> = {
    chumba: 'Chumba', apartment: 'Apartment',
    nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
  }
  const type = typeMap[listing.type] ?? listing.type
  const bedroomLine = listing.bedrooms ? `🛏️ Vyumba ${listing.bedrooms}\n` : ''
  const furnishedLine =
    listing.furnished === 'furnished' ? '✨ Imejengwa (Furnished)\n'
    : listing.furnished === 'semi'    ? '🪑 Semi-furnished\n'
    : ''

  return `🏠 ${type} inapatikana!

📍 ${location}
💰 TZS ${price}/mwezi
${bedroomLine}${furnishedLine}
✅ Imeidhinishwa na NyumbaFasta
📱 nyumbafasta.co

#NyumbaFasta #NyumbaZaKupanga #Tanzania #DarEsSalaam #RealEstate #MaliIsiyohamia`.trim()
}

// ── ListingPicker ──────────────────────────────────────────────────────────

function ListingPicker({
  selected,
  onSelect,
}: {
  selected: Listing | null
  onSelect: (l: Listing) => void
}) {
  const [open, setOpen] = useState(false)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/v1/listings?status=active&limit=100')
      .then(r => r.json())
      .then((d: { listings?: Listing[] }) => setListings((d.listings ?? []).filter(l => !!l.video_url)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Chagua Listing</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-2 rounded-xl text-sm hover:border-gray-300 transition-colors text-left"
      >
        <span className={selected ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {selected ? `${selected.title} — ${selected.district}` : 'Chagua listing yenye video...'}
        </span>
        <i className={`ti ti-chevron-${open ? 'up' : 'down'} text-gray-400 text-xs`} aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-2 border-2 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-white shadow-lg z-10 relative">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-400">Inapakia listings...</div>
          ) : listings.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">
              Hakuna listings zenye video
            </div>
          ) : (
            listings.map(l => (
              <button
                key={l.id}
                type="button"
                onClick={() => { onSelect(l); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b last:border-b-0"
              >
                {l.images?.[0] && (
                  <img src={l.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.title}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {l.location_display ?? `${l.district}, ${l.region}`}
                  </p>
                </div>
                <i className="ti ti-video text-green-500 text-xs flex-shrink-0" aria-hidden="true" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Post Row ───────────────────────────────────────────────────────────────

function PostRow({ post }: { post: TikTokPost }) {
  const cfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.pending

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
      {/* Thumbnail */}
      <div className="w-16 h-16 bg-gray-900 rounded-xl overflow-hidden flex-shrink-0 relative">
        {post.listings?.images?.[0] ? (
          <img src={post.listings.images[0]} alt="" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-xl"><i className="ti ti-movie" aria-hidden="true" /></div>
        )}
        <div className="absolute bottom-1 right-1 text-white text-[10px] font-bold">TT</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {post.listings?.title ?? post.caption?.slice(0, 50) ?? '—'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {post.listings?.location_display ?? (post.listings ? `${post.listings.district}` : '')}
          {post.published_at ? ` • ${fmtDate(post.published_at)}` : ` • ${fmtDate(post.created_at)}`}
        </p>
        {post.error_message && (
          <p className="text-xs text-red-500 mt-0.5 truncate">{post.error_message}</p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
        {post.tiktok_video_url && (
          <a
            href={post.tiktok_video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-black underline flex items-center gap-1"
          >
            ↗ TikTok
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main TikTokTab ─────────────────────────────────────────────────────────

export default function TikTokTab({ showToast }: { showToast: (msg: string) => void }) {
  const [connection, setConnection] = useState<TikTokConnection | null>(null)
  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  // Post form state
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [caption, setCaption] = useState('')
  const [privacy, setPrivacy] = useState('PUBLIC_TO_EVERYONE')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [connRes, postsRes] = await Promise.all([
        fetch('/api/v1/social/tiktok/connection'),
        fetch('/api/v1/social/tiktok/posts'),
      ])
      const [connData, postsData] = await Promise.all([
        connRes.json() as Promise<{ connection: TikTokConnection | null }>,
        postsRes.json() as Promise<{ posts: TikTokPost[] }>,
      ])
      setConnection(connData.connection)
      setPosts(postsData.posts ?? [])
    } catch {
      showToast('Hitilafu ya kupakia data')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadAll()

    // Handle OAuth redirect params
    const params = new URLSearchParams(window.location.search)
    if (params.get('tiktok') === 'connected') {
      showToast('TikTok imaunganishwa kwa mafanikio!')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('tiktok') === 'error') {
      showToast(`TikTok error: ${params.get('msg') ?? 'Imeshindwa'}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [loadAll, showToast])

  function handleSelectListing(l: Listing) {
    setSelectedListing(l)
    setCaption(buildCaption(l))
  }

  async function handleConnect() {
    window.location.href = '/api/v1/social/tiktok/connect'
  }

  async function handleDisconnect() {
    if (!confirm('Kata muunganiko wa TikTok?')) return
    const res = await fetch('/api/v1/social/tiktok/disconnect', { method: 'POST' })
    if (res.ok) {
      showToast('TikTok imekatwa')
      setConnection(null)
    }
  }

  async function handlePost() {
    if (!selectedListing?.video_url) { showToast('Chagua listing yenye video'); return }
    if (!caption.trim()) { showToast('Ongeza maelezo (caption)'); return }

    setPosting(true)
    try {
      const res = await fetch('/api/v1/social/tiktok/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: selectedListing.id,
          videoUrl: selectedListing.video_url,
          caption,
          privacyLevel: privacy,
        }),
      })
      const data = await res.json() as { success: boolean; publishId?: string; error?: string }
      if (data.success) {
        showToast('Video imetumwa TikTok — inaendelea kushughulikiwa...')
        setSelectedListing(null)
        setCaption('')
        await loadAll()
      } else {
        showToast(`Imeshindwa: ${data.error ?? 'Imeshindwa'}`)
      }
    } catch {
      showToast('Hitilafu ya mtandao')
    } finally {
      setPosting(false)
    }
  }

  // ── Published / failed counts ──────────────────────────────────────────
  const publishedCount   = posts.filter(p => p.status === 'published').length
  const processingCount  = posts.filter(p => p.status === 'processing').length
  const failedCount      = posts.filter(p => p.status === 'failed').length

  return (
    <div className="space-y-5">

      {/* ── Connection Card ────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-5 border-2 ${connection ? 'bg-black border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${connection ? 'bg-white/10' : 'bg-gray-100'}`}>
              <i className={`ti ti-brand-tiktok text-3xl ${connection ? 'text-white' : 'text-gray-700'}`} aria-hidden="true" />
            </div>

            <div>
              {connection ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                    <p className="font-bold text-white text-lg">Imeunganishwa</p>
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5">@{connection.display_name || connection.open_id}</p>
                  {connection.follower_count > 0 && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      {connection.follower_count.toLocaleString()} wafuatiliaji
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-bold text-gray-900 text-lg">TikTok Haijaunganishwa</p>
                  <p className="text-gray-500 text-sm mt-0.5">Unganisha akaunti yako ya biashara</p>
                </>
              )}
            </div>
          </div>

          {connection ? (
            <div className="flex items-center gap-3">
              {connection.avatar_url && (
                <img src={connection.avatar_url} alt={connection.display_name}
                  className="w-10 h-10 rounded-full border-2 border-gray-700 object-cover" />
              )}
              <button
                onClick={handleDisconnect}
                className="text-sm text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-400 px-4 py-2 rounded-xl transition-colors"
              >
                Kata Muunganiko
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 bg-white text-black font-bold px-5 py-3 rounded-2xl hover:bg-gray-100 transition-colors text-sm"
            >
              <i className="ti ti-brand-tiktok" aria-hidden="true" /> Unganisha TikTok
            </button>
          )}
        </div>

        {/* Stats bar (only when connected) */}
        {connection && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-800">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{publishedCount}</p>
              <p className="text-gray-500 text-xs">Zilizochapishwa</p>
            </div>
            {processingCount > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">{processingCount}</p>
                <p className="text-gray-500 text-xs">Zinasindikwa</p>
              </div>
            )}
            <div className="text-center">
              <p className={`text-2xl font-bold ${failedCount > 0 ? 'text-red-400' : 'text-gray-600'}`}>{failedCount}</p>
              <p className="text-gray-500 text-xs">Zilizoshindwa</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{posts.length}</p>
              <p className="text-gray-500 text-xs">Jumla</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-gray-400 text-xs">Iliunganishwa</p>
              <p className="text-gray-500 text-xs">{fmtDate(connection.connected_at)}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Post Video Form ────────────────────────────────────────────── */}
      {connection && (
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2"><i className="ti ti-upload" aria-hidden="true" /> Chapisha Video ya Listing</h3>

          <ListingPicker selected={selectedListing} onSelect={handleSelectListing} />

          {selectedListing && (
            <>
              {/* Video preview */}
              <VideoPlayer
                src={selectedListing.video_url!}
                title={selectedListing.title}
              />

              {/* Caption */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Maelezo (Caption)
                </label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={6}
                  maxLength={2200}
                  className={`w-full px-4 py-3 border-2 rounded-xl text-sm resize-none focus:outline-none transition-colors ${
                    caption.length > 2090 ? 'border-red-400 focus:border-red-500' : 'focus:border-black'
                  }`}
                  placeholder="Andika maelezo ya video..."
                />
                <p className={`text-xs mt-1 text-right font-medium ${
                  caption.length > 2090 ? 'text-red-500' : caption.length > 1760 ? 'text-amber-500' : 'text-gray-400'
                }`}>
                  {caption.length}/2200
                  {caption.length > 2090 && ' — umefika kikomo!'}
                  {caption.length > 1760 && caption.length <= 2090 && ' — karibu na kikomo'}
                </p>
              </div>

              {/* Privacy */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mipangilio ya Faragha</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'PUBLIC_TO_EVERYONE',    label: 'Wote',         desc: 'Kila mtu anaona', icon: 'world' },
                    { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Marafiki',     desc: 'Wafuatiliaji tu', icon: 'users' },
                    { value: 'SELF_ONLY',             label: 'Mimi tu',      desc: 'Test / Preview', icon: 'lock' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrivacy(opt.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        privacy === opt.value
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-sm flex items-center gap-1.5"><i className={`ti ti-${(opt as {icon?:string}).icon ?? 'circle'}`} aria-hidden="true" /> {opt.label}</p>
                      <p className={`text-xs mt-0.5 ${privacy === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Post button */}
              <button
                type="button"
                onClick={handlePost}
                disabled={posting || !caption.trim()}
                className="w-full bg-black hover:bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {posting ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Inachapisha TikTok...
                  </>
                ) : (
                  <><i className="ti ti-brand-tiktok" aria-hidden="true" /> Chapisha kwenye TikTok</>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Posts History ──────────────────────────────────────────────── */}
      {connection && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><i className="ti ti-list" aria-hidden="true" /> Historia ya Machapisho</h3>
            <button
              type="button"
              onClick={loadAll}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
<i className="ti ti-refresh" aria-hidden="true" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-100 rounded w-48" />
                    <div className="h-3 bg-gray-100 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center">
<p className="text-5xl mb-3"><i className="ti ti-brand-tiktok" aria-hidden="true" /></p>
              <p className="text-gray-400 text-sm">Hakuna machapisho bado</p>
            </div>
          ) : (
            <div className="divide-y">
              {posts.map(post => (
                <PostRow key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Info (not connected) ───────────────────────────────────────── */}
      {!connection && !loading && (
        <div className="bg-gray-50 border rounded-2xl p-5 space-y-3">
<h4 className="font-semibold text-gray-800 flex items-center gap-2"><i className="ti ti-tool" aria-hidden="true" /> Jinsi ya Kuunganisha</h4>
          <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
            <li>Bonyeza <strong>Unganisha TikTok</strong> hapo juu</li>
            <li>Ingia kwenye akaunti yako ya TikTok for Business</li>
            <li>Ruhusa itaombwa — kubali kupakia na kuchapisha video</li>
            <li>Utarudi hapa ukisha ingia — muunganiko utaonekana</li>
          </ol>
          <div className="bg-white border rounded-xl p-4 text-sm">
            <p className="font-medium text-gray-700 mb-1">Webhook URL:</p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
              https://nyumbafasta.co/api/v1/social/tiktok/webhook
            </code>
          </div>
        </div>
      )}
    </div>
  )
}
