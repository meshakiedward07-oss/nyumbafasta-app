'use client'

import { useState, useRef } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string
  className?: string
}

type Orientation = 'landscape' | 'portrait' | 'square' | 'unknown'

export function VideoPlayer({ src, poster, className = '' }: VideoPlayerProps) {
  const [orientation, setOrientation] = useState<Orientation>('unknown')
  const [loaded, setLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleLoadedMetadata() {
    const video = videoRef.current
    if (!video) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (w > h) setOrientation('landscape')
    else if (h > w) setOrientation('portrait')
    else setOrientation('square')
    setLoaded(true)
  }

  // Container sizing: portrait videos get capped at 320px wide and centred
  const containerStyle: React.CSSProperties =
    orientation === 'portrait'
      ? { aspectRatio: '9/16', maxWidth: '320px' }
      : orientation === 'square'
      ? { aspectRatio: '1/1', maxWidth: '480px' }
      : { aspectRatio: '16/9' }

  return (
    <div className={`flex justify-center w-full ${className}`}>
      <div
        className="relative bg-black rounded-2xl overflow-hidden w-full"
        style={containerStyle}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <span className="text-4xl text-gray-600">🎥</span>
          </div>
        )}
        <video
          ref={videoRef}
          key={src}
          src={src}
          poster={poster}
          controls
          preload="metadata"
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'contain' }}
        />
      </div>
    </div>
  )
}
