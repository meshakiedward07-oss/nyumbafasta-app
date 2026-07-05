'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { BOOSTED_LABEL } from '@/lib/config/listing-status'

const UnlockModal = dynamic(() => import('@/components/payments/UnlockModal'), { ssr: false })

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
  primaryRegion: string | null
  primaryDistrict: string | null
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

const PRICE_RANGES = [
  { key: 'yote',   label: 'Yote',        min: 0,       max: Infinity },
  { key: 'low',    label: '< 100k',       min: 0,       max: 100_000  },
  { key: 'mid',    label: '100k – 300k',  min: 100_000, max: 300_000  },
  { key: 'high',   label: '300k – 600k',  min: 300_000, max: 600_000  },
  { key: 'top',    label: '600k+',        min: 600_000, max: Infinity },
] as const
type PriceKey = typeof PRICE_RANGES[number]['key']

const BED_OPTIONS = [
  { key: 'yote', label: 'Yote' },
  { key: '1',    label: '1'    },
  { key: '2',    label: '2'    },
  { key: '3',    label: '3'    },
  { key: '4+',   label: '4+'   },
] as const
type BedKey = typeof BED_OPTIONS[number]['key']

export default function AgentProfileClient({ dalali, listings, reviews, primaryRegion, primaryDistrict }: Props) {
  const [typeFilter, setTypeFilter]   = useState<string>('zote')
  const [priceFilter, setPriceFilter] = useState<PriceKey>('yote')
  const [bedFilter, setBedFilter]     = useState<BedKey>('yote')
  const [districtFilter, setDistrictFilter] = useState<string>('yote')
  const [query, setQuery]         = useState('')
  const [copied, setCopied]         = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [unlockedPhone, setUnlockedPhone] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'listings' | 'reviews'>('listings')

  const listingsSectionRef = useRef<HTMLElement>(null)
  const reviewsSectionRef  = useRef<HTMLElement>(null)

  // Track active section via IntersectionObserver
  useEffect(() => {
    if (!reviews.length) return
    const opts = { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setActiveSection(e.target.id === 'section-reviews' ? 'reviews' : 'listings')
        }
      }
    }, opts)
    if (listingsSectionRef.current)  obs.observe(listingsSectionRef.current)
    if (reviewsSectionRef.current)   obs.observe(reviewsSectionRef.current)
    return () => obs.disconnect()
  }, [reviews.length])

  function scrollTo(section: 'listings' | 'reviews') {
    const el = section === 'listings' ? listingsSectionRef.current : reviewsSectionRef.current
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(section)
  }

  // Build location-aware CTA
  const regionSlug     = primaryRegion    ? primaryRegion.toLowerCase().replace(/\s+/g, '-') : null
  const locationLabel  = primaryDistrict  ? primaryDistrict : (primaryRegion ?? null)
  const exploreHref    = regionSlug       ? `/mali/${regionSlug}` : '/'
  const exploreLabel   = locationLabel
    ? `Angalia nyumba zote ${locationLabel}`
    : 'Angalia nyumba zote Tanzania'

  // Track profile view once on mount
  useEffect(() => {
    fetch('/api/v1/profile/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dalaliId: dalali.id, referrer: document.referrer }),
    }).catch(() => {})
  }, [dalali.id])

  // Derive unique values for filter chips
  const types     = ['zote', ...Array.from(new Set(listings.map(l => l.type)))]
  const districts = ['yote', ...Array.from(new Set(listings.map(l => l.district))).sort()]

  const priceRange = PRICE_RANGES.find(r => r.key === priceFilter) ?? PRICE_RANGES[0]

  const filtered = listings.filter(l => {
    const matchType     = typeFilter === 'zote'    || l.type === typeFilter
    const matchPrice    = l.price_monthly >= priceRange.min && l.price_monthly < priceRange.max
    const matchBed      = bedFilter === 'yote'     ||
      (bedFilter === '4+' ? (l.bedrooms ?? 0) >= 4 : String(l.bedrooms) === bedFilter)
    const matchDistrict = districtFilter === 'yote' || l.district === districtFilter
    const matchQuery    = !query ||
      (l.title ?? '').toLowerCase().includes(query.toLowerCase()) ||
      l.district.toLowerCase().includes(query.toLowerCase())
    return matchType && matchPrice && matchBed && matchDistrict && matchQuery
  })

  const activeFilterCount = [
    typeFilter !== 'zote', priceFilter !== 'yote',
    bedFilter !== 'yote',  districtFilter !== 'yote',
    !!query,
  ].filter(Boolean).length

  function clearFilters() {
    setTypeFilter('zote'); setPriceFilter('yote')
    setBedFilter('yote');  setDistrictFilter('yote'); setQuery('')
  }

  function handleShare() {
    const url = window.location.href

    const copyToClipboard = () => {
      const finish = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
      const textareaCopy = () => {
        try {
          const ta = document.createElement('textarea')
          ta.value = url
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.focus()
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        } catch {}
        finish()
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(finish).catch(textareaCopy)
      } else {
        textareaCopy()
      }
    }

    if (navigator.share) {
      navigator.share({ title: `${dalali.name} | NyumbaFasta`, url })
        .catch(() => copyToClipboard())
    } else {
      copyToClipboard()
    }

    fetch('/api/v1/profile/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dalaliId: dalali.id, eventType: 'share' }),
    }).catch(() => {})
  }

  const handleContactClick = useCallback(() => {
    fetch('/api/v1/profile/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dalaliId: dalali.id, eventType: 'whatsapp_click' }),
    }).catch(() => {})
    if (listings[0]) {
      setShowUnlockModal(true)
    } else {
      setShowContact(true)
    }
  }, [dalali.id, listings]) // eslint-disable-line react-hooks/exhaustive-deps

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

            {/* WhatsApp share */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Angalia dalali huyu kwenye NyumbaFasta:\nhttps://nyumbafasta.co/agent/${dalali.username}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share via WhatsApp"
              className="px-4 py-3 border border-green-200 bg-green-50 rounded-xl text-green-600 hover:bg-green-100 transition-all"
            >
              <i className="ti ti-brand-whatsapp text-base" aria-hidden="true" />
            </a>
          </div>

          <p className="text-[11px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
            <i className="ti ti-lock text-[10px]" aria-hidden="true" />
            Mawasiliano yanapatikana baada ya malipo ya Tsh 2,000
          </p>
        </section>

        {/* ── Section nav tabs ────────────────────────────────── */}
        <div className="sticky top-[52px] z-20 bg-gray-50 pb-2 -mx-4 px-4">
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => scrollTo('listings')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeSection === 'listings'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ti ti-home text-sm" aria-hidden="true" />
              Listings
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeSection === 'listings' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{listings.length}</span>
            </button>
            {reviews.length > 0 && (
              <button
                onClick={() => scrollTo('reviews')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeSection === 'reviews'
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className="ti ti-star text-sm" aria-hidden="true" />
                Maoni
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeSection === 'reviews' ? 'bg-amber-400 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{reviews.length}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Listings section ────────────────────────────────── */}
        <section id="section-listings" ref={listingsSectionRef}>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Listings za {dalali.name.split(' ')[0]}
          </h2>

          {/* Search */}
          {listings.length > 2 && (
            <div className="mb-3">
              <div className="relative">
                <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Tafuta listing..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
                />
              </div>
            </div>
          )}

          {/* ── Mini filters ── */}
          {listings.length > 2 && (
            <div className="space-y-2 mb-3">

              {/* Aina */}
              {types.length > 2 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                  <span className="flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide self-center pr-1">Aina</span>
                  {types.map(t => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        typeFilter === t
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {t === 'zote' ? 'Zote' : (TYPE_LABELS[t] ?? t)}
                    </button>
                  ))}
                </div>
              )}

              {/* Bei */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                <span className="flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide self-center pr-1">Bei</span>
                {PRICE_RANGES.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setPriceFilter(r.key)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      priceFilter === r.key
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Vyumba */}
              {listings.some(l => l.bedrooms !== null) && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                  <span className="flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide self-center pr-1">Vyumba</span>
                  {BED_OPTIONS.map(b => (
                    <button
                      key={b.key}
                      onClick={() => setBedFilter(b.key)}
                      className={`flex-shrink-0 w-9 py-1 rounded-lg text-xs font-medium border transition-all ${
                        bedFilter === b.key
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Eneo */}
              {districts.length > 2 && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                  <span className="flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide self-center pr-1">Eneo</span>
                  {districts.map(d => (
                    <button
                      key={d}
                      onClick={() => setDistrictFilter(d)}
                      className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        districtFilter === d
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {d === 'yote' ? 'Yote' : d}
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* Listing count bar — always visible */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">
              {activeFilterCount > 0
                ? <><span className="font-semibold text-gray-800">{filtered.length}</span> kati ya {listings.length} listings</>
                : <><span className="font-semibold text-gray-800">{listings.length}</span> listing{listings.length !== 1 ? 's' : ''} hai</>
              }
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-primary-600 font-medium">
                Futa filters
              </button>
            )}
          </div>

          {listings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-14 text-center text-gray-400 px-6">
              <i className="ti ti-home-off text-4xl block mb-3 text-gray-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-gray-600 mb-1">Hakuna listings hai sasa hivi</p>
              <p className="text-xs text-gray-400 mb-4">{dalali.name.split(' ')[0]} hana matangazo ya sasa.</p>
              <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-primary-600 font-medium underline">
                <i className="ti ti-search text-xs" aria-hidden="true" /> Tafuta kwenye NyumbaFasta
              </Link>
            </div>
          ) : filtered.length === 0 ? (
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
                        {BOOSTED_LABEL}
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
                      Tsh {fmtPrice(listing.price_monthly)}
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
          <section id="section-reviews" ref={reviewsSectionRef} className="mt-6">
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

      {/* ── Sticky bottom CTA — location-aware ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3 z-20"
           style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <Link
          href={exploreHref}
          onClick={() => fetch('/api/v1/profile/track-click', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dalaliId: dalali.id, eventType: 'explore_nyumbafasta' }),
          }).catch(() => {})}
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all"
        >
          <i className="ti ti-map-pin text-base" aria-hidden="true" />
          {exploreLabel}
          <i className="ti ti-arrow-right text-sm" aria-hidden="true" />
        </Link>
      </div>

      {/* ── No-listing contact fallback ── */}
      {showContact && !contactListing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mawasiliano hayapatikani"
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setShowContact(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-end mb-1">
              <button onClick={() => setShowContact(false)} aria-label="Funga" className="text-gray-300 text-xl p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">×</button>
            </div>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <p className="text-sm text-gray-500 text-center py-4">
              {dalali.name.split(' ')[0]} hana listings hai sasa hivi.
            </p>
            <Link href="/" className="flex items-center justify-center gap-2 w-full py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl">
              <i className="ti ti-search" aria-hidden="true" /> Tafuta Madalali Wengine
            </Link>
          </div>
        </div>
      )}

      {/* ── Unlock modal — shown directly from profile (U026) ── */}
      {showUnlockModal && contactListing && (
        <UnlockModal
          listingId={contactListing.id}
          dalaliName={dalali.name}
          listingTitle={contactListing.title ?? `${TYPE_LABELS[contactListing.type] ?? contactListing.type} – ${contactListing.district}`}
          listingPrice={contactListing.price_monthly}
          listingLocation={`${contactListing.district}, ${contactListing.region}`}
          listingBedrooms={contactListing.bedrooms ?? undefined}
          onClose={() => setShowUnlockModal(false)}
          onUnlocked={(number) => {
            setUnlockedPhone(number || null)
            setShowUnlockModal(false)
          }}
        />
      )}

      {/* ── Post-unlock WA banner ── */}
      {unlockedPhone && (
        <div className="fixed bottom-20 left-0 right-0 z-30 px-4">
          <a
            href={`https://wa.me/${unlockedPhone.replace(/\D/g, '').replace(/^0/, '255')}?text=${encodeURIComponent(`Habari ${dalali.name.split(' ')[0]}! 👋 Nimepata mawasiliano yako kwenye NyumbaFasta.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-green-500 text-white font-bold text-sm rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
          >
            <i className="ti ti-brand-whatsapp text-lg" aria-hidden="true" /> Zungumza na {dalali.name.split(' ')[0]} kwenye WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
