'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type { ListingFull, ReviewWithReviewer } from '@/app/listings/[id]/page'
import type { Listing } from '@/lib/types/database'
import SaveButton from '@/components/shared/SaveButton'
import ShareButton from '@/components/shared/ShareButton'
import Avatar from '@/components/shared/Avatar'
import UnlockModal from '@/components/payments/UnlockModal'
import ReviewList from '@/components/listings/ReviewList'
import ReviewForm from '@/components/listings/ReviewForm'
import ReportDalaliModal from '@/components/listings/ReportDalaliModal'
import NeighborhoodInfo from '@/components/listings/NeighborhoodInfo'
import { VideoPlayer } from '@/components/listings/VideoPlayer'
import { getFullLocation, getShortLocation } from '@/lib/listings/formatLocation'
import { BOOSTED_LABEL, STATUS_LABELS } from '@/lib/config/listing-status'
import { buildContactWhatsAppMessage } from '@/lib/utils/whatsappTemplates'
import { formatCommission, calculateCommissionAmount } from '@/lib/listings/commission'

const SimilarListings = dynamic(
  () => import('@/components/listings/SimilarListings'),
  { ssr: false }
)

const SingleListingMap = dynamic(
  () => import('@/components/listings/SingleListingMap'),
  { ssr: false }
)

const amenityLabel: Record<string, string> = {
  umeme: 'Umeme',
  maji: 'Maji',
  wifi: 'WiFi',
  parking: 'Parking',
  choo_ndani: 'Choo ndani',
  daladala: 'Daladala',
  watchman: 'Watchman',
  ac: 'AC',
  dstv: 'DSTV',
  solar: 'Solar',
  soko: 'Soko',
  bustani: 'Bustani',
}

const amenityIcon: Record<string, string> = {
  umeme: 'bolt',
  maji: 'droplet',
  wifi: 'wifi',
  parking: 'parking',
  choo_ndani: 'bath',
  daladala: 'bus',
  watchman: 'shield',
  ac: 'snowflake',
  dstv: 'device-tv',
  solar: 'sun',
  soko: 'shopping-cart',
  bustani: 'leaf',
}

const typeLabel: Record<string, string> = {
  chumba: 'Chumba',
  apartment: 'Apartment',
  nyumba: 'Nyumba',
  studio: 'Studio',
  duka: 'Duka',
}

const furnishedLabel: Record<string, string> = {
  furnished: 'Ina Samani',
  semi: 'Nusu Samani',
  empty: 'Bila Samani',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'leo'
  if (days === 1) return 'jana'
  if (days < 7) return `siku ${days} zilizopita`
  if (days < 30) return `wiki ${Math.floor(days / 7)} iliyopita`
  return `mwezi ${Math.floor(days / 30)} uliopita`
}

function formatPrice(amount: number): string {
  if (amount >= 1_000_000) return `Tsh ${(amount / 1_000_000).toFixed(1)}M / mwezi`
  if (amount >= 1_000) return `Tsh ${(amount / 1_000).toFixed(0)}k / mwezi`
  return `Tsh ${amount} / mwezi`
}

type Props = {
  listing: ListingFull
  hasUnlocked: boolean
  isLoggedIn: boolean
  unlockId: string | null
  unlockCreatedAt: string | null
  hasReviewed: boolean
  reviews: ReviewWithReviewer[]
  similarListings?: ListingFull[]
  whatsappNumber?: string | null
  agentProfileUrl?: string | null
}

