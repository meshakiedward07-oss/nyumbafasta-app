'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Dalali {
  id: string
  name: string
  username: string
  avatarUrl: string | null
  isVerified: boolean
  bio: string | null
  ratingAvg: number
  ratingCount: number
}

interface Listing {
  id: string
  title: string | null
  type: string
  price_monthly: number
  district: string
  region: string
  images: string[] | null
  bedrooms: number | null
  is_boosted: boolean
  view_count: number
}

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

interface Props {
  dalali: Dalali
  listings: Listing[]
  reviews: Review[]
}

const TYPE_LABELS: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment',
  nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
}

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

export default function AgentProfileClient({ dalali, listings, reviews }: Props) {
  const [filter, setFilter]       = useState<string>('zote')
  const [query, setQuery]         = useState('')
  const [copied, setCopied]       = useState(false)
  const [showContact, setShowContact] = useState(false)

  // Track profile view once on mount
  useEffect(() => {
    fetch('/api/v1/profile/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dalaliId: dalali.id, referrer: document.referrer }),
    }).catch(() => {})
  }, [dalali.id])

  // Derive unique listing types for filter tabs
  const types = ['zote', ...Array.from(new Set(listings.map(l => l.type)))]

  const filtered = listings.filter(l => {
    const matchType  = filter === 'zote' || l.type === filter
    const matchQuery = !query ||
      (l.title ?? '').toLowerCase().includes(query.toLowerCase()) ||
      l.district.toLowerCase().includes(query.toLowerCase())
    return matchType && matchQuery
  })

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: `${dalali.name} | NyumbaFasta`, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    }
    fetch('/api/v1/profile/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dalaliId: dalali.id, eventType: 'share_click' }),
    }).catch(() => {})
  }

  function handleContactClick() {
    fetch('/api/v1/profile/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dalaliId: dalali.id, eventType: 'whatsapp_click' }),
    }).catch(() => {})
    setShowContact(true)
  }

  // The best listing to send the client to (for the unlock flow)
  const contactListing = listings[0]

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header / brand bar ─────────────────────────────── */}
      <header className="bg-primary-500 sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-2">
          <Link href="/" className="h-10 w-[160px] block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/transparent_logo_nyumbafasta.png"
              alt="NyumbaFasta"
              className="h-full w-full object-contain object-left"
            />
          </Link>
          <Link href="/" className="text-white/80 text-xs font-medium hover:text-white transition-colors">
            Tafuta nyumba →
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-28 pt-4">

        {/* ── Profile card ───────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-start gap-4">

            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
              {dalali.avatarUrl ? (
                <Image src={dalali.avatarUrl} alt={dalali.name} width={64} height={64} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-primary-500 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{dalali.name.charAt(0)}</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">{dalali.name}</h1>
                {dalali.isVerified && (
                  <span className="inline-flex items-center gap-1 bg-primary-500 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    <i className="ti ti-rosette-discount-check text-xs" aria-hidden="true" />
                    Verified
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-0.5">
                Dalali wa NyumbaFasta · Tanzania
              </p>

              {dalali.ratingCount > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <i className="ti ti-star-filled text-amber-400 text-sm" aria-hidden="true" />
                  <span className="text-sm font-semibold text-gray-800">{dalali.ratingAvg.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({dalali.ratingCount} maoni)</span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                <i className="ti ti-home text-xs" aria-hidden="true" />
                <span>{listings.length} listing{listings.length !== 1 ? 's' : ''} hai</span>
              </div>
            </div>
          </div>

          {dalali.bio && (
            <p className="text-sm text-gray-600 leading-relaxed mt-4 border-t border-gray-50 pt-3">
              {dalali.bio}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            {/* Wasiliana — goes through unlock flow on a listing detail */}
            <button
              onClick={handleContactClick}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 active:scale-[0.98] transition-all"
            >
              <i className="ti ti-lock text-sm" aria-hidden="true" />
              Wasiliana naye
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
              aria-label="Share profile"
            >
              {copied
                ? <i className="ti ti-check text-green-500 text-base" aria-hidden="true" />
                : <i className="ti ti-share text-base" aria-hidden="true" />
              }
            </button>
          </div>

          <p className="text-[11px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
            <i className="ti ti-lock text-[10px]" aria-hidden="true" />
            Mawasiliano yanapatikana baada ya malipo ya Tsh 2,000
          </p>
        </section>

        {/* ── Listings section ────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Listings za {dalali.name.split(' ')[0]}
          </h2>

          {/* Search */}
          {listings.length > 3 && (
            <div className="relative mb-3">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tafuta ndani ya listings..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
          )}

          {/* Type filter tabs */}
          {types.length > 2 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    filter === t
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t === 'zote' ? 'Zote' : (TYPE_LABELS[t] ?? t)}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-gray-400">
              <i className="ti ti-home-off text-3xl block mb-2" aria-hidden="true" />
              <p className="text-sm">Hakuna listings zinazolingana</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map(listing => (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  onClick={() => fetch('/api/v1/profile/track-click', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dalaliId: dalali.id, listingId: listing.id, eventType: 'listing_view' }),
                  }).catch(() => {})}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-gray-200 transition-all block"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] relative bg-gray-100">
                    {listing.images?.[0] ? (
                      <Image
                        src={listing.images[0]}
                        alt={listing.title ?? listing.type}
                        fill
                        sizes="(max-width: 640px) 45vw, 200px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ti ti-home text-3xl text-gray-300" aria-hidden="true" />
                      </div>
                    )}
                    {listing.is_boosted && (
                      <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <i className="ti ti-rocket text-[10px]" aria-hidden="true" />
                        Featured
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                      {TYPE_LABELS[listing.type] ?? listing.type}
                    </p>
                    <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-1 mb-1.5">
                      {listing.title ?? `${TYPE_LABELS[listing.type] ?? listing.type} – ${listing.district}`}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1.5">
                      <i className="ti ti-map-pin text-[11px]" aria-hidden="true" />
                      {listing.district}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      TZS {fmtPrice(listing.price_monthly)}
                      <span className="text-xs font-normal text-gray-400">/mwezi</span>
                    </p>
                    {listing.bedrooms && (
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <i className="ti ti-bed text-[11px]" aria-hidden="true" />
                        {listing.bedrooms} vyumba
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Reviews ─────────────────────────────────────────── */}
        {reviews.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ti ti-star text-amber-400" aria-hidden="true" />
              Maoni ya wateja ({reviews.length})
            </h2>
            <div className="space-y-3">
              {reviews.slice(0, 5).map(r => (
                <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <i
                        key={i}
                        aria-hidden="true"
                        className={`ti ti-star${i < r.rating ? '-filled text-amber-400' : ' text-gray-200'} text-sm`}
                      />
                    ))}
                  </div>
                  {r.comment && (
                    <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-2">
                    {new Date(r.created_at).toLocaleDateString('sw-TZ', { year: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Sticky bottom CTA — drive traffic back to NyumbaFasta ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3 z-20"
           style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <Link
          href="/"
          onClick={() => fetch('/api/v1/profile/track-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dalaliId: dalali.id, eventType: 'explore_nyumbafasta' }),
          }).catch(() => {})}
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all"
        >
          <i className="ti ti-home-2 text-base" aria-hidden="true" />
          Tafuta nyumba zote Tanzania — NyumbaFasta
          <i className="ti ti-arrow-right text-sm" aria-hidden="true" />
        </Link>
      </div>

      {/* ── Contact modal — redirect to listing unlock flow ── */}
      {showContact && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setShowContact(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <i className="ti ti-lock-open text-2xl text-primary-500" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Fungua mawasiliano</h2>
                <p className="text-xs text-gray-500 mt-0.5">Lipa Tsh 2,000 mara moja upate namba ya {dalali.name.split(' ')[0]}</p>
              </div>
            </div>

            {contactListing ? (
              <>
                <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-3">
                  {contactListing.images?.[0] && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <Image src={contactListing.images[0]} alt="" fill className="object-cover" sizes="48px" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 line-clamp-1">
                      {contactListing.title ?? contactListing.type}
                    </p>
                    <p className="text-xs text-gray-500">{contactListing.district} · TZS {fmtPrice(contactListing.price_monthly)}/mwezi</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowContact(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium"
                  >
                    Ghairi
                  </button>
                  <Link
                    href={`/listings/${contactListing.id}`}
                    className="flex-1 py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl text-center"
                  >
                    Endelea kufungua
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                {dalali.name.split(' ')[0]} hana listings hai sasa hivi.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
