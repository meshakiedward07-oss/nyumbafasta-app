'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

type SocialStatus = { instagram: string | null; facebook: string | null; tiktok: string | null }

type SocialListing = {
  id: string
  title: string
  type: string
  district: string
  region: string
  price_monthly: number
  images: string[]
  video_url: string | null
  bedrooms: number | null
  furnished: string
  is_boosted: boolean
  created_at: string
  social: SocialStatus
}

type PostingListing = { id: string; platform: string } | null

type Props = {
  showToast: (msg: string) => void
  onOpenFull: (listingId: string) => void   // switch to postnow tab with listing pre-selected
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'leo'
  if (days === 1) return 'jana'
  if (days < 7) return `siku ${days}`
  return `wiki ${Math.floor(days / 7)}`
}

function PlatformBadge({ label, icon, posted, date }: { label: string; icon: string; posted: boolean; date: string | null }) {
  return (
    <span
      title={posted ? `Mwisho: ${timeAgo(date)} iliyopita` : `Haijachapishwa ${label}`}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
        posted
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-50 text-gray-400 border-gray-200'
      }`}
    >
      <i className={`ti ti-${icon}`} aria-hidden="true" />
      {posted ? timeAgo(date) : '—'}
    </span>
  )
}

type Filter = 'all' | 'unposted' | 'posted'

export default function ListingsTab({ showToast, onOpenFull }: Props) {
  const [listings, setListings]       = useState<SocialListing[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<Filter>('all')
  const [posting, setPosting]         = useState<PostingListing>(null)
  const [search, setSearch]           = useState('')

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/social/listings')
      const data = await res.json() as { listings?: SocialListing[] }
      setListings(data.listings ?? [])
    } catch {
      showToast('Imeshindwa kupakia listings')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchListings() }, [fetchListings])

  async function postListing(listingId: string, platform: string) {
    setPosting({ id: listingId, platform })
    try {
      const endpoint = platform === 'story'
        ? '/api/v1/social/stories'
        : platform === 'carousel'
        ? '/api/v1/social/carousel'
        : '/api/v1/social/post'

      const body = platform === 'story'
        ? { storyType: 'listing', listingId }
        : platform === 'carousel'
        ? { listingId }
        : { listingId, platform }

      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { ok?: boolean; success?: boolean; error?: string; successCount?: number }

      if (res.ok) {
        const label = platform === 'all' ? 'Zote (IG+FB+TikTok)' : platform
        showToast(`Imechapishwa kwenye ${label}!`)
        // Refresh to update post badges
        await fetchListings()
      } else {
        showToast(data.error ?? 'Imeshindwa kuchapisha')
      }
    } catch {
      showToast('Hitilafu ya mtandao')
    } finally {
      setPosting(null)
    }
  }

  const filtered = listings.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      l.title.toLowerCase().includes(q) ||
      l.district.toLowerCase().includes(q) ||
      l.region.toLowerCase().includes(q)
    const hasAnyPost = !!(l.social.instagram || l.social.facebook || l.social.tiktok)
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'posted'   ? hasAnyPost :
      /* unposted */          !hasAnyPost
    return matchSearch && matchFilter
  })

  const unpostedCount = listings.filter(l => !l.social.instagram && !l.social.facebook && !l.social.tiktok).length

  return (
    <div className="space-y-4">

      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-lg" style={{ color: '#1a1a18' }}>
            Listings Library
          </h2>
          <p className="text-sm" style={{ color: '#666660' }}>
            {listings.length} active · {unpostedCount > 0 && (
              <span className="text-amber-600 font-medium">{unpostedCount} haziajchapishwa</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchListings}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          <i className={`ti ti-refresh ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta listing..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ border: '1px solid #e5e5e0' }}
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'unposted', 'posted'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                filter === f
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f === 'all' ? 'Zote' : f === 'unposted' ? 'Haziajchapishwa' : 'Imechapishwa'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-64 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <i className="ti ti-photo-off text-4xl text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500 mt-3 font-medium">
            {search ? 'Hakuna listings zinazofanana na utafutaji wako' : 'Hakuna listings'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(listing => {
            const cover      = listing.images?.[0]
            const isPending  = posting?.id === listing.id
            const neverPosted = !listing.social.instagram && !listing.social.facebook && !listing.social.tiktok
            const typeLabel: Record<string, string> = {
              chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba',
              studio: 'Studio', duka: 'Duka',
            }

            return (
              <div
                key={listing.id}
                className={`bg-white rounded-xl border overflow-hidden flex flex-col transition-shadow hover:shadow-md ${
                  neverPosted ? 'border-amber-200' : 'border-gray-100'
                }`}
              >
                {/* Cover image */}
                <div className="relative h-36 bg-gray-100 flex-shrink-0">
                  {cover ? (
                    <Image fill src={cover} alt={listing.title} className="object-cover" sizes="400px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="ti ti-home text-4xl text-gray-300" aria-hidden="true" />
                    </div>
                  )}

                  {/* Type badge */}
                  <span className="absolute top-2 left-2 bg-primary-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {typeLabel[listing.type] ?? listing.type}
                  </span>

                  {/* Video badge */}
                  {listing.video_url && (
                    <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <i className="ti ti-video" aria-hidden="true" /> Video
                    </span>
                  )}

                  {/* Never-posted warning stripe */}
                  {neverPosted && (
                    <div className="absolute bottom-0 left-0 right-0 bg-amber-400/90 text-white text-[10px] font-semibold text-center py-0.5 tracking-wide">
                      <i className="ti ti-alert-triangle" aria-hidden="true" /> HAIJACHAPISHWA
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{listing.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <i className="ti ti-map-pin" aria-hidden="true" />
                      {listing.district}, {listing.region}
                    </p>
                    <p className="text-xs font-bold text-primary-600 mt-0.5">
                      Tsh {listing.price_monthly.toLocaleString()}/mwezi
                      {listing.bedrooms ? <span className="text-gray-400 font-normal"> · {listing.bedrooms} vyumba</span> : null}
                    </p>
                  </div>

                  {/* Platform status badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PlatformBadge label="Instagram" icon="brand-instagram" posted={!!listing.social.instagram} date={listing.social.instagram} />
                    <PlatformBadge label="Facebook"  icon="brand-facebook"  posted={!!listing.social.facebook}  date={listing.social.facebook}  />
                    <PlatformBadge label="TikTok"    icon="brand-tiktok"    posted={!!listing.social.tiktok}    date={listing.social.tiktok}    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                    {/* Post All */}
                    <button
                      onClick={() => postListing(listing.id, 'all')}
                      disabled={!!posting}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isPending && posting?.platform === 'all'
                        ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> Inachapisha...</>
                        : <><i className="ti ti-world" aria-hidden="true" /> Zote</>}
                    </button>

                    {/* IG */}
                    <button
                      onClick={() => postListing(listing.id, 'instagram')}
                      disabled={!!posting}
                      title="Post to Instagram"
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-pink-200 text-pink-600 hover:bg-pink-50 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isPending && posting?.platform === 'instagram'
                        ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                        : <i className="ti ti-brand-instagram" aria-hidden="true" />}
                    </button>

                    {/* FB */}
                    <button
                      onClick={() => postListing(listing.id, 'facebook')}
                      disabled={!!posting}
                      title="Post to Facebook"
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isPending && posting?.platform === 'facebook'
                        ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                        : <i className="ti ti-brand-facebook" aria-hidden="true" />}
                    </button>

                    {/* Story */}
                    <button
                      onClick={() => postListing(listing.id, 'story')}
                      disabled={!!posting}
                      title="Post as Story"
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {isPending && posting?.platform === 'story'
                        ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                        : <i className="ti ti-circle-dot" aria-hidden="true" />}
                    </button>

                    {/* More options — open full postnow panel */}
                    <button
                      onClick={() => onOpenFull(listing.id)}
                      title="Chaguo zaidi (schedule, caption, carousel)"
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-all active:scale-95"
                    >
                      <i className="ti ti-dots" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
