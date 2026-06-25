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
import ReportDalaliModal from '@/components/listings/ReportDalaliModal'
import NeighborhoodInfo from '@/components/listings/NeighborhoodInfo'
import { VideoPlayer } from '@/components/listings/VideoPlayer'

const SimilarListings = dynamic(
  () => import('@/components/listings/SimilarListings'),
  { ssr: false }
)

const SingleListingMap = dynamic(
  () => import('@/components/listings/SingleListingMap'),
  { ssr: false }
)

const amenityLabel: Record<string, string> = {
  umeme: '⚡ Umeme',
  maji: '💧 Maji',
  wifi: '📶 WiFi',
  parking: '🚗 Parking',
  choo_ndani: '🚿 Choo ndani',
  daladala: '🚌 Daladala',
  watchman: '💂 Watchman',
  ac: '❄️ AC',
  dstv: '📺 DSTV',
  solar: '☀️ Solar',
  soko: '🛒 Soko',
  bustani: '🌿 Bustani',
}

const typeLabel: Record<string, string> = {
  chumba: 'Chumba',
  apartment: 'Apartment',
  nyumba: 'Nyumba',
  studio: 'Studio',
  duka: 'Duka',
}

const furnishedLabel: Record<string, string> = {
  furnished: 'Furnished',
  semi: 'Semi-furnished',
  empty: 'Empty',
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
}

