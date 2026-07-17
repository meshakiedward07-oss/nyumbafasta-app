'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Avatar from '@/components/shared/Avatar'
import SaveButton from '@/components/shared/SaveButton'
import ShareButton from '@/components/shared/ShareButton'
import type { ListingWithDalali, CommissionType } from '@/lib/types/database'
import { getShortLocation } from '@/lib/listings/formatLocation'
import { BOOSTED_LABEL, STATUS_LABELS } from '@/lib/config/listing-status'

const COMMISSION_SHORT: Record<CommissionType, string> = {
  one_month:  '1 Mwezi',
  percentage: 'Komisho %',
  fixed:      'Komisho',
  negotiable: 'Inajadiliwa',
}

// ── Property-type visual styles ───────────────────────────────────────────────
const TYPE_STYLE: Record<string, { icon: string; pillBg: string; pillText: string; label: string }> = {
  chumba:    { icon: 'ti-bed',         pillBg: 'bg-purple-100', pillText: 'text-purple-600', label: 'Chumba'    },
  apartment: { icon: 'ti-building-2',  pillBg: 'bg-blue-100',   pillText: 'text-blue-600',   label: 'Apartment' },
  nyumba:    { icon: 'ti-home-2',      pillBg: 'bg-primary-100',pillText: 'text-primary-600',label: 'Nyumba'    },
  studio:    { icon: 'ti-layout-2',    pillBg: 'bg-orange-100', pillText: 'text-orange-600', label: 'Studio'    },
  duka:      { icon: 'ti-shopping',    pillBg: 'bg-amber-100',  pillText: 'text-amber-700',  label: 'Duka'      },
}

// ── Amenity visual styles ─────────────────────────────────────────────────────
const AMENITY_STYLE: Record<string, { icon: string; bg: string; text: string; label: string }> = {
  umeme:      { icon: 'ti-bolt',          bg: 'bg-yellow-50 border-yellow-200',  text: 'text-yellow-700', label: 'Umeme'    },
  maji:       { icon: 'ti-droplet',       bg: 'bg-blue-50 border-blue-200',      text: 'text-blue-600',   label: 'Maji'     },
  wifi:       { icon: 'ti-wifi',          bg: 'bg-purple-50 border-purple-200',  text: 'text-purple-600', label: 'WiFi'     },
  parking:    { icon: 'ti-car',           bg: 'bg-gray-50 border-gray-200',      text: 'text-gray-600',   label: 'Parking'  },
  choo_ndani: { icon: 'ti-bath',          bg: 'bg-teal-50 border-teal-200',      text: 'text-teal-600',   label: 'WC Ndani' },
  daladala:   { icon: 'ti-bus',           bg: 'bg-orange-50 border-orange-200',  text: 'text-orange-600', label: 'Daladala' },
  watchman:   { icon: 'ti-shield',        bg: 'bg-red-50 border-red-200',        text: 'text-red-500',    label: 'Guard'    },
  ac:         { icon: 'ti-snowflake',     bg: 'bg-cyan-50 border-cyan-200',      text: 'text-cyan-600',   label: 'AC'       },
  dstv:       { icon: 'ti-device-tv',     bg: 'bg-indigo-50 border-indigo-200',  text: 'text-indigo-600', label: 'DSTV'     },
  solar:      { icon: 'ti-sun',           bg: 'bg-amber-50 border-amber-200',    text: 'text-amber-600',  label: 'Solar'    },
  soko:       { icon: 'ti-shopping-cart', bg: 'bg-lime-50 border-lime-200',      text: 'text-lime-700',   label: 'Soko'     },
  bustani:    { icon: 'ti-leaf',          bg: 'bg-green-50 border-green-200',    text: 'text-green-600',  label: 'Bustani'  },
}

