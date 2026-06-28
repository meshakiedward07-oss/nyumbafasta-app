'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { VideoPlayer } from './VideoPlayer'

interface LazyVideoPlayerProps {
  src: string
  poster?: string | null
  title?: string
  className?: string
}

export function LazyVideoPlayer({ src, poster, title, className }: LazyVideoPlayerProps) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true)
          observer.unobserve(el)
        }
      },
      { rootMargin: '200px', threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapperRef} className={className}>
      {shouldLoad ? (
        <VideoPlayer src={src} poster={poster} title={title} />
      ) : (
        <div className="aspect-video bg-gray-900 rounded-2xl flex items-center justify-center relative overflow-hidden">
          {poster && (
            <Image fill src={poster} alt={title || ''} className="object-cover opacity-60" sizes="(max-width: 768px) 100vw, 50vw" />
          )}
          <div className="relative z-10 w-14 h-14 bg-black/50 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white ml-1 fill-current" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}

export default LazyVideoPlayer
