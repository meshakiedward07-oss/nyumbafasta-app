import Image from 'next/image'

const PLATFORM_LOGOS: Record<string, string> = {
  instagram: '/platforms/instagram.svg',
  facebook:  '/platforms/facebook.svg',
  tiktok:    '/platforms/tiktok.svg',
  whatsapp:  '/platforms/whatsapp.svg',
}

interface PlatformLogoProps {
  platform: string
  size?: number
  className?: string
}

export function PlatformLogo({ platform, size = 20, className = '' }: PlatformLogoProps) {
  const src = PLATFORM_LOGOS[platform.toLowerCase()]
  if (!src) return null
  return (
    <Image
      src={src}
      alt={platform}
      width={size}
      height={size}
      className={`rounded-sm flex-shrink-0 ${className}`}
      unoptimized
    />
  )
}
