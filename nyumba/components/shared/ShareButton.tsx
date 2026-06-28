'use client'
import { useState } from 'react'

// ── Helpers ───────────────────────────────────────────────
const amenityEmoji: Record<string, string> = {
  umeme: '⚡ Umeme', maji: '💧 Maji', wifi: '📶 WiFi', parking: '🚗 Parking',
  choo_ndani: '🚿 Choo ndani', daladala: '🚌 Daladala', watchman: '💂 Watchman',
  ac: '❄️ AC', dstv: '📺 DSTV', solar: '☀️ Solar', soko: '🛒 Soko', bustani: '🌿 Bustani',
}
const furnishedLabel: Record<string, string> = {
  furnished: 'Ina Samani', semi: 'Nusu Samani', empty: 'Bila Samani',
}
const typeLabel: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
}

export type ShareListing = {
  id: string
  title?: string | null
  type: string
  district: string
  region: string
  price_monthly: number
  furnished?: string | null
  amenities?: string[] | null
  dalali?: { dalali_profiles?: { is_premium_verified?: boolean } | null } | null
}

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return `${n}`
}

function buildMessage(listing: ShareListing): string {
  const title = listing.title || `${typeLabel[listing.type] || listing.type} – ${listing.district}`
  const furnished = furnishedLabel[listing.furnished ?? ''] ?? ''
  const isVerified = listing.dalali?.dalali_profiles?.is_premium_verified
  const amenities = (listing.amenities ?? [])
    .slice(0, 5)
    .map(a => amenityEmoji[a] || a)
    .join(' | ')
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nyumbafasta.co'
  const url = `${origin}/listings/${listing.id}`

  const lines = [
    `🏠 *${title}*`,
    '',
    `📍 ${listing.district}, ${listing.region}`,
    `💰 Tsh ${fmtPrice(listing.price_monthly)}/mwezi`,
  ]
  if (furnished) lines.push(`🛋️ ${furnished}`)
  if (isVerified) lines.push(`✅ Dalali Amethibitishwa`)
  if (amenities) {
    lines.push('')
    lines.push(`✨ Amenities:`)
    lines.push(amenities)
  }
  lines.push('')
  lines.push(`👀 Angalia picha na maelezo zaidi:`)
  lines.push(url)
  lines.push('')
  lines.push(`_NyumbaFasta — Haraka & Kwa Uhakika_ 🏠`)

  return lines.join('\n')
}

function trackShare(id: string) {
  fetch(`/api/v1/listings/${id}/share`, { method: 'POST' }).catch(() => {})
}

// ── WhatsApp icon SVG ─────────────────────────────────────
function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.524 3.657 1.435 5.161L2 22l4.981-1.401A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.946 7.946 0 01-4.031-1.094l-.29-.172-2.953.83.831-2.884-.19-.303A7.954 7.954 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>
    </svg>
  )
}

// ── Share icon SVG ────────────────────────────────────────
function ShareIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────
type Variant = 'card' | 'detail' | 'dashboard'

interface Props {
  listing: ShareListing
  variant?: Variant
  className?: string
}

export default function ShareButton({ listing, variant = 'detail', className = '' }: Props) {
  const [copied, setCopied]   = useState(false)
  const [shared, setShared]   = useState(false)

  async function doShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const message = buildMessage(listing)
    const origin = window.location.origin
    const url    = `${origin}/listings/${listing.id}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: listing.title || `${typeLabel[listing.type] || listing.type} – ${listing.district}`,
          text: `🏠 ${listing.district}, ${listing.region} — Tsh ${fmtPrice(listing.price_monthly)}/mwezi`,
          url,
        })
        trackShare(listing.id)
        setShared(true)
        setTimeout(() => setShared(false), 2500)
      } catch {
        // User cancelled or error — open WhatsApp directly
        openWA(message)
      }
    } else {
      openWA(message)
      trackShare(listing.id)
    }
  }

  function openWA(message: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  async function doCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/listings/${listing.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // iOS fallback
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Card variant — small icon ──────────────────────────
  if (variant === 'card') {
    return (
      <button
        onClick={doShare}
        aria-label="Shiriki listing hii"
        title="Shiriki listing hii"
        className={`flex items-center justify-center w-8 h-8 rounded-full
                    bg-white/90 text-green-600 shadow-sm
                    hover:bg-green-50 active:scale-90 transition-all ${className}`}
      >
        <ShareIcon size={13} />
      </button>
    )
  }

  // ── Dashboard variant — compact button ─────────────────
  if (variant === 'dashboard') {
    return (
      <button
        onClick={doShare}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                    bg-green-50 text-green-700 hover:bg-green-100
                    active:scale-[0.97] transition-all ${className}`}
      >
        {shared
          ? 'Imeshirikiwa!'
          : <><ShareIcon size={11} /> Shiriki</>
        }
      </button>
    )
  }

  // ── Detail variant — full buttons ─────────────────────
  return (
    <div className={`space-y-2 ${className}`}>
      <button
        onClick={doShare}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl
                   bg-[#25D366] text-white font-semibold text-sm shadow-sm
                   hover:bg-[#1ebe59] active:scale-[0.98] transition-all"
      >
        <WhatsAppIcon size={18} />
        {shared ? 'Imeshirikiwa!' : 'Shiriki kwenye WhatsApp'}
      </button>
      <button
        onClick={doCopy}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                   bg-gray-100 text-gray-700 font-medium text-sm
                   hover:bg-gray-200 active:scale-[0.98] transition-all"
      >
        {copied ? <><i className="ti ti-circle-check" aria-hidden="true" /> Link imenakiliwa!</> : <><i className="ti ti-link" aria-hidden="true" /> Nakili Link</>}
      </button>
    </div>
  )
}