export default function ListingDetail({ listing, hasUnlocked, isLoggedIn, unlockId, unlockCreatedAt, hasReviewed, reviews, whatsappNumber: initialWhatsappNumber, agentProfileUrl }: Props) {
  const router = useRouter()
  const [activeImg, setActiveImg] = useState(0)
  const [unlockPrice, setUnlockPrice] = useState(2000)
  useEffect(() => {
    fetch('/api/v1/pricing').then(r => r.json()).then(p => setUnlockPrice(p.unlock ?? 2000)).catch(() => {})
  }, [])

  // Track in localStorage for guests
  useEffect(() => {
    if (isLoggedIn) return // DB tracking handles logged-in users
    try {
      const key = 'recently_viewed'
      const prev: string[] = JSON.parse(localStorage.getItem(key) ?? '[]')
      const updated = [listing.id, ...prev.filter(id => id !== listing.id)].slice(0, 10)
      localStorage.setItem(key, JSON.stringify(updated))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id])
  const [imgError, setImgError] = useState(false)
  const [showUnlockModal, setShowUnlockModal]   = useState(false)
  const [showReportModal, setShowReportModal]   = useState(false)
  const [localUnlocked, setLocalUnlocked] = useState(hasUnlocked)
  const [contactNumber, setContactNumber] = useState<string | null>(initialWhatsappNumber ?? null)
  const [reviewed, setReviewed] = useState(hasReviewed)
  const [touchStartX, setTouchStartX] = useState(0)
  const [touchStartY, setTouchStartY] = useState(0)

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
    setTouchStartY(e.touches[0].clientY)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX - e.changedTouches[0].clientX
    const dy = e.changedTouches[0].clientY - touchStartY
    // Require at least 60px horizontal movement, and the gesture must be more horizontal than vertical
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.75) return
    if (dx > 0) {
      setActiveImg(prev => Math.min(prev + 1, images.length - 1))
    } else {
      setActiveImg(prev => Math.max(prev - 1, 0))
    }
    setImgError(false)
  }

  const profile      = listing.dalali?.dalali_profiles
  const isVerified   = profile?.is_premium_verified ?? false
  const isFavourite  = profile?.is_favourite_dalali ?? false
  const rating       = profile?.rating_avg ?? 0
  const ratingCount = profile?.rating_count ?? 0
  // waPhone is only set after payment is confirmed (or for already-unlocked users)
  const waPhone = contactNumber ? (contactNumber.replace(/\D/g, '').replace(/^0/, '255') || null) : null

  // Pre-filled WhatsApp message — includes listing title, location, price, link
  const dalaliDisplayName = listing.dalali?.full_name ?? 'Dalali'
  const displayTitle = listing.title || `${typeLabel[listing.type] || listing.type} – ${listing.district}`
  const locationDisplay = getFullLocation(listing)
  const waMessage = buildContactWhatsAppMessage({
    dalaliName: dalaliDisplayName,
    listingTitle: displayTitle,
    listingLocation: locationDisplay,
    listingPrice: listing.price_monthly,
    listingId: listing.id,
    bedrooms: listing.bedrooms,
  })
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}` : null

  const isTaken = listing.status === 'taken'

  const statusBadge = STATUS_LABELS[listing.status] ?? { label: listing.status, cls: 'bg-gray-100 text-gray-500' }

  const images    = listing.images ?? []
  const videoUrl  = (listing as Listing & { video_url?: string | null }).video_url ?? null

  return (
    <article className="min-h-screen bg-gray-50 pb-28">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => window.history.length > 2 ? router.back() : router.push('/')}
          aria-label="Rudi nyuma"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 text-gray-600"
        >
          ←
        </button>
        <p aria-hidden="true" className="flex-1 text-sm font-semibold text-gray-800 truncate">
          {displayTitle}
        </p>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
        <SaveButton listingId={listing.id} size="sm" />
      </div>

      {/* ── Image gallery ── */}
      {/* bg-gray-950 + object-contain so portrait & landscape photos show fully without cropping */}
      <div
        className="relative bg-gray-950 aspect-[4/3] max-h-[80vh] touch-pan-y select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 0 && !imgError ? (
          <Image
            fill
            src={images[activeImg]}
            alt={listing.title ?? `${typeLabel[listing.type] || listing.type} huko ${listing.district}`}
            className="object-contain"
            onError={() => setImgError(true)}
            sizes="100vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <i className="ti ti-home text-5xl text-gray-300" aria-hidden="true" />
            <span className="text-sm">Hakuna picha</span>
          </div>
        )}

        {/* Title + short location overlay */}
        {images.length > 0 && !imgError && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent pointer-events-none flex flex-col justify-end px-3 pb-8">
            <p className="text-white text-sm font-semibold leading-tight truncate drop-shadow">
              {displayTitle}
            </p>
            <p className="text-white/75 text-xs mt-0.5 flex items-center gap-1 truncate">
              <i className="ti ti-map-pin text-[9px]" aria-hidden="true" />
              {getShortLocation(listing)}
            </p>
          </div>
        )}

        {/* Boosted badge */}
        {listing.is_boosted && (
          <div className="absolute top-3 left-3 bg-primary-500 text-white text-xs font-medium px-2 py-1 rounded-full">
            <i className="ti ti-bolt" aria-hidden="true" /> {BOOSTED_LABEL}
          </div>
        )}

        {/* Dot indicators + photo count */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="flex gap-1.5 items-center bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
              {images.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Picha ${i + 1} ya ${images.length}`}
                  aria-current={i === activeImg ? 'true' : undefined}
                  onClick={() => { setActiveImg(i); setImgError(false) }}
                  className="min-h-[44px] min-w-[24px] flex items-center justify-center touch-manipulation"
                >
                  <span className={`block rounded-full transition-all ${i === activeImg ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`} />
                </button>
              ))}
              <span className="text-white/80 text-[10px] font-medium ml-1">{activeImg + 1}/{images.length}</span>
            </div>
          </div>
        )}

      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none bg-white border-b border-gray-100">
          {images.map((src, i) => (
            <button
              key={i}
              aria-label={`Angalia picha ${i + 1}`}
              onClick={() => { setActiveImg(i); setImgError(false) }}
              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                activeImg === i ? 'border-primary-500' : 'border-transparent'
              }`}
            >
              <Image fill src={src} alt={`Picha ${i + 1}`} className="object-cover" sizes="56px" />
            </button>
          ))}
        </div>
      )}

      {/* ── Video player ── */}
      {videoUrl && (
        <div className="px-4 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><i className="ti ti-video" aria-hidden="true" /> Video ya Nyumba</p>
          <VideoPlayer src={videoUrl} poster={images[0]} />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="px-4 pt-4 space-y-4">

        {/* Price + title */}
        <div className="card p-4">
          <div className="flex justify-between items-start gap-3 mb-2">
            <h2 className="text-base font-bold text-gray-900 flex-1 leading-snug">
              {listing.title || `${typeLabel[listing.type] || listing.type} – ${listing.district}`}
            </h2>
          </div>
          <p className="text-primary-600 font-bold text-xl mb-3">
            {formatPrice(listing.price_monthly)}
          </p>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
              <i className="ti ti-home" aria-hidden="true" /> {typeLabel[listing.type] || listing.type}
            </span>
            {listing.type !== 'duka' && listing.bedrooms && (
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                <i className="ti ti-bed" aria-hidden="true" /> Vyumba {listing.bedrooms}
              </span>
            )}
            {listing.type !== 'duka' && listing.furnished && (
              <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">
                {furnishedLabel[listing.furnished] || listing.furnished}
              </span>
            )}
            {listing.type === 'duka' && (listing as typeof listing & { shop_size_sqm?: number | null }).shop_size_sqm && (
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                <i className="ti ti-ruler" aria-hidden="true" /> {(listing as typeof listing & { shop_size_sqm?: number | null }).shop_size_sqm} m²
              </span>
            )}
            {listing.type === 'duka' && (listing as typeof listing & { floor_level?: number | null }).floor_level != null && (
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                <i className="ti ti-building" aria-hidden="true" /> {(listing as typeof listing & { floor_level?: number | null }).floor_level === 0 ? 'Chini' : `Ghorofa ${(listing as typeof listing & { floor_level?: number | null }).floor_level}`}
              </span>
            )}
            {listing.type === 'duka' && (listing as typeof listing & { commercial_use?: string | null }).commercial_use && (
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                <i className="ti ti-store" aria-hidden="true" /> {(listing as typeof listing & { commercial_use?: string | null }).commercial_use}
              </span>
            )}
          </div>
        </div>

        {/* Commission — always show type; value/notes only after unlock */}
        {listing.commission_type && (
          <section className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <i className="ti ti-coins" aria-hidden="true" /> Kamisheni ya Dalali
            </h3>
            {localUnlocked ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between py-1 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Aina</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {formatCommission(listing.commission_type, listing.commission_value ?? null)}
                  </span>
                </div>
                {listing.commission_type !== 'negotiable' && listing.commission_type !== 'one_month' && listing.commission_value ? (
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Kiasi</span>
                    <span className="text-sm font-bold text-primary-700">
                      Tsh {calculateCommissionAmount(listing.commission_type, listing.commission_value, listing.price_monthly)?.toLocaleString() ?? '—'}
                    </span>
                  </div>
                ) : listing.commission_type === 'one_month' ? (
                  <div className="flex items-center justify-between py-1 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Kiasi</span>
                    <span className="text-sm font-bold text-primary-700">
                      Tsh {listing.price_monthly.toLocaleString()}
                    </span>
                  </div>
                ) : null}
                {listing.commission_notes && (
                  <p className="text-xs text-gray-500 mt-1 pt-1">{listing.commission_notes}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                  <i className="ti ti-coins text-xs" aria-hidden="true" />
                  {formatCommission(listing.commission_type, null)}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <i className="ti ti-lock text-xs" aria-hidden="true" />
                  Maelezo baada ya kulipa
                </span>
              </div>
            )}
          </section>
        )}

        {/* Location */}
        <section className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><i className="ti ti-map-pin" aria-hidden="true" /> Mahali</h3>

          {/* Summary line — full location */}
          {(() => {
            const summary = getFullLocation(listing)
            return summary !== 'Mahali haijabainishwa' ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 mb-3">
                <p className="text-sm font-semibold text-gray-800">{summary}</p>
              </div>
            ) : null
          })()}

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Mkoa</p>
              <p className="text-sm font-medium text-gray-800">{listing.region}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Wilaya</p>
              <p className="text-sm font-medium text-gray-800">{listing.district}</p>
            </div>
            {listing.ward && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Kata</p>
                <p className="text-sm font-medium text-gray-800">{listing.ward}</p>
              </div>
            )}
            {listing.mtaa && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Mtaa / Kijiji</p>
                <p className="text-sm font-medium text-gray-800">{listing.mtaa}</p>
              </div>
            )}
            {listing.street && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Barabara</p>
                <p className="text-sm font-medium text-gray-800">{listing.street}</p>
              </div>
            )}
            {listing.address_full && listing.address_full !== listing.location_display && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Anwani Kamili</p>
                <p className="text-sm font-medium text-gray-800">{listing.address_full}</p>
              </div>
            )}
          </div>

          {/* Map — exact coordinates or Google Maps search fallback */}
          {!!(listing.latitude && listing.longitude) ? (
            <SingleListingMap
              latitude={listing.latitude as number}
              longitude={listing.longitude as number}
              district={listing.district}
              region={listing.region}
              address={listing.address_full ?? listing.street ?? undefined}
            />
          ) : (
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(
                [listing.street, listing.mtaa, listing.ward, listing.district, listing.region, 'Tanzania']
                  .filter(Boolean).join(', ')
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-3.5 hover:bg-primary-50 hover:border-primary-200 transition-colors active:scale-[0.98]"
            >
              <div className="w-11 h-11 bg-white border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <i className="ti ti-map text-2xl text-gray-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">Angalia kwenye Google Maps</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {[listing.street, listing.mtaa, listing.district, listing.region]
                    .filter(Boolean).join(' › ')}
                </p>
              </div>
              <span className="text-xs font-semibold text-primary-600 flex-shrink-0 bg-primary-50 px-2 py-1 rounded-lg">
                Fungua →
              </span>
            </a>
          )}
        </section>

        {/* Description */}
        {listing.description && (
          <section className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><i className="ti ti-file-text" aria-hidden="true" /> Maelezo</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{listing.description}</p>
          </section>
        )}

        {/* Amenities */}
        {listing.amenities?.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><i className="ti ti-check" aria-hidden="true" /> Huduma zilizopo</h3>
            <div className="flex flex-wrap gap-2">
              {listing.amenities.map(a => (
                <span
                  key={a}
                  className="bg-primary-50 text-primary-700 text-xs px-3 py-1.5 rounded-full border border-primary-100"
                >
                  <i className={`ti ti-${amenityIcon[a] ?? 'check'}`} aria-hidden="true" /> {amenityLabel[a] || a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Neighborhood info — only shown when listing has coordinates */}
        {!!(listing.latitude && listing.longitude) && (
          <NeighborhoodInfo listingId={listing.id} />
        )}

        {/* Contact history badge */}
        {localUnlocked && unlockCreatedAt && waPhone && (
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-3">
            <div className="flex items-center gap-3 mb-2.5">
              <i className="ti ti-circle-check text-2xl text-primary-600 flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary-800">Umeshazungumza na dalali huyu</p>
                <p className="text-xs text-primary-600" suppressHydrationWarning>Ulifungua contact {timeAgo(unlockCreatedAt)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={waUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 bg-green-500 text-white text-xs px-3 py-2 rounded-xl font-semibold active:scale-95 transition-transform"
              >
                <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp
              </a>
              <a
                href={`tel:+${waPhone}`}
                className="flex items-center justify-center gap-1.5 bg-blue-500 text-white text-xs px-3 py-2 rounded-xl font-semibold active:scale-95 transition-transform"
              >
                <i className="ti ti-phone" aria-hidden="true" /> Piga Simu
              </a>
            </div>
          </div>
        )}

        {/* Share */}
        <ShareButton listing={listing} variant="detail" />

        {/* Dalali card */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><i className="ti ti-user" aria-hidden="true" /> Kuhusu Dalali</h3>
          <div className="flex items-start gap-3">
            <Avatar
              src={listing.dalali?.avatar_url}
              name={listing.dalali?.full_name ?? 'Dalali'}
              size={56}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">
                  {listing.dalali?.full_name ?? 'Dalali'}
                </span>
                {isVerified && (
                  <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <i className="ti ti-check" aria-hidden="true" /> Imethibitishwa
                  </span>
                )}
                {isFavourite && (
                  <span className="bg-amber-400 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5 font-semibold">
                    <i className="ti ti-rosette-discount-check" aria-hidden="true" /> Dalali Halisi
                  </span>
                )}
              </div>
              {rating > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <i className="ti ti-star-filled text-amber-400 text-sm" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({ratingCount} maoni)</span>
                </div>
              )}
              {profile?.bio && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{profile.bio}</p>
              )}
            </div>
          </div>
        </div>

        {/* Agent microsite link — shown for verified dalali who have a public page */}
        {isVerified && agentProfileUrl && (
          <div className="mt-3">
            <a
              href={agentProfileUrl}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-xs font-semibold active:scale-[0.97] transition-all"
            >
              <i className="ti ti-user-circle text-sm" aria-hidden="true" />
              Angalia listings zote za {listing.dalali?.full_name ?? 'dalali huyu'} →
            </a>
          </div>
        )}

        {/* Report dalali link — only for logged-in non-dalali users */}
        {isLoggedIn && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowReportModal(true)}
              className="text-xs text-gray-400 flex items-center gap-1 min-h-[44px] px-2 hover:text-red-500 transition-colors"
            >
              <i className="ti ti-alert-triangle" aria-hidden="true" />
              <span>Ripoti dalali huyu</span>
            </button>
          </div>
        )}

        {/* Reviews */}
        <ReviewList
          reviews={reviews}
          ratingAvg={listing.dalali?.dalali_profiles?.rating_avg ?? 0}
          ratingCount={listing.dalali?.dalali_profiles?.rating_count ?? 0}
        />

        {/* Review prompt — shown after unlock */}
        {localUnlocked && !reviewed && (
          unlockId
            ? <ReviewForm
                unlockId={unlockId}
                dalaliName={listing.dalali?.full_name ?? 'Dalali'}
                onSubmitted={() => setReviewed(true)}
              />
            : <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <i className="ti ti-star-filled text-2xl text-amber-400" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-primary-700">Tutakuomba toa maoni</p>
                    <p className="text-xs text-primary-500 mt-0.5">
                      Baada ya siku 3 utapata arifa kukuomba utoe maoni kuhusu dalali
                    </p>
                  </div>
                </div>
              </div>
        )}

      </div>

      {/* ── Similar listings (shown for all listings) ── */}
      <SimilarListings
        currentListingId={listing.id}
        region={listing.region}
        district={listing.district}
        type={listing.type}
        priceMonthly={listing.price_monthly}
      />

      {/* ── Fixed bottom CTA ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 pt-4 shadow-lg"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {isTaken ? (
          <div className="text-center pb-1">
            <p className="text-sm font-semibold text-amber-700 mb-1 flex items-center gap-1.5"><i className="ti ti-circle-dot" aria-hidden="true" /> Nyumba hii imeshapangishwa</p>
            <a href={`/?region=${listing.region}`}
              className="btn-primary w-full py-3 text-sm">
              <i className="ti ti-search" aria-hidden="true" /> Tafuta zinazofanana — {listing.region}
            </a>
          </div>
        ) : localUnlocked && waPhone ? (
          <div className="space-y-2 pb-1">
            <div className="grid grid-cols-2 gap-3">
              <a
                href={waUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl
                           bg-green-500 text-white font-semibold text-sm shadow-md
                           active:scale-95 transition-transform"
              >
                <i className="ti ti-brand-whatsapp text-xl" aria-hidden="true" />
                <span>WhatsApp</span>
                <span className="text-[10px] font-normal opacity-75">Na maelezo ya listing</span>
              </a>
              <a
                href={`tel:+${waPhone}`}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl
                           bg-blue-500 text-white font-semibold text-sm shadow-md
                           active:scale-95 transition-transform"
              >
                <i className="ti ti-phone text-xl" aria-hidden="true" />
                <span>Piga Simu</span>
              </a>
            </div>
            <p className="text-center text-xs text-gray-400">Namba moja inatumika kwa njia zote mbili</p>
          </div>
        ) : (
          <div>
            <button
              onClick={() => {
                if (!isLoggedIn) {
                  window.location.href = `/login?redirect=/listings/${listing.id}`
                  return
                }
                setShowUnlockModal(true)
              }}
              className="btn-primary w-full py-3.5 text-sm"
            >
              <i className="ti ti-lock-open" aria-hidden="true" /> Pata Nambari ya WhatsApp – Tsh {unlockPrice.toLocaleString()}
            </button>
            <p className="text-center text-xs text-gray-400 mt-1.5">
              Lipa mara moja kupata nambari ya dalali
            </p>
          </div>
        )}
      </div>

      {/* ── Report Modal ── */}
      {showReportModal && (
        <ReportDalaliModal
          listingId={listing.id}
          dalaliName={listing.dalali?.full_name ?? 'Dalali'}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* ── Unlock Modal ── */}
      {showUnlockModal && (
        <UnlockModal
          listingId={listing.id}
          dalaliName={listing.dalali?.full_name ?? 'Dalali'}
          listingTitle={displayTitle}
          listingPrice={listing.price_monthly}
          listingLocation={locationDisplay}
          listingBedrooms={listing.bedrooms ?? undefined}
          initialUnlockAmount={unlockPrice}
          onClose={() => setShowUnlockModal(false)}
          onUnlocked={(number) => {
            setContactNumber(number || null)
            setLocalUnlocked(true)
            setShowUnlockModal(false)
          }}
        />
      )}

    </article>
  )
}
