'use client'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { getOrCreateSessionId } from '@/lib/ads/session'

type Ad = {
  id: string; title: string; body_text: string | null; image_url: string | null
  cta_type: string; cta_value: string
  advertiser: { business_name: string; business_category: string; logo_url: string | null } | null
}

export default function NearbyAds({ region }: { region: string }) {
  const [ads, setAds] = useState<Ad[]>([])

  useEffect(() => {
    if (!region) return
    const sid = getOrCreateSessionId()
    const p   = new URLSearchParams({
      region, sid, type: 'nearby', placement: 'nearby', limit: '6',
    })
    fetch(`/api/v1/ads/ranked?${p}`)
      .then(r => r.json())
      .then(d => setAds(d.ads ?? []))
      .catch(() => {})
  }, [region])

  if (!ads.length) return null

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold px-4 mb-2">
        Biashara Karibu Nawe
      </p>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
        {ads.map(ad => {
          const href =
            ad.cta_type === 'whatsapp' ? `https://wa.me/${ad.cta_value}` :
            ad.cta_type === 'call'     ? `tel:${ad.cta_value}` :
            ad.cta_value

          return (
            <a
              key={ad.id}
              href={href}
              target={ad.cta_type === 'website' ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="flex-shrink-0 w-36 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition"
            >
              {/* nearby_url variant (300×200) is served by ranked endpoint */}
              <div className="relative h-20 w-full bg-gray-100">
                {ad.image_url ? (
                  <Image
                    src={ad.image_url} alt={ad.title}
                    fill className="object-cover" sizes="144px"
                  />
                ) : ad.advertiser?.logo_url ? (
                  <Image
                    src={ad.advertiser.logo_url} alt={ad.advertiser.business_name}
                    fill className="object-cover" sizes="144px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🏪</div>
                )}
              </div>
              <div className="p-2">
                <div className="text-xs font-bold text-gray-800 truncate">{ad.title}</div>
                {ad.advertiser && (
                  <div className="text-[10px] text-gray-400 truncate">
                    {ad.advertiser.business_category}
                  </div>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
