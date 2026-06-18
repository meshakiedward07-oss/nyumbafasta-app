'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Avatar from '@/components/shared/Avatar'
import SaveButton from '@/components/shared/SaveButton'
import ShareButton from '@/components/shared/ShareButton'
import type { ListingWithDalali } from '@/lib/types/database'

export default function ListingCard({ listing, hasUnlocked = false }: { listing: ListingWithDalali; hasUnlocked?: boolean }) {
  const router = useRouter()
  const [imgError, setImgError] = useState(false)

  const profile = listing.dalali?.dalali_profiles
  const rating = profile?.rating_avg ?? 0
  const isVerified = profile?.is_premium_verified ?? false

  const statusColor = listing.status === 'active'
    ? 'bg-primary-50 text-primary-700'
    : 'bg-gray-100 text-gray-500'

  const statusLabel = listing.status === 'active' ? 'Inapatikana' : 'Imechukuliwa'

  const furnishedLabel: Record<string, string> = {
    furnished: 'Furnished',
    semi: 'Semi-furnished',
    empty: 'Empty',
  }

  const typeLabel: Record<string, string> = {
    chumba: 'Chumba',
    apartment: 'Apartment',
    nyumba: 'Nyumba',
    studio: 'Studio',
    duka: 'Duka',
  }

  return (
    <div onClick={() => router.push(`/listings/${listing.id}`)} className="block animate-fadeIn cursor-pointer">
      <div className={`
        bg-white rounded-2xl overflow-hidden shadow-sm border
        transition-all duration-200 active:scale-[0.98] hover:shadow-md hover:-translate-y-0.5
        ${listing.is_boosted ? 'border-yellow-400 ring-2 ring-yellow-100 shadow-yellow-100' : 'border-gray-100'}
      `}>

        {/* Boosted badge */}
        {listing.is_boosted && (
          <div className="bg-gradient-to-r from-yellow-400 to-amber-400 text-white text-xs font-bold px-3 py-1 text-center tracking-wide">
            🚀 Inashauriwa na NyumbaFasta
          </div>
        )}

        {/* Picha */}
        <div className="relative h-44 bg-gray-100 overflow-hidden">
          {listing.images?.length > 0 && !imgError ? (
            <Image
              fill
              src={listing.images[0]}
              alt={listing.title}
              className="object-cover"
              onError={() => setImgError(true)}
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
              <span className="text-4xl">🏠</span>
              <span className="text-xs">Hakuna picha</span>
            </div>
          )}

          {/* Picha count + video badge */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            {listing.images?.length > 1 && (
              <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                📷 {listing.images.length}
              </span>
            )}
            {(listing as typeof listing & { video_url?: string | null }).video_url && (
              <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">🎥</span>
            )}
          </div>

          {/* Status badge */}
          <div className={`absolute top-2 left-2 text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
            {statusLabel}
          </div>

          {/* Save + Share buttons */}
          <div className="absolute top-2 right-2 flex gap-1.5">
            <ShareButton listing={listing} variant="card" />
            <SaveButton listingId={listing.id} size="sm" />
          </div>
        </div>

        {/* Content */}
        <div className="p-3">

          {/* Title na Bei */}
          <div className="flex justify-between items-start gap-2 mb-1">
            <p className="font-semibold text-gray-900 text-sm leading-tight flex-1">
              {typeLabel[listing.type] || listing.type} – {listing.district}
            </p>
            <p className="text-primary-600 font-bold text-sm whitespace-nowrap">
              {formatPrice(listing.price_monthly)}
            </p>
          </div>

          {/* Location */}
          <p className="text-gray-500 text-xs mb-2 flex items-center gap-1">
            <span>📍</span>
            <span>{listing.district}, {listing.region}</span>
          </p>

          {/* Badges */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {hasUnlocked && (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full border border-green-200">
                💬 Umeshazungumza
              </span>
            )}
            {listing.furnished && (
              <span className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full border border-amber-100">
                {furnishedLabel[listing.furnished] || listing.furnished}
              </span>
            )}
            {listing.amenities?.slice(0, 2).map(a => (
              <span key={a} className="bg-gray-50 text-gray-500 text-xs px-2 py-0.5 rounded-full border border-gray-100">
                {amenityLabel[a] || a}
              </span>
            ))}
            {listing.amenities?.length > 2 && (
              <span className="bg-gray-50 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                +{listing.amenities.length - 2}
              </span>
            )}
          </div>

          {/* Dalali info */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div className="flex items-center gap-1.5">
              <Avatar
                src={listing.dalali?.avatar_url}
                name={listing.dalali?.full_name ?? 'Dalali'}
                size={24}
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-gray-700">
                    {listing.dalali?.full_name}
                  </span>
                  {isVerified && (
                    <span className="text-primary-500 text-xs" title="Dalali aliyethibitishwa">✓</span>
                  )}
                </div>
                {rating > 0 && (
                  <div className="flex items-center gap-0.5">
                    <span className="text-amber-400 text-xs">⭐</span>
                    <span className="text-xs text-gray-400">{rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Views */}
            <div className="flex items-center gap-1 text-gray-400">
              <span className="text-xs">👁</span>
              <span className="text-xs">{listing.view_count}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// Helpers
function formatPrice(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M/mo`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k/mo`
  return `${amount}/mo`
}

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
