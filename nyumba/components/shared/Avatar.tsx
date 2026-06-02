'use client'
import Image from 'next/image'

interface Props {
  src?: string | null
  name: string
  size?: number        // px — default 40
  className?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (parts[0][0] ?? 'D').toUpperCase()
}

export default function Avatar({ src, name, size = 40, className = '' }: Props) {
  const style = { width: size, height: size, minWidth: size, minHeight: size }

  if (src) {
    return (
      <div
        className={`rounded-full overflow-hidden bg-primary-100 flex-shrink-0 ${className}`}
        style={style}
      >
        <Image
          src={src}
          alt={name}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    )
  }

  const fontSize = size <= 28 ? 10 : size <= 40 ? 13 : size <= 56 ? 17 : 22

  return (
    <div
      className={`rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ ...style, fontSize }}
    >
      <span className="text-white font-bold leading-none">{initials(name)}</span>
    </div>
  )
}
