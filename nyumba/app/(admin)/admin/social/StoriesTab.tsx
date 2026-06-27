'use client'
import { useState, useEffect } from 'react'

type Story = {
  id: string
  listing_id: string | null
  story_type: string
  media_url: string
  story_id: string | null
  status: string
  error_message: string | null
  expires_at: string | null
  posted_at: string | null
  created_at: string
  listings: { title: string; district: string; region: string; images: string[] } | null
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60)  return `Dakika ${mins} zilizopita`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `Masaa ${hrs} yaliyopita`
  return `Siku ${Math.floor(hrs / 24)} zilizopita`
}

function expiresIn(iso: string | null) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Imeisha muda'
  const hrs = Math.floor(ms / 3600000)
  if (hrs < 1) return `Inaisha dakika ${Math.floor(ms / 60000)}`
  return `Inaisha masaa ${hrs}`
}

export default function StoriesTab() {
  const [stories, setStories]       = useState<Story[]>([])
  const [loading, setLoading]       = useState(true)
  const [posting, setPosting]       = useState(false)
  const [toast, setToast]           = useState<string | null>(null)

  // Form state
  const [storyType, setStoryType]   = useState<'listing' | 'promotion'>('listing')
  const [listings, setListings]     = useState<{ id: string; title: string; district: string }[]>([])
  const [listingsError, setListingsError] = useState(false)
  const [selectedListing, setSelectedListing] = useState('')
  const [promoImageUrl, setPromoImageUrl]     = useState('')
  const [promoLinkUrl, setPromoLinkUrl]       = useState('')

  function showMsg(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function fetchStories() {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/social/stories')
      const data = await res.json() as { stories?: Story[] }
      setStories(data.stories ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function fetchListings() {
    setListingsError(false)
    try {
      const res  = await fetch('/api/v1/listings?status=active&limit=50')
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json() as { listings?: { id: string; title: string; district: string }[] }
      const fetched = data.listings ?? []
      setListings(fetched)
      if (fetched.length === 0) setListingsError(false)
    } catch {
      setListingsError(true)
    }
  }

  useEffect(() => { fetchStories(); fetchListings() }, [])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    setPosting(true)
    try {
      const body: Record<string, string> = { storyType }
      if (storyType === 'listing') {
        if (!selectedListing) { showMsg('Chagua listing kwanza'); setPosting(false); return }
        body.listingId = selectedListing
      } else {
        if (!promoImageUrl) { showMsg('Weka URL ya picha'); setPosting(false); return }
        body.imageUrl = promoImageUrl
        if (promoLinkUrl) body.linkUrl = promoLinkUrl
      }

      const res  = await fetch('/api/v1/social/stories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      type PlatformResult = { platform: string; success: boolean; storyId?: string; error?: string }
      const data = await res.json() as {
        ok?: boolean
        successCount?: number
        failedCount?:  number
        results?:      PlatformResult[]
        error?: string
      }

      if (data.ok || (data.successCount ?? 0) > 0) {
        const platforms = (data.results ?? [])
          .filter(r => r.success)
          .map(r => r.platform.toUpperCase())
          .join(' + ')
        showMsg(`✅ Story imechapishwa kwenye ${platforms || 'platforms'}! (${data.successCount}/${(data.results?.length ?? 1)})`)
        setSelectedListing(''); setPromoImageUrl(''); setPromoLinkUrl('')
        fetchStories()
      } else {
        const errs = (data.results ?? []).filter(r => !r.success).map(r => `${r.platform}: ${r.error}`).join(', ')
        showMsg(`❌ Imeshindwa: ${errs || data.error}`)
      }
    } finally {
      setPosting(false)
    }
  }

  const statusColor: Record<string, string> = {
    posted:  'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    failed:  'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      {/* Post Story Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">🔴 Tuma Story Mpya</h2>
        <form onSubmit={handlePost} className="space-y-4">
          {/* Story type selector */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Aina ya Story</label>
            <div className="flex gap-2">
              {(['listing', 'promotion'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setStoryType(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    storyType === t
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t === 'listing' ? '🏠 Listing Story' : '📢 Promo Story'}
                </button>
              ))}
            </div>
          </div>

          {/* Listing Story fields */}
          {storyType === 'listing' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">Chagua Listing</label>
                {listingsError && (
                  <button
                    type="button"
                    onClick={fetchListings}
                    className="text-xs text-primary-500 hover:underline"
                  >
                    🔄 Jaribu tena
                  </button>
                )}
              </div>
              {listingsError ? (
                <div className="w-full border border-red-200 bg-red-50 rounded-xl px-3 py-2.5 text-sm text-red-600">
                  ❌ Imeshindwa kupakia listings. Angalia muunganiko wako.
                </div>
              ) : (
                <select
                  value={selectedListing}
                  onChange={e => setSelectedListing(e.target.value)}
                  disabled={listings.length === 0}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">
                    {listings.length === 0 ? 'Inapakia listings...' : '-- Chagua listing --'}
                  </option>
                  {listings.map(l => (
                    <option key={l.id} value={l.id}>{l.title} — {l.district}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Picha ya listing itapigwa 9:16, watermark itaongezwa. Story itatumwa kwa IG + FB + TikTok (kama video ipo).
              </p>
            </div>
          )}

          {/* Promo Story fields */}
          {storyType === 'promotion' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">URL ya Picha *</label>
                <input
                  type="url"
                  value={promoImageUrl}
                  onChange={e => setPromoImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Picha inahitaji kuwa ya hadharani (public HTTPS URL). Ukubwa bora: 1080×1920</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">URL ya Link Sticker (hiari)</label>
                <input
                  type="url"
                  value={promoLinkUrl}
                  onChange={e => setPromoLinkUrl(e.target.value)}
                  placeholder="https://nyumbafasta.co/..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={posting}
            className="btn-primary w-full py-3"
          >
            {posting ? '⏳ Inachapisha...' : '🚀 Tuma Story Sasa'}
          </button>
        </form>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
          <p className="font-semibold mb-1">ℹ️ Kuhusu Stories (IG + FB + TikTok):</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>IG Story + FB Story zinachapishwa kwa picha daima</li>
            <li>TikTok Story inachapishwa kama video (kama listing ina video)</li>
            <li>Stories zinaisha kiotomatiki baada ya masaa 24</li>
            <li>Link sticker (IG) inahitaji ruhusa ya <code>pages_read_engagement</code></li>
            <li>Ukubwa bora wa picha: 1080 × 1920 px (9:16)</li>
          </ul>
        </div>
      </div>

      {/* Stories history */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">📋 Historia ya Stories</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔴</div>
            <p>Hakuna stories bado</p>
            <p className="text-sm mt-1">Tuma story yako ya kwanza hapo juu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map(story => {
              const expiry = expiresIn(story.expires_at)
              return (
                <div key={story.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-10 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={story.media_url}
                        alt="Story"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[story.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {story.status}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{story.story_type}</span>
                        {story.posted_at && (
                          <span className="text-xs text-gray-400">{timeAgo(story.posted_at)}</span>
                        )}
                      </div>
                      {story.listings && (
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {story.listings.title} — {story.listings.district}
                        </p>
                      )}
                      {expiry && story.status === 'posted' && (
                        <p className={`text-xs mt-1 ${expiry.includes('Imeisha') ? 'text-gray-400' : 'text-amber-600'}`}>
                          ⏳ {expiry}
                        </p>
                      )}
                      {story.error_message && (
                        <p className="text-xs text-red-500 mt-1 truncate">{story.error_message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