// ── Illustrated house placeholder ─────────────────────────────────────────────
function PlaceholderHouse() {
  return (
    <svg viewBox="0 0 280 176" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="lc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe"/>
          <stop offset="100%" stopColor="#f0f9ff"/>
        </linearGradient>
        <linearGradient id="lc-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155"/>
          <stop offset="100%" stopColor="#1e293b"/>
        </linearGradient>
        <linearGradient id="lc-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fefce8"/>
          <stop offset="100%" stopColor="#fef08a"/>
        </linearGradient>
        <linearGradient id="lc-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bbf7d0"/>
          <stop offset="100%" stopColor="#86efac"/>
        </linearGradient>
        <linearGradient id="lc-door" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#27AE72"/>
          <stop offset="100%" stopColor="#1D9E75"/>
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="280" height="176" fill="url(#lc-sky)"/>

      {/* Cloud 1 */}
      <g opacity="0.8">
        <ellipse cx="56" cy="27" rx="22" ry="9" fill="white"/>
        <ellipse cx="42" cy="29" rx="13" ry="7" fill="white"/>
        <ellipse cx="70" cy="29" rx="13" ry="7" fill="white"/>
      </g>
      {/* Cloud 2 */}
      <g opacity="0.55">
        <ellipse cx="196" cy="17" rx="16" ry="6" fill="white"/>
        <ellipse cx="183" cy="19" rx="9" ry="5" fill="white"/>
        <ellipse cx="208" cy="19" rx="9" ry="5" fill="white"/>
      </g>

      {/* Sun */}
      <circle cx="242" cy="21" r="15" fill="#fde047" opacity="0.85"/>
      <circle cx="242" cy="21" r="10" fill="#facc15"/>

      {/* Ground */}
      <rect x="0" y="126" width="280" height="50" fill="url(#lc-grass)"/>

      {/* Walkway */}
      <polygon points="122,146 158,146 152,176 128,176" fill="#e2e8f0" opacity="0.9"/>
      <line x1="140" y1="146" x2="140" y2="176" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.6"/>

      {/* House body */}
      <rect x="66" y="74" width="148" height="56" fill="url(#lc-wall)" rx="1"/>
      {/* Wall shadow under roof */}
      <rect x="66" y="74" width="148" height="8" fill="#d97706" opacity="0.08"/>

      {/* Roof */}
      <polygon points="50,78 140,26 230,78" fill="url(#lc-roof)"/>
      {/* Roof ridge highlight */}
      <line x1="50" y1="78" x2="140" y2="26" stroke="white" strokeWidth="1.5" opacity="0.12"/>
      <line x1="230" y1="78" x2="140" y2="26" stroke="white" strokeWidth="1.5" opacity="0.12"/>
      {/* Roof bottom edge */}
      <rect x="48" y="76" width="184" height="4" fill="#1e293b" opacity="0.5" rx="0.5"/>

      {/* Chimney */}
      <rect x="174" y="41" width="11" height="24" fill="#64748b" rx="0.5"/>
      <rect x="172" y="38" width="15" height="5" fill="#94a3b8" rx="1"/>
      {/* Smoke */}
      <circle cx="179.5" cy="30" r="5" fill="white" opacity="0.25"/>
      <circle cx="181" cy="22" r="3.5" fill="white" opacity="0.18"/>
      <circle cx="178" cy="15" r="2.5" fill="white" opacity="0.12"/>

      {/* Main door */}
      <rect x="116" y="94" width="48" height="36" fill="url(#lc-door)" rx="3"/>
      {/* Door top arch */}
      <path d="M116,103 Q140,86 164,103" fill="#27AE72" opacity="0.9"/>
      {/* Door panel */}
      <rect x="119" y="97" width="42" height="14" fill="#4ade80" opacity="0.2" rx="1"/>
      <rect x="119" y="113" width="42" height="14" fill="white" opacity="0.06" rx="1"/>
      {/* Door knob */}
      <circle cx="156" cy="114" r="3" fill="#fbbf24"/>
      <circle cx="156" cy="114" r="1.5" fill="#f59e0b"/>

      {/* Window left */}
      <rect x="78" y="84" width="30" height="23" fill="#bfdbfe" rx="2"/>
      <rect x="78" y="84" width="30" height="23" fill="none" stroke="#93c5fd" strokeWidth="1" rx="2"/>
      <line x1="78" y1="95.5" x2="108" y2="95.5" stroke="#93c5fd" strokeWidth="0.8"/>
      <line x1="93" y1="84" x2="93" y2="107" stroke="#93c5fd" strokeWidth="0.8"/>
      {/* Window reflection */}
      <rect x="80" y="86" width="9" height="5" fill="white" opacity="0.45" rx="1"/>
      <rect x="81" y="93" width="4" height="3" fill="white" opacity="0.3" rx="0.5"/>

      {/* Window right */}
      <rect x="172" y="84" width="30" height="23" fill="#bfdbfe" rx="2"/>
      <rect x="172" y="84" width="30" height="23" fill="none" stroke="#93c5fd" strokeWidth="1" rx="2"/>
      <line x1="172" y1="95.5" x2="202" y2="95.5" stroke="#93c5fd" strokeWidth="0.8"/>
      <line x1="187" y1="84" x2="187" y2="107" stroke="#93c5fd" strokeWidth="0.8"/>
      {/* Window reflection */}
      <rect x="174" y="86" width="9" height="5" fill="white" opacity="0.45" rx="1"/>
      <rect x="175" y="93" width="4" height="3" fill="white" opacity="0.3" rx="0.5"/>

      {/* Bush left */}
      <ellipse cx="72" cy="129" rx="15" ry="10" fill="#4ade80" opacity="0.9"/>
      <ellipse cx="61" cy="132" rx="10" ry="7" fill="#22c55e" opacity="0.85"/>
      <circle cx="67" cy="124" r="3" fill="#86efac"/>
      {/* Flower left */}
      <circle cx="74" cy="123" r="2.5" fill="#f9a8d4" opacity="0.9"/>
      <circle cx="74" cy="123" r="1" fill="#fbbf24"/>

      {/* Bush right */}
      <ellipse cx="208" cy="129" rx="15" ry="10" fill="#4ade80" opacity="0.9"/>
      <ellipse cx="219" cy="132" rx="10" ry="7" fill="#22c55e" opacity="0.85"/>
      <circle cx="213" cy="124" r="3" fill="#86efac"/>
      {/* Flower right */}
      <circle cx="206" cy="123" r="2.5" fill="#f9a8d4" opacity="0.9"/>
      <circle cx="206" cy="123" r="1" fill="#fbbf24"/>

      {/* Ground details */}
      <ellipse cx="140" cy="135" rx="30" ry="5" fill="#166534" opacity="0.08"/>
    </svg>
  )
}

