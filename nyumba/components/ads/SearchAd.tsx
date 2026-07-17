'use client'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { getOrCreateSessionId } from '@/lib/ads/session'

type Ad = {
  id: string; title: string; body_text: string | null; image_url: string | null
  cta_type: string; cta_value: string
  advertiser: { business_name: string; logo_url: string | null; whatsapp_number: string | null } | null
}

const FALLBACK_REGION = 'Dar es Salaam'

export default function SearchAd({ region, category }: { region?: string; category?: string }) {
  const [ad, setAd] = useState<Ad | null>(null)

  useEffect(() => {
    const sid = getOrCreateSessionId()
    const r   = region
      || (typeof window !== 'undefined' && localStorage.getItem('nf_region'))
      || FALLBACK_REGION
    const p = new URLSearchParams({
      region: r, sid, type: 'search', placement: 'search', limit: '1',
    })
    if (category) p.set('category', category)
    fetch(`/api/v1/ads/ranked?${p}`)
      .then(r => r.json())
      .then(d => setAd(d.ads?.[0] ?? null))
      .catch(() => {})
  }, [region, category])

  if (!ad) return null

  const waNumber = (ad.cta_type === 'whatsapp' && ad.cta_value)
    ? ad.cta_value
    : ad.advertiser?.whatsapp_number
  const href = waNumber
    ? `https://wa.me/${waNumber.replace(/\D/g, '')}`
    : ad.cta_type === 'call' ? `tel:${ad.cta_value}` : (ad.cta_value || '#')

  return (
    <a
      href={href}
      target={ad.cta_type === 'website' ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="flex items-center gap-3 mx-4 my-2 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition"
    >
      {ad.image_url ? (
        <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={ad.image_url} alt={ad.title}
            fill className="object-cover" sizes="40px"
          />
        </div>
      ) : ad.advertiser?.logo_url ? (
        <Image
          src={ad.advertiser.logo_url} alt={ad.advertiser.business_name}
          width={40} height={40} className="rounded-lg flex-shrink-0 object-cover"
        />
      ) : (
        <div className="w-10 h-10 bg-amber-200 rounded-lg flex-shrink-0 flex items-center justify-center text-amber-600 font-bold text-sm">
          Ad
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-800 text-sm truncate">{ad.title}</div>
        {ad.body_text && <div className="text-xs text-gray-600 truncate">{ad.body_text}</div>}
        {ad.advertiser && (
          <div className="text-xs text-amber-600 font-medium">{ad.advertiser.business_name}</div>
        )}
      </div>
      <div className="flex-shrink-0">
        {ad.cta_type === 'whatsapp' && (
          <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-lg">
            WhatsApp
          </span>
        )}
        {ad.cta_type === 'call' && (
          <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded-lg">
            Piga Simu
          </span>
        )}
        {ad.cta_type === 'website' && (
          <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded-lg">
            Tovuti
          </span>
        )}
      </div>
    </a>
  )
}