export default function ListingDetail({ listing, hasUnlocked, isLoggedIn, unlockCreatedAt, hasReviewed, reviews }: Props) {
  const router = useRouter()
  const [activeImg, setActiveImg] = useState(0)

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
  const [reviewed] = useState(hasReviewed)
  const [touchStartX, setTouchStartX] = useState(0)

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX - e.changedTouches[0].clientX
    if (Math.abs(diff) < 40) return
    if (diff > 0) {
      setActiveImg(prev => Math.min(prev + 1, images.length - 1))
    } else {
      setActiveImg(prev => Math.max(prev - 1, 0))
    }
    setImgError(false)
  }

  const profile = listing.dalali?.dalali_profiles
  const isVerified = profile?.is_premium_verified ?? false
  const rating = profile?.rating_avg ?? 0
  const ratingCount = profile?.rating_count ?? 0
  const whatsappNumber = profile?.whatsapp_number

  const isTaken = listing.status === 'taken'

  const statusBadge = listing.status === 'active'
    ? { label: 'Inapatikana', cls: 'bg-primary-50 text-primary-700' }
    : listing.status === 'taken'
    ? { label: 'Imepangishwa', cls: 'bg-amber-50 text-amber-700' }
    : { label: listing.status, cls: 'bg-gray-100 text-gray-500' }

  const images    = listing.images ?? []
  const videoUrl  = (listing as Listing & { video_url?: string | null }).video_url ?? null

  return (
    <article className="min-h-screen bg-gray-50 pb-28">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600"
        >
          ←
        </button>
        <h1 className="flex-1 text-sm font-semibold text-gray-800 truncate">
          {typeLabel[listing.type] || listing.type} – {listing.district}
        </h1>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
        <SaveButton listingId={listing.id} size="sm" />
      </div>

      {/* ── Image gallery ── */}
      <div
        className="relative bg-gray-200 h-64 touch-pan-y select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 0 && !imgError ? (
          <Image
            fill
            src={images[activeImg]}
            alt={listing.title}
            className="object-cover"
            onError={() => setImgError(true)}
            sizes="100vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <span className="text-5xl">🏠</span>
            <span className="text-sm">Hakuna picha</span>
          </div>
        )}

        {/* Boosted badge */}
        {listing.is_boosted && (
          <div className="absolute top-3 left-3 bg-primary-500 text-white text-xs font-medium px-2 py-1 rounded-full">
            ⚡ Imeboostwa
          </div>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => { setActiveImg(i); setImgError(false) }}
                className={`rounded-full transition-all ${i === activeImg ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
              />
            ))}
          </div>
        )}

        {/* Image count */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            📷 {activeImg + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none bg-white border-b border-gray-100">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => { setActiveImg(i); setImgError(false) }}
              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                activeImg === i ? 'border-primary-500' : 'border-transparent'
              }`}
            >
              <Image fill src={src} alt="" className="object-cover" sizes="56px" />
            </button>
          ))}
        </div>
      )}

      {/* ── Video player ── */}
      {videoUrl && (
        <div className="px-4 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🎥 Video ya Nyumba</p>
          <VideoPlayer src={videoUrl} poster={images[0]} />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="px-4 pt-4 space-y-4">

        {/* Price + title */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
              🏠 {typeLabel[listing.type] || listing.type}
            </span>
            {listing.type !== 'duka' && listing.bedrooms && (
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                🛏 Vyumba {listing.bedrooms}
              </span>
            )}
            {listing.type !== 'duka' && listing.furnished && (
              <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">
                {furnishedLabel[listing.furnished] || listing.furnished}
              </span>
            )}
            {listing.type === 'duka' && (listing as typeof listing & { shop_size_sqm?: number | null }).shop_size_sqm && (
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                📐 {(listing as typeof listing & { shop_size_sqm?: number | null }).shop_size_sqm} m²
              </span>
            )}
            {listing.type === 'duka' && (listing as typeof listing & { floor_level?: number | null }).floor_level != null && (
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                🏢 {(listing as typeof listing & { floor_level?: number | null }).floor_level === 0 ? 'Chini' : `Ghorofa ${(listing as typeof listing & { floor_level?: number | null }).floor_level}`}
              </span>
            )}
            {listing.type === 'duka' && (listing as typeof listing & { commercial_use?: string | null }).commercial_use && (
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                🏪 {(listing as typeof listing & { commercial_use?: string | null }).commercial_use}
              </span>
            )}
          </div>
        </div>

        {/* Location */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📍 Mahali</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
            <div>
              <p className="text-xs text-gray-400">Mkoa</p>
              <p className="text-sm font-medium text-gray-800">{listing.region}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Wilaya</p>
              <p className="text-sm font-medium text-gray-800">{listing.district}</p>
            </div>
            {listing.ward && (
              <div>
                <p className="text-xs text-gray-400">Kata</p>
                <p className="text-sm font-medium text-gray-800">{listing.ward}</p>
              </div>
            )}
            {listing.mtaa && (
              <div>
                <p className="text-xs text-gray-400">Mtaa / Kijiji</p>
                <p className="text-sm font-medium text-gray-800">{listing.mtaa}</p>
              </div>
            )}
          </div>
          {listing.address_full && (
            <div className="pt-2 border-t border-gray-100 mb-3">
              <p className="text-xs text-gray-400 mb-0.5">Anwani Kamili</p>
              <p className="text-xs text-gray-600">{listing.address_full}</p>
            </div>
          )}
          {!!(listing.latitude && listing.longitude) && (
            <SingleListingMap
              latitude={listing.latitude as number}
              longitude={listing.longitude as number}
              district={listing.district}
              region={listing.region}
            />
          )}
        </section>

        {/* Description */}
        {listing.description && (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">📄 Maelezo</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{listing.description}</p>
          </section>
        )}

        {/* Amenities */}
        {listing.amenities?.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">✅ Huduma zilizopo</h3>
            <div className="flex flex-wrap gap-2">
              {listing.amenities.map(a => (
                <span
                  key={a}
                  className="bg-primary-50 text-primary-700 text-xs px-3 py-1.5 rounded-full border border-primary-100"
                >
                  {amenityLabel[a] || a}
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
        {localUnlocked && unlockCreatedAt && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3">
            <div className="flex items-center gap-3 mb-2.5">
              <span className="text-2xl flex-shrink-0">✅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">Umeshazungumza na dalali huyu</p>
                <p className="text-xs text-green-600" suppressHydrationWarning>Ulifungua contact {timeAgo(unlockCreatedAt)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/${whatsappNumber?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 bg-green-500 text-white text-xs px-3 py-2 rounded-xl font-semibold active:scale-95 transition-transform"
              >
                💬 WhatsApp
              </a>
              <a
                href={`tel:+${whatsappNumber?.replace(/\D/g, '')}`}
                className="flex items-center justify-center gap-1.5 bg-blue-500 text-white text-xs px-3 py-2 rounded-xl font-semibold active:scale-95 transition-transform"
              >
                📞 Piga Simu
              </a>
            </div>
          </div>
        )}

        {/* Share */}
        <ShareButton listing={listing} variant="detail" />

        {/* Dalali card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">👤 Kuhusu Dalali</h3>
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
                    ✓ Verified
                  </span>
                )}
              </div>
              {rating > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-amber-400 text-sm">⭐</span>
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

        {/* Report dalali link — only for logged-in non-dalali users */}
        {isLoggedIn && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowReportModal(true)}
              className="text-xs text-gray-400 flex items-center gap-1 py-1 hover:text-red-500 transition-colors"
            >
              <span>⚠️</span>
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

        {/* Review prompt — shown after unlock, client gets notification in 3 days */}
        {localUnlocked && !reviewed && (
          <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-sm font-semibold text-primary-700">Tutakuomba toa maoni</p>
                <p className="text-xs text-primary-500 mt-0.5">
                  Baada ya siku 3 utapata arifa kukuomba utoe maoni kuhusu dalali
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex gap-4 text-center">
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-900">{listing.view_count}</p>
              <p className="text-xs text-gray-400">👁 Waliotazama</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-900">{listing.share_count ?? 0}</p>
              <p className="text-xs text-gray-400">🔗 Walishare</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-900">{listing.lead_count}</p>
              <p className="text-xs text-gray-400">📞 Leads</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Taken banner ── */}
      {isTaken && (
        <div className="mx-4 mb-4 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
          <p className="font-semibold text-gray-700 mb-1">😔 Nyumba hii imeshapangishwa</p>
          <p className="text-gray-400 text-sm">Angalia zinazofanana hapa chini</p>
        </div>
      )}

      {/* ── Similar listings (shown for all listings) ── */}
      <SimilarListings
        currentListingId={listing.id}
        region={listing.region}
        district={listing.district}
        type={listing.type}
        priceMonthly={listing.price_monthly}
      />

      {/* ── Fixed bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 shadow-lg">
        {isTaken ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-amber-700 mb-1">🔴 Nyumba hii imeshapangishwa</p>
            <a href={`/?region=${listing.region}`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                         bg-primary-500 text-white font-semibold text-sm active:scale-95 transition-transform">
              🔍 Tafuta zinazofanana — {listing.region}
            </a>
          </div>
        ) : localUnlocked ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`https://wa.me/${whatsappNumber?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl
                           bg-green-500 text-white font-semibold text-sm shadow-md
                           active:scale-95 transition-transform"
              >
                <span className="text-xl leading-none">💬</span>
                <span>WhatsApp</span>
              </a>
              <a
                href={`tel:+${whatsappNumber?.replace(/\D/g, '')}`}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl
                           bg-blue-500 text-white font-semibold text-sm shadow-md
                           active:scale-95 transition-transform"
              >
                <span className="text-xl leading-none">📞</span>
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
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                         bg-primary-500 text-white font-semibold text-sm shadow-md
                         active:scale-95 transition-transform"
            >
              🔓 Pata Nambari ya WhatsApp – Tsh 2,000
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
          listingTitle={`${typeLabel[listing.type] || listing.type} – ${listing.district}`}
          whatsappNumber={whatsappNumber ?? ''}
          onClose={() => setShowUnlockModal(false)}
          onUnlocked={() => {
            setLocalUnlocked(true)
            setShowUnlockModal(false)
          }}
        />
      )}

    </article>
  )
}