export default function ListingCard({ listing, hasUnlocked = false, priority = false }: { listing: ListingWithDalali; hasUnlocked?: boolean; priority?: boolean }) {
  const router = useRouter()
  const [imgError, setImgError] = useState(false)

  const profile           = listing.dalali?.dalali_profiles
  const rating            = profile?.rating_avg ?? 0
  const isVerified        = profile?.is_premium_verified ?? false
  const isFavourite       = profile?.is_favourite_dalali ?? false
const typeStyle         = TYPE_STYLE[listing.type] ?? TYPE_STYLE.nyumba

  const isActive = listing.status === 'active'

  return (
    <div
      className="block animate-fadeIn cursor-pointer"
      onClick={() => router.push(`/listings/${listing.id}`)}
      role="article"
    >
      <div
        className={`group bg-white rounded-2xl overflow-hidden transition-all duration-300 active:scale-[0.98]
          ${listing.is_boosted
            ? 'border-2 border-yellow-400 shadow-[0_4px_24px_rgba(251,191,36,0.25)]'
            : 'border border-gray-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.06),_0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12),_0_2px_6px_rgba(0,0,0,0.06)] hover:-translate-y-1'
          }`}
      >

        {/* Boosted banner */}
        {listing.is_boosted && (
          <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 text-white text-xs font-bold px-3 py-1.5 text-center tracking-wide flex items-center justify-center gap-1.5">
            <i className="ti ti-rocket text-sm" aria-hidden="true" />
            {BOOSTED_LABEL} na NyumbaFasta
            <i className="ti ti-rocket text-sm" aria-hidden="true" />
          </div>
        )}

        {/* Image area */}
        <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
          {listing.images?.length > 0 && !imgError ? (
            <>
              <Image
                fill
                src={listing.images[0]}
                alt={listing.title ?? `${typeStyle.label} – ${listing.district}`}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImgError(true)}
                sizes="(max-width: 640px) 100vw, 50vw"
                priority={priority}
              />
              {/* Gradient overlay for bottom text readability */}
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
            </>
          ) : (
            <PlaceholderHouse />
          )}

          {/* Photo count + video badge */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            {listing.images?.length > 1 && (
              <span className="bg-black/55 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                <i className="ti ti-camera text-xs" aria-hidden="true" />
                {listing.images.length}
              </span>
            )}
            {(listing as typeof listing & { video_url?: string | null }).video_url && (
              <span className="bg-black/55 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                <i className="ti ti-video text-xs" aria-hidden="true" />
                Video
              </span>
            )}
          </div>

          {/* Status badge */}
          {isActive ? (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm border border-primary-100">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
              {STATUS_LABELS.active.label}
            </div>
          ) : (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm border border-gray-200">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              {STATUS_LABELS[listing.status]?.label ?? STATUS_LABELS.taken.label}
            </div>
          )}

          {/* Save + Share — stop click from bubbling to the card nav handler */}
          <div className="absolute top-2 right-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
            <ShareButton listing={listing} variant="card" />
            <SaveButton listingId={listing.id} size="sm" />
          </div>
        </div>

        {/* Card content */}
        <div className="p-3.5">

          {/* Type chip + Price */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${typeStyle.pillBg} ${typeStyle.pillText}`}>
              <i className={`ti ${typeStyle.icon} text-xs`} aria-hidden="true" />
              {typeStyle.label}
            </div>
            <div className="text-primary-600 text-sm font-bold whitespace-nowrap flex-shrink-0 tabular-nums">
              {formatPrice(listing.price_monthly)}
              <span className="text-[10px] font-medium text-gray-400">/mwezi</span>
            </div>
          </div>

          {/* Title */}
          <p className="font-bold text-gray-900 text-[14px] leading-snug mb-1.5 line-clamp-1">
            {listing.title || `${typeStyle.label} – ${listing.district}`}
          </p>

          {/* Location */}
          <p className="text-gray-400 text-xs mb-3 flex items-center gap-1">
            <i className="ti ti-map-pin text-[11px] text-primary-400 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">
              {getShortLocation(listing)}
            </span>
          </p>

          {/* Amenity pills */}
          <div className="flex gap-1 flex-wrap mb-2.5">
            {hasUnlocked && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-primary-50 border-primary-200 text-primary-700">
                <i className="ti ti-circle-check text-xs" aria-hidden="true" />
                Namba Unayo
              </span>
            )}
            {listing.commission_type && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                <i className="ti ti-coins text-[10px]" aria-hidden="true" />
                {COMMISSION_SHORT[listing.commission_type]}
              </span>
            )}
            {listing.furnished && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                <i className="ti ti-armchair text-xs" aria-hidden="true" />
                {listing.furnished === 'furnished' ? 'Imejazwa' : listing.furnished === 'semi' ? 'Nusu Samani' : 'Tupu'}
              </span>
            )}
            {listing.amenities?.slice(0, 3).map(a => {
              const s = AMENITY_STYLE[a]
              if (!s) return (
                <span key={a} className="text-xs px-2 py-0.5 rounded-full border bg-gray-50 border-gray-200 text-gray-500">
                  {a}
                </span>
              )
              return (
                <span key={a} className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full border ${s.bg} ${s.text}`}>
                  <i className={`ti ${s.icon} text-[10px]`} aria-hidden="true" />
                  {s.label}
                </span>
              )
            })}
            {listing.amenities?.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-50 border-gray-100 text-gray-400">
                +{listing.amenities.length - 3}
              </span>
            )}
          </div>

          {/* Multi-unit occupancy */}
          {listing.listing_unit_type === 'multi' && isActive && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-primary-50 border-primary-100 text-primary-700">
                <i className="ti ti-building text-xs" aria-hidden="true" />
                Nafasi {(listing.total_capacity ?? 1) - (listing.current_occupancy ?? 0)} zilizobaki
              </span>
            </div>
          )}
          {listing.listing_unit_type === 'multi' && listing.status === 'taken' && listing.auto_deactivated_at && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-red-50 border-red-100 text-red-600">
                <i className="ti ti-lock text-xs" aria-hidden="true" />
                Imejaa
              </span>
            </div>
          )}

          {/* Dalali footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-gray-100/70">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Avatar
                  src={listing.dalali?.avatar_url}
                  name={listing.dalali?.full_name ?? 'Dalali'}
                  size={28}
                />
                {isVerified && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-primary-500 rounded-full flex items-center justify-center border border-white">
                    <i className="ti ti-check text-white" style={{ fontSize: '7px' }} aria-hidden="true" />
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-xs font-medium text-gray-700 leading-tight">{listing.dalali?.full_name}</p>
                  {isFavourite && (
                    <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                      <i className="ti ti-rosette-discount-check" style={{ fontSize: '9px' }} aria-hidden="true" /> Halisi
                    </span>
                  )}
                </div>
                {rating > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1,2,3,4,5].map(star => (
                      <i
                        key={star}
                        className={`ti ti-star-filled text-[9px] ${star <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`}
                        aria-hidden="true"
                      />
                    ))}
                    <span className="text-[10px] text-gray-400 ml-0.5">{rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full">
              <i className="ti ti-eye text-xs text-gray-400" aria-hidden="true" />
              <span className="text-xs text-gray-400">{listing.view_count}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(amount: number): string {
  if (amount >= 1_000_000) return `Tsh ${(amount / 1_000_000).toFixed(1)}M/mwezi`
  if (amount >= 1_000) return `Tsh ${(amount / 1_000).toFixed(0)}k/mwezi`
  return `Tsh ${amount}/mwezi`
}
