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
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

const SimilarListings = dynamic(
  () => import('@/components/listings/SimilarListings'),
  { ssr: false }
)

const SingleListingMap = dynamic(
  () => import('@/components/listings/SingleListingMap'),
  { ssr: false }
)

const RankedAdSlot = dynamic(
  () => import('@/components/ads/RankedAdSlot'),
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

function timeAgo(dateStr: string, t: (k: TKey) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return t('lst_ago_today').toLowerCase()
  if (days === 1) return t('lst_ago_yesterday').toLowerCase()
  if (days < 7) return t('lst_ago_days').replace('{{n}}', String(days)).toLowerCase()
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `wiki ${weeks} iliyopita`
  }
  return t('lst_ago_1month').toLowerCase()
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
  const { t } = useLanguage()
  const furnishedLabel: Record<string, string> = {
    furnished: t('lst_furnished_full'),
    semi:      t('lst_furnished_semi'),
    empty:     t('lst_furnished_empty'),
  }
  const [activeImg, setActiveImg] = useState(0)
  const [unlockPrice, setUnlockPrice] = useState(2000)
  useEffect(() => {
    fetch('/api/v1/pricing').then(r => r.json()).then(p => setUnlockPrice(p.unlock ?? 2000)).catch(() => {})
  }, [])

  useEffect(() => {
    if (isLoggedIn) return
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
  const ratingCount  = profile?.rating_count ?? 0
  const waPhone = contactNumber ? (contactNumber.replace(/\D/g, '').replace(/^0/, '255') || null) : null

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

  const images   = listing.images ?? []
  const videoUrl = (listing as Listing & { video_url?: string | null }).video_url ?? null

  const listingWithShop = listing as typeof listing & { shop_size_sqm?: number | null; floor_level?: number | null; commercial_use?: string | null }

  /* ── Contact CTA block — reused in sidebar and mobile sheet ── */
  function ContactButtons() {
    return (
      <div className="grid grid-cols-2 gap-3">
        <a href={waUrl ?? '#'} target="_blank" rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl
                     bg-green-500 text-white font-semibold text-sm shadow-md active:scale-95 transition-transform">
          <i className="ti ti-brand-whatsapp text-xl" aria-hidden="true" />
          <span>WhatsApp</span>
          <span className="text-[10px] font-normal opacity-75">{t('lst_whatsapp_subtitle')}</span>
        </a>
        <a href={`tel:+${waPhone}`}
          className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl
                     bg-blue-500 text-white font-semibold text-sm shadow-md active:scale-95 transition-transform">
          <i className="ti ti-phone text-xl" aria-hidden="true" />
          <span>{t('lst_call_phone')}</span>
        </a>
      </div>
    )
  }

  /* ── Sidebar CTA (desktop right column) ── */
  function SidebarCTA() {
    if (isTaken) {
      return (
        <div className="text-center">
          <p className="text-sm font-semibold text-amber-700 mb-3 flex items-center justify-center gap-1.5">
            <i className="ti ti-circle-dot" aria-hidden="true" /> {t('lst_listing_taken')}
          </p>
          <a href={`/?region=${listing.region}`} className="btn-primary w-full py-3 text-sm block text-center">
            <i className="ti ti-search" aria-hidden="true" /> {t('lst_search_similar')}
          </a>
        </div>
      )
    }
    if (localUnlocked && waPhone) {
      return (
        <div className="space-y-3">
          <ContactButtons />
          <p className="text-center text-xs text-gray-400">{t('lst_same_number')}</p>
        </div>
      )
    }
    return (
      <div>
        <button
          onClick={() => setShowUnlockModal(true)}
          className="btn-primary w-full py-3.5 text-sm"
        >
          <i className="ti ti-lock-open" aria-hidden="true" /> {t('lst_unlock_cta')} {dalaliDisplayName}
        </button>
        <p className="text-center text-xs text-gray-500 font-semibold mt-2">
          Tsh {unlockPrice.toLocaleString()} · {t('lst_pay_once_hint')}
        </p>
      </div>
    )
  }

  /* ── Reviews section ── */
  function ReviewsSection() {
    return (
      <div className="space-y-4">
        <ReviewList
          reviews={reviews}
          ratingAvg={listing.dalali?.dalali_profiles?.rating_avg ?? 0}
          ratingCount={listing.dalali?.dalali_profiles?.rating_count ?? 0}
        />
        {localUnlocked && !reviewed && (
          unlockId
            ? <ReviewForm
                unlockId={unlockId}
                dalaliName={listing.dalali?.full_name ?? 'Dalali'}
                onSubmitted={() => setReviewed(true)}
              />
            : <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <i className="ti ti-star-filled text-2xl text-amber-400" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-primary-700">{t('lst_review_later_title')}</p>
                    <p className="text-xs text-primary-500 mt-0.5">{t('lst_review_later_body')}</p>
                  </div>
                </div>
              </div>
        )}
      </div>
    )
  }

  return (
    <article className="min-h-screen bg-gray-50 pb-28 lg:pb-12">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 flex items-center gap-3 px-4 lg:px-8 py-3">
        <button
          onClick={() => window.history.length > 2 ? router.back() : router.push('/')}
          aria-label={t('common_back')}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 flex-shrink-0"
        >
          <i className="ti ti-arrow-left text-lg" aria-hidden="true" />
        </button>
        <p aria-hidden="true" className="flex-1 text-sm font-semibold text-gray-800 truncate">
          {displayTitle}
        </p>
        <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
        <SaveButton listingId={listing.id} size="sm" />
      </div>

      {/* ── Main layout ── */}
      <div className="lg:max-w-screen-xl lg:mx-auto lg:px-8 lg:pt-6 lg:flex lg:gap-8 lg:items-start">

        {/* ════════ LEFT — media + all content ════════ */}
        <div className="flex-1 min-w-0">

          {/* ── Mobile gallery (swipeable) ── */}
          <div
            className="lg:hidden relative bg-gray-200 aspect-[4/3] overflow-hidden touch-pan-y select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {images.length > 0 && !imgError ? (
              <Image
                fill
                src={images[activeImg]}
                alt={listing.title ?? `${typeLabel[listing.type] || listing.type} huko ${listing.district}`}
                className="object-cover"
                onError={() => setImgError(true)}
                sizes="100vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-blue-50 to-gray-50">
                <i className="ti ti-home-2 text-6xl text-gray-300" aria-hidden="true" />
                <span className="text-sm text-gray-400">{t('lst_no_photos')}</span>
              </div>
            )}
            {images.length > 0 && !imgError && (
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent pointer-events-none flex flex-col justify-end px-3 pb-8">
                <p className="text-white text-sm font-semibold leading-tight truncate drop-shadow">{displayTitle}</p>
                <p className="text-white/75 text-xs mt-0.5 flex items-center gap-1 truncate">
                  <i className="ti ti-map-pin text-[9px]" aria-hidden="true" /> {getShortLocation(listing)}
                </p>
              </div>
            )}
            {listing.is_boosted && (
              <div className="absolute top-3 left-3 bg-primary-500 text-white text-xs font-medium px-2 py-1 rounded-full shadow-sm">
                <i className="ti ti-bolt" aria-hidden="true" /> {BOOSTED_LABEL}
              </div>
            )}
            <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
              <ShareButton listing={listing} variant="card" />
            </div>
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

          {/* Mobile thumbnail strip */}
          {images.length > 1 && (
            <div className="lg:hidden flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none border-b border-gray-100" style={{ background: 'rgba(0,0,0,0.03)' }}>
              {images.map((src, i) => (
                <button
                  key={i}
                  aria-label={`Angalia picha ${i + 1}`}
                  onClick={() => { setActiveImg(i); setImgError(false) }}
                  className={`relative flex-shrink-0 w-16 h-12 rounded-xl overflow-hidden transition-all shadow-sm ${
                    activeImg === i ? 'ring-2 ring-primary-500 ring-offset-1 opacity-100' : 'opacity-60 hover:opacity-80'
                  }`}
                >
                  <Image fill src={src} alt={`Picha ${i + 1}`} className="object-cover" sizes="64px" />
                </button>
              ))}
            </div>
          )}

          {/* ── Desktop gallery: main image + thumbnail column ── */}
          <div className="hidden lg:flex gap-2 rounded-2xl overflow-hidden" style={{ height: 480 }}>
            {/* Main image */}
            <div
              className="relative flex-1 bg-gray-200 overflow-hidden rounded-2xl cursor-pointer group"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {images.length > 0 && !imgError ? (
                <Image
                  fill
                  src={images[activeImg]}
                  alt={listing.title ?? `${typeLabel[listing.type] || listing.type} huko ${listing.district}`}
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                  onError={() => setImgError(true)}
                  sizes="(max-width: 1280px) 65vw, 800px"
                  priority
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-blue-50 to-gray-50">
                  <i className="ti ti-home-2 text-6xl text-gray-300" aria-hidden="true" />
                  <span className="text-sm text-gray-400">{t('lst_no_photos')}</span>
                </div>
              )}
              {listing.is_boosted && (
                <div className="absolute top-4 left-4 bg-primary-500 text-white text-xs font-medium px-2.5 py-1 rounded-full shadow">
                  <i className="ti ti-bolt" aria-hidden="true" /> {BOOSTED_LABEL}
                </div>
              )}
              <div className="absolute top-4 right-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <ShareButton listing={listing} variant="card" />
              </div>
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => { setActiveImg(p => Math.max(p - 1, 0)); setImgError(false) }}
                    disabled={activeImg === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all disabled:opacity-0"
                    aria-label="Picha ya awali"
                  >
                    <i className="ti ti-chevron-left text-lg" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => { setActiveImg(p => Math.min(p + 1, images.length - 1)); setImgError(false) }}
                    disabled={activeImg === images.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all disabled:opacity-0"
                    aria-label="Picha inayofuata"
                  >
                    <i className="ti ti-chevron-right text-lg" aria-hidden="true" />
                  </button>
                  <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    {activeImg + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail column */}
            {images.length > 1 && (
              <div className="flex flex-col gap-2 w-[168px] flex-shrink-0">
                {images.slice(0, 4).map((src, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveImg(i); setImgError(false) }}
                    className={`relative flex-1 rounded-xl overflow-hidden transition-all ${
                      activeImg === i ? 'ring-2 ring-primary-500 ring-offset-1 opacity-100' : 'opacity-70 hover:opacity-95'
                    }`}
                    aria-label={`Picha ${i + 1}`}
                  >
                    <Image fill src={src} alt={`Picha ${i + 1}`} className="object-cover" sizes="168px" />
                    {i === 3 && images.length > 4 && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                        <span className="text-white font-bold text-2xl">+{images.length - 4}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Desktop title + price header ── */}
          <div className="hidden lg:block mt-6 mb-2">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 leading-snug flex-1">{displayTitle}</h1>
            </div>
            <p className="text-3xl font-bold text-primary-600 mb-3">{formatPrice(listing.price_monthly)}</p>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
              <i className="ti ti-map-pin text-primary-500 text-base" aria-hidden="true" />
              <span>{getFullLocation(listing)}</span>
            </div>
            {/* Quick-info chips */}
            <div className="flex flex-wrap gap-2">
              <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium">
                <i className="ti ti-home" aria-hidden="true" /> {typeLabel[listing.type] || listing.type}
              </span>
              {listing.type !== 'duka' && listing.bedrooms && (
                <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium">
                  <i className="ti ti-bed" aria-hidden="true" /> {listing.bedrooms} Vyumba
                </span>
              )}
              {listing.type !== 'duka' && listing.furnished && (
                <span className="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1.5 rounded-full text-sm font-medium">
                  {furnishedLabel[listing.furnished] || listing.furnished}
                </span>
              )}
              {listing.type === 'duka' && listingWithShop.shop_size_sqm && (
                <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-sm font-medium">
                  <i className="ti ti-ruler" aria-hidden="true" /> {listingWithShop.shop_size_sqm} m²
                </span>
              )}
            </div>
          </div>

          {/* Desktop divider */}
          <div className="hidden lg:block border-t border-gray-200 mt-6 mb-6" />

          {/* ── Video ── */}
          {videoUrl && (
            <div className="px-4 lg:px-0 pt-3 pb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <i className="ti ti-video" aria-hidden="true" /> {t('lst_video_label')}
              </p>
              <VideoPlayer src={videoUrl} poster={images[0]} />
            </div>
          )}

          {/* ── Mobile: price + type chips card ── */}
          <div className="lg:hidden px-4 pt-4">
            <div className="card p-4">
              <div className="flex justify-between items-start gap-3 mb-2">
                <h2 className="text-base font-bold text-gray-900 flex-1 leading-snug">{displayTitle}</h2>
              </div>
              <p className="text-primary-600 font-bold text-xl mb-3">{formatPrice(listing.price_monthly)}</p>
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
                {listing.type === 'duka' && listingWithShop.shop_size_sqm && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                    <i className="ti ti-ruler" aria-hidden="true" /> {listingWithShop.shop_size_sqm} m²
                  </span>
                )}
                {listing.type === 'duka' && listingWithShop.floor_level != null && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                    <i className="ti ti-building" aria-hidden="true" /> {listingWithShop.floor_level === 0 ? t('lst_ground_floor') : `Ghorofa ${listingWithShop.floor_level}`}
                  </span>
                )}
                {listing.type === 'duka' && listingWithShop.commercial_use && (
                  <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                    <i className="ti ti-store" aria-hidden="true" /> {listingWithShop.commercial_use}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Description ── */}
          {listing.description && (
            <section className="px-4 lg:px-0 pt-4 pb-4 lg:pb-0">
              <div className="card lg:bg-transparent lg:border-0 lg:shadow-none p-4 lg:p-0">
                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5 lg:text-base lg:mb-3">
                  <i className="ti ti-file-text" aria-hidden="true" /> {t('lst_description')}
                </h3>
                <p className="text-gray-600 text-sm lg:text-base leading-relaxed">{listing.description}</p>
              </div>
              <div className="hidden lg:block border-t border-gray-200 mt-6" />
            </section>
          )}

          {/* ── Amenities ── */}
          {listing.amenities?.length > 0 && (
            <section className="px-4 lg:px-0 pt-4 pb-4 lg:pt-6 lg:pb-0">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 lg:text-base">
                <i className="ti ti-check" aria-hidden="true" /> {t('lst_amenities')}
              </h3>
              {/* Desktop: grid layout */}
              <div className="hidden lg:grid grid-cols-3 gap-2">
                {listing.amenities.map(a => (
                  <div key={a} className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                    <i className={`ti ti-${amenityIcon[a] ?? 'check'} text-primary-500 text-lg flex-shrink-0`} aria-hidden="true" />
                    <span className="text-sm text-gray-700">{amenityLabel[a] || a}</span>
                  </div>
                ))}
              </div>
              {/* Mobile: pills */}
              <div className="lg:hidden flex flex-wrap gap-2">
                {listing.amenities.map(a => (
                  <span key={a} className="bg-primary-50 text-primary-700 text-xs px-3 py-1.5 rounded-full border border-primary-100">
                    <i className={`ti ti-${amenityIcon[a] ?? 'check'}`} aria-hidden="true" /> {amenityLabel[a] || a}
                  </span>
                ))}
              </div>
              <div className="hidden lg:block border-t border-gray-200 mt-6" />
            </section>
          )}

          {/* ── Location ── */}
          <section className="px-4 lg:px-0 pt-4 pb-4 lg:pt-6 lg:pb-0">
            <div className="card lg:bg-transparent lg:border-0 lg:shadow-none p-4 lg:p-0">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 lg:text-base">
                <i className="ti ti-map-pin" aria-hidden="true" /> {t('lst_location')}
              </h3>
              {(() => {
                const summary = getFullLocation(listing)
                return summary !== 'Mahali haijabainishwa' ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 mb-3">
                    <p className="text-sm font-semibold text-gray-800">{summary}</p>
                  </div>
                ) : null
              })()}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{t('lst_region')}</p>
                  <p className="text-sm font-medium text-gray-800">{listing.region}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{t('lst_district')}</p>
                  <p className="text-sm font-medium text-gray-800">{listing.district}</p>
                </div>
                {listing.ward && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t('lst_ward')}</p>
                    <p className="text-sm font-medium text-gray-800">{listing.ward}</p>
                  </div>
                )}
                {listing.mtaa && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t('lst_mtaa')}</p>
                    <p className="text-sm font-medium text-gray-800">{listing.mtaa}</p>
                  </div>
                )}
                {listing.street && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">{t('lst_street')}</p>
                    <p className="text-sm font-medium text-gray-800">{listing.street}</p>
                  </div>
                )}
                {listing.address_full && listing.address_full !== listing.location_display && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">{t('lst_full_address')}</p>
                    <p className="text-sm font-medium text-gray-800">{listing.address_full}</p>
                  </div>
                )}
              </div>
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
                    <p className="text-sm font-semibold text-gray-800">{t('lst_view_on_maps')}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {[listing.street, listing.mtaa, listing.district, listing.region].filter(Boolean).join(' › ')}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-primary-600 flex-shrink-0 bg-primary-50 px-2 py-1 rounded-lg">
                    {t('lst_open')}
                  </span>
                </a>
              )}
            </div>
            <div className="hidden lg:block border-t border-gray-200 mt-6" />
          </section>

          {/* ── Commission ── */}
          {listing.commission_type && (
            <section className="px-4 lg:px-0 pt-4 pb-4 lg:pt-6 lg:pb-0">
              <div className="card lg:bg-transparent lg:border-0 lg:shadow-none p-4 lg:p-0">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5 lg:text-base">
                  <i className="ti ti-coins" aria-hidden="true" /> {t('lst_commission')}
                </h3>
                {localUnlocked ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-sm text-gray-500">{t('lst_commission_type')}</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {formatCommission(listing.commission_type, listing.commission_value ?? null)}
                      </span>
                    </div>
                    {listing.commission_type !== 'negotiable' && listing.commission_type !== 'one_month' && listing.commission_value ? (
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-sm text-gray-500">{t('lst_commission_amount')}</span>
                        <span className="text-sm font-bold text-primary-700">
                          Tsh {calculateCommissionAmount(listing.commission_type, listing.commission_value, listing.price_monthly)?.toLocaleString() ?? '—'}
                        </span>
                      </div>
                    ) : listing.commission_type === 'one_month' ? (
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-sm text-gray-500">{t('lst_commission_amount')}</span>
                        <span className="text-sm font-bold text-primary-700">Tsh {listing.price_monthly.toLocaleString()}</span>
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
                      <i className="ti ti-lock text-xs" aria-hidden="true" /> {t('lst_unlock_to_see')}
                    </span>
                  </div>
                )}
              </div>
              <div className="hidden lg:block border-t border-gray-200 mt-6" />
            </section>
          )}

          {/* ── Neighborhood ── */}
          {!!(listing.latitude && listing.longitude) && (
            <div className="px-4 lg:px-0 pt-4 pb-4 lg:pt-6 lg:pb-0">
              <NeighborhoodInfo listingId={listing.id} />
              <div className="hidden lg:block border-t border-gray-200 mt-6" />
            </div>
          )}

          {/* ── Contact history badge — mobile only (desktop shows in sidebar) ── */}
          {localUnlocked && unlockCreatedAt && waPhone && (
            <div className="lg:hidden px-4 pt-2 pb-4">
              <div className="bg-primary-50 border border-primary-200 rounded-2xl p-3">
                <div className="flex items-center gap-3 mb-2.5">
                  <i className="ti ti-circle-check text-2xl text-primary-600 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary-800">{t('lst_already_contacted')}</p>
                    <p className="text-xs text-primary-600" suppressHydrationWarning>{t('lst_contact_opened')} {timeAgo(unlockCreatedAt, t)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a href={waUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-green-500 text-white text-xs px-3 py-2 rounded-xl font-semibold active:scale-95 transition-transform">
                    <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp
                  </a>
                  <a href={`tel:+${waPhone}`}
                    className="flex items-center justify-center gap-1.5 bg-blue-500 text-white text-xs px-3 py-2 rounded-xl font-semibold active:scale-95 transition-transform">
                    <i className="ti ti-phone" aria-hidden="true" /> {t('lst_call_phone')}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── Share (mobile only) ── */}
          <div className="lg:hidden px-4 pb-4">
            <ShareButton listing={listing} variant="detail" />
          </div>

          {/* ── Mobile: Dalali card ── */}
          <div className="lg:hidden px-4 pb-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <i className="ti ti-user" aria-hidden="true" /> {t('lst_about_agent')}
              </h3>
              <div className="flex items-start gap-3">
                <Avatar src={listing.dalali?.avatar_url} name={listing.dalali?.full_name ?? 'Dalali'} size={56} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{listing.dalali?.full_name ?? 'Dalali'}</span>
                    {isVerified && (
                      <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <i className="ti ti-check" aria-hidden="true" /> {t('lst_verified')}
                      </span>
                    )}
                    {isFavourite && (
                      <span className="bg-amber-400 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5 font-semibold">
                        <i className="ti ti-rosette-discount-check" aria-hidden="true" /> {t('lst_fav_agent')}
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
              {isVerified && agentProfileUrl && (
                <div className="mt-3">
                  <a href={agentProfileUrl}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-xs font-semibold active:scale-[0.97] transition-all">
                    <i className="ti ti-user-circle text-sm" aria-hidden="true" />
                    {t('lst_view_all_agent_listings')} {listing.dalali?.full_name ?? 'dalali huyu'}
                    <i className="ti ti-chevron-right text-xs" aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
            {isLoggedIn && (
              <div className="flex justify-end mt-1">
                <button onClick={() => setShowReportModal(true)}
                  className="text-xs text-gray-400 flex items-center gap-1 min-h-[44px] px-2 hover:text-red-500 transition-colors">
                  <i className="ti ti-alert-triangle" aria-hidden="true" />
                  <span>{t('lst_report_agent')}</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Reviews ── */}
          <div className="px-4 lg:px-0 pt-4 lg:pt-2 pb-4">
            <ReviewsSection />
          </div>

          {/* ── Similar listings ── */}
          <SimilarListings
            currentListingId={listing.id}
            region={listing.region}
            district={listing.district}
            type={listing.type}
            priceMonthly={listing.price_monthly}
          />
        </div>

        {/* ════════ RIGHT — sticky desktop sidebar ════════ */}
        <div className="hidden lg:block w-[360px] flex-shrink-0">
          <div className="sticky top-[69px] space-y-4 pb-8">

            {/* Price + CTA */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-2xl font-bold text-gray-900 leading-none">{formatPrice(listing.price_monthly)}</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Bei ya kila mwezi</p>
              <SidebarCTA />
              {listing.is_boosted && (
                <p className="text-center text-xs text-primary-500 font-medium mt-3 flex items-center justify-center gap-1">
                  <i className="ti ti-bolt" aria-hidden="true" /> {BOOSTED_LABEL}
                </p>
              )}
            </div>

            {/* Already contacted badge (desktop sidebar) */}
            {localUnlocked && unlockCreatedAt && waPhone && (
              <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <i className="ti ti-circle-check text-xl text-primary-600 flex-shrink-0" aria-hidden="true" />
                  <p className="text-sm font-semibold text-primary-800">{t('lst_already_contacted')}</p>
                </div>
                <p className="text-xs text-primary-600 mb-3" suppressHydrationWarning>
                  {t('lst_contact_opened')} {timeAgo(unlockCreatedAt, t)}
                </p>
                <ContactButtons />
              </div>
            )}

            {/* Dalali card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('lst_about_agent')}</p>
              <div className="flex items-start gap-3">
                <Avatar src={listing.dalali?.avatar_url} name={listing.dalali?.full_name ?? 'Dalali'} size={52} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="font-semibold text-gray-900">{listing.dalali?.full_name ?? 'Dalali'}</span>
                    {isVerified && (
                      <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <i className="ti ti-check" aria-hidden="true" /> {t('lst_verified')}
                      </span>
                    )}
                    {isFavourite && (
                      <span className="bg-amber-400 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5 font-semibold">
                        <i className="ti ti-rosette-discount-check" aria-hidden="true" /> {t('lst_fav_agent')}
                      </span>
                    )}
                  </div>
                  {rating > 0 && (
                    <div className="flex items-center gap-1">
                      <i className="ti ti-star-filled text-amber-400 text-sm" aria-hidden="true" />
                      <span className="text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">({ratingCount} maoni)</span>
                    </div>
                  )}
                  {profile?.bio && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{profile.bio}</p>
                  )}
                </div>
              </div>
              {isVerified && agentProfileUrl && (
                <a href={agentProfileUrl}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-xs font-semibold active:scale-[0.97] transition-all">
                  <i className="ti ti-user-circle" aria-hidden="true" />
                  {t('lst_view_all_agent_listings')} {listing.dalali?.full_name ?? 'dalali huyu'}
                  <i className="ti ti-chevron-right text-xs" aria-hidden="true" />
                </a>
              )}
              {isLoggedIn && (
                <div className="flex justify-end mt-1">
                  <button onClick={() => setShowReportModal(true)}
                    className="text-xs text-gray-400 flex items-center gap-1 min-h-[44px] px-2 hover:text-red-500 transition-colors">
                    <i className="ti ti-alert-triangle" aria-hidden="true" />
                    <span>{t('lst_report_agent')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Share */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <ShareButton listing={listing} variant="detail" />
            </div>

            {/* Ads */}
            <RankedAdSlot
              region={listing.region}
              placement="listing_detail"
              limit={3}
              title={t('cl_nearby_biz')}
            />
          </div>
        </div>
      </div>

      {/* ── Fixed bottom CTA — mobile only ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 pt-4 shadow-lg lg:hidden"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {isTaken ? (
          <div className="text-center pb-1">
            <p className="text-sm font-semibold text-amber-700 mb-1 flex items-center gap-1.5 justify-center">
              <i className="ti ti-circle-dot" aria-hidden="true" /> {t('lst_listing_taken')}
            </p>
            <a href={`/?region=${listing.region}`} className="btn-primary w-full py-3 text-sm block text-center">
              <i className="ti ti-search" aria-hidden="true" /> {t('lst_search_similar')} — {listing.region}
            </a>
          </div>
        ) : localUnlocked && waPhone ? (
          <div className="space-y-2 pb-1">
            <ContactButtons />
            <p className="text-center text-xs text-gray-400">{t('lst_same_number')}</p>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setShowUnlockModal(true)}
              className="btn-primary w-full py-3.5 text-sm"
            >
              <i className="ti ti-lock-open" aria-hidden="true" /> {t('lst_unlock_cta')} {dalaliDisplayName} – Tsh {unlockPrice.toLocaleString()}
            </button>
            <p className="text-center text-xs text-gray-400 mt-1.5">
              {t('lst_pay_once_hint')}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showReportModal && (
        <ReportDalaliModal
          listingId={listing.id}
          dalaliName={listing.dalali?.full_name ?? 'Dalali'}
          onClose={() => setShowReportModal(false)}
        />
      )}
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
