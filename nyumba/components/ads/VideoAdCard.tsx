'use client'
import { useEffect, useState, useRef } from 'react'

type Ad = {
  id: string; title: string; body_text: string | null; video_url: string | null
  image_url: string | null; cta_type: string; cta_value: string
  advertiser: { business_name: string; logo_url: string | null } | null
}

export default function VideoAdCard({ region }: { region?: string }) {
  const [ad, setAd] = useState<Ad | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const url = `/api/v1/ads?type=video${region ? `&region=${encodeURIComponent(region)}` : ''}&limit=1`
    fetch(url).then(r => r.json()).then(d => setAd(d.ads?.[0] ?? null)).catch(() => {})
  }, [region])

  if (!ad?.video_url) return null

  const href = ad.cta_type === 'whatsapp' ? `https://wa.me/${ad.cta_value}`
    : ad.cta_type === 'call' ? `tel:${ad.cta_value}` : ad.cta_value

  return (
    <div className="mx-4 my-3 bg-gray-900 rounded-2xl overflow-hidden shadow-md">
      <div className="relative">
        <video
          ref={videoRef}
          src={ad.video_url}
          poster={ad.image_url ?? undefined}
          className="w-full max-h-56 object-cover"
          autoPlay muted loop playsInline
        />
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
          Tangazo
        </div>
      </div>
      <div className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">{ad.title}</div>
          {ad.body_text && <div className="text-xs text-gray-300 truncate">{ad.body_text}</div>}
        </div>
        <a
          href={href}
          target={ad.cta_type === 'website' ? '_blank' : undefined}
          rel="noopener noreferrer"
          className="flex-shrink-0 bg-primary-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-primary-600 transition whitespace-nowrap"
        >
          {ad.cta_type === 'whatsapp' ? '💬 Wasiliana'
            : ad.cta_type === 'call' ? '📞 Piga Simu'
            : '🌐 Tovuti'}
        </a>
      </div>
    </div>
  )
}
