'use client'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { getOrCreateSessionId } from '@/lib/ads/session'

type Ad = {
  id: string; title: string; body_text: string | null; image_url: string | null
  cta_type: string; cta_value: string
  advertiser: { business_name: string; logo_url: string | null } | null
}

const FALLBACK_REGION = 'Dar es Salaam'

export default function BannerAd({ region }: { region?: string }) {
  const [ad, setAd] = useState<Ad | null>(null)

  useEffect(() => {
    const sid = getOrCreateSessionId()
    // Prefer prop → localStorage pref → popular default
    const r = region
      || (typeof window !== 'undefined' && localStorage.getItem('nf_region'))
      || FALLBACK_REGION
    const p = new URLSearchParams({ region: r, sid, type: 'banner', placement: 'banner', limit: '1' })
    fetch(`/api/v1/ads/ranked?${p}`)
      .then(r => r.json())
      .then(d => setAd(d.ads?.[0] ?? null))
      .catch(() => {})
  }, [region])

  if (!ad) return null

  const href =
    ad.cta_type === 'whatsapp' ? `https://wa.me/${ad.cta_value}` :
    ad.cta_type === 'call'     ? `tel:${ad.cta_value}` :
    ad.cta_value

  return (
    <a
      href={href}
      target={ad.cta_type === 'website' ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="block mx-4 mb-3 rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition bg-white"
    >
      {ad.image_url && (
        <div className="relative w-full h-28">
          <Image
            src={ad.image_url} alt={ad.title}
            fill className="object-cover" sizes="(max-width: 768px) 100vw, 600px"
          />
        </div>
      )}
      <div className="px-3 py-2 flex items-center gap-3">
        {ad.advertiser?.logo_url && (
          <Image
            src={ad.advertiser.logo_url} alt={ad.advertiser.business_name}
            width={32} height={32} className="rounded-lg flex-shrink-0 object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-800 text-sm truncate">{ad.title}</div>
          {ad.body_text && <div className="text-xs text-gray-500 truncate">{ad.body_text}</div>}
        </div>
        <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded flex-shrink-0">
          Tangazo
        </span>
      </div>
    </a>
  )
}
