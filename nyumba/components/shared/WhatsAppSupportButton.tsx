'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

const HIDDEN_PREFIXES = ['/admin', '/staff-login', '/fundi']

export default function WhatsAppSupportButton() {
  const [pressed, setPressed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null

  const supportNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '255665831694'
  const whatsappUrl = `https://wa.me/${supportNumber}?text=${encodeURIComponent('Habari! Ninahitaji msaada na NyumbaFasta.')}`

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Msaada wa NyumbaFasta"
      title="Msaada wa Wateja"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`
        fixed bottom-20 right-3 z-50
        w-10 h-10 rounded-full
        flex items-center justify-center
        bg-[#1D9E75] shadow-md shadow-black/20
        transition-transform duration-150
        ${pressed ? 'scale-90' : 'scale-100 hover:scale-110'}
      `}
    >
      {/* Subtle pulse — small ring, not full-size */}
      <span className="absolute w-full h-full rounded-full bg-[#1D9E75] opacity-40 motion-safe:animate-ping" />

      {/* Headset / customer care icon */}
      <span className="relative flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
          {/* Headset with mic icon */}
          <path d="M12 1C7.03 1 3 5.03 3 10v3a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H5.07A7.002 7.002 0 0 1 12 3a7.002 7.002 0 0 1 6.93 7H17a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v1a2 2 0 0 1-2 2h-2.1a2 2 0 1 0 0 2H16a4 4 0 0 0 4-4v-6c0-4.97-4.03-9-8-9z"/>
        </svg>
      </span>

      {/* Tiny WhatsApp badge in bottom-right corner */}
      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#25D366] border-2 border-white flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </span>
    </a>
  )
}
