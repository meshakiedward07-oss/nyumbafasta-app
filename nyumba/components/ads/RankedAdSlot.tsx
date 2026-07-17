'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { getOrCreateSessionId } from '@/lib/ads/session'

// ── Types ──────────────────────────────────────────────────────────────────────

type RankedAd = {
  id:            string
  ad_type:       string
  title:         string
  body_text:     string | null
  image_url:     string | null
  cta_type:      string
  cta_value:     string
  is_featured:   boolean
  quality_score: number
  advertiser: {
    business_name:     string
    business_category: string
    logo_url:          string | null
    city:              string
  } | null
}

// ── Individual card ────────────────────────────────────────────────────────────

function AdCard({ ad }: { ad: RankedAd }) {
  const href =
    ad.cta_type === 'whatsapp' ? `https://wa.me/${ad.cta_value}` :
    ad.cta_type === 'call'     ? `tel:${ad.cta_value}` :
    ad.cta_value

  const ctaLabel =
    ad.cta_type === 'whatsapp' ? '💬 WhatsApp' :
    ad.cta_type === 'call'     ? '📞 Simu' :
    '🌐 Tovuti'

  const ctaCls =
    ad.cta_type === 'whatsapp' ? 'bg-green-500 hover:bg-green-600' :
    ad.cta_type === 'call'     ? 'bg-blue-500 hover:bg-blue-600' :
    'bg-purple-500 hover:bg-purple-600'

  return (
    <div className={`bg-white rounded-xl border ${
      ad.is_featured ? 'border-amber-200 shadow-amber-50' : 'border-gray-100'
    } p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition`}>

      {/* Logo / image */}
      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
        {ad.advertiser?.logo_url ? (
          <Image
            src={ad.advertiser.logo_url}
            alt={ad.advertiser.business_name}
            fill className="object-cover" sizes="48px"
          />
        ) : ad.image_url ? (
          <Image
            src={ad.image_url}
            alt={ad.title}
            fill className="object-cover" sizes="48px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl bg-gray-50">
            🏪
          </div>
        )}
        {ad.is_featured && (
          <span className="absolute bottom-0 right-0 bg-amber-400 text-[8px] font-bold text-amber-900 leading-tight px-0.5 rounded-tl">
            ⭐
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-800 text-sm truncate leading-tight">
          {ad.title}
        </div>
        {ad.advertiser && (
          <div className="text-xs text-gray-400 truncate mt-0.5">
            {ad.advertiser.business_category}
            {ad.advertiser.city ? ` · ${ad.advertiser.city}` : ''}
          </div>
        )}
        {ad.body_text && (
          <div className="text-xs text-gray-500 truncate mt-0.5">{ad.body_text}</div>
        )}
      </div>

      {/* CTA */}
      <a
        href={href}
        target={ad.cta_type === 'website' ? '_blank' : undefined}
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className={`flex-shrink-0 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${ctaCls}`}
      >
        {ctaLabel}
      </a>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[68px] bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  region:    string
  category?: string
  adType?:   string
  limit?:    number
  title?:    string
  allUrl?:   string    // href for "Tazama zote (N)" link
  className?: string
}

export default function RankedAdSlot({
  region,
  category,
  adType,
  limit = 5,
  title = 'Biashara Zinazopendekeza',
  allUrl,
  className = '',
}: Props) {
  const [ads, setAds]       = useState<RankedAd[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!region) { setLoading(false); return }

    const sid = getOrCreateSessionId()
    const p   = new URLSearchParams({ region, sid, limit: String(limit) })
    if (adType)   p.set('type', adType)
    if (category) p.set('category', category)

    setLoading(true)
    fetch(`/api/v1/ads/ranked?${p}`)
      .then(r => r.json())
      .then(d => {
        setAds(d.ads  ?? [])
        setTotal(d.total ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [region, category, adType, limit])

  useEffect(() => { load() }, [load])

  // Nothing to show once loaded
  if (!loading && ads.length === 0) return null

  const showViewAll = !loading && total > ads.length && allUrl

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {title}
        </h3>
        {showViewAll && (
          <Link
            href={allUrl!}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline"
          >
            Tazama zote ({total}) →
          </Link>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <Skeleton count={3} />
      ) : (
        <div className="space-y-2">
          {ads.map(ad => <AdCard key={ad.id} ad={ad} />)}
        </div>
      )}

      {/* "Sponsored" watermark */}
      {!loading && ads.length > 0 && (
        <p className="text-[10px] text-gray-300 text-right mt-1 pr-0.5">
          Matangazo · NyumbaFasta
        </p>
      )}
    </div>
  )
}
