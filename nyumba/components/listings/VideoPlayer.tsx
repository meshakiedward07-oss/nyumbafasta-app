'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string | null
  title?: string
  className?: string
  autoplayOnView?: boolean
  muted?: boolean
}

type VideoState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'error'

export function VideoPlayer({
  src,
  poster,
  title,
  className = '',
  autoplayOnView = false,
  muted = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>()

  const [state, setState] = useState<VideoState>('idle')
  const [progress, setProgress] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isMuted, setIsMuted] = useState(muted)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait' | 'square'>('landscape')
  const [slowConnection, setSlowConnection] = useState(false)

  // Detect slow connection
  useEffect(() => {
    const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection
    if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
      setSlowConnection(true)
    }
  }, [])

  function handleLoadedMetadata() {
    const v = videoRef.current
    if (!v) return
    const w = v.videoWidth
    const h = v.videoHeight
    if (w > h * 1.2) setOrientation('landscape')
    else if (h > w * 1.2) setOrientation('portrait')
    else setOrientation('square')
    setDuration(v.duration)
    setState('ready')
  }

  function handleTimeUpdate() {
    const v = videoRef.current
    if (!v || !v.duration) return
    setProgress((v.currentTime / v.duration) * 100)
    setCurrentTime(v.currentTime)
    if (v.buffered.length > 0) {
      setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100)
    }
  }

  const togglePlay = useCallback(async () => {
    const v = videoRef.current
    if (!v) return
    if (state === 'playing') {
      v.pause()
      setState('paused')
    } else {
      try {
        setState('loading')
        await v.play()
        setState('playing')
      } catch {
        setState('paused')
      }
    }
  }, [state])

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current
    const bar = progressRef.current
    if (!v || !bar) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.currentTime = pct * v.duration
    setProgress(pct * 100)
  }

  function toggleMute() {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setIsMuted(v.muted)
  }

  function showControlsTemporarily() {
    setShowControls(true)
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    if (state === 'playing') {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000)
    }
  }

  async function toggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {}
  }

  // Intersection Observer for autoplayOnView
  useEffect(() => {
    if (!autoplayOnView) return
    const v = videoRef.current
    if (!v) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          v.play().catch(() => {})
          setState('playing')
        } else {
          v.pause()
          setState('paused')
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(v)
    return () => observer.disconnect()
  }, [autoplayOnView])

  // Keyboard controls
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const v = videoRef.current
      if (!v || !containerRef.current?.contains(document.activeElement)) return
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay() }
      if (e.key === 'm') toggleMute()
      if (e.key === 'f') toggleFullscreen()
      if (e.key === 'ArrowRight') v.currentTime = Math.min(v.currentTime + 10, v.duration)
      if (e.key === 'ArrowLeft') v.currentTime = Math.max(v.currentTime - 10, 0)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [togglePlay])

  // Cleanup
  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
      const v = videoRef.current
      if (v) { v.pause(); v.src = ''; v.load() }
    }
  }, [])

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const containerAspect = {
    landscape: 'aspect-video',
    portrait: 'aspect-[9/16] max-w-xs mx-auto',
    square: 'aspect-square max-w-md mx-auto',
  }[orientation]

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-2xl overflow-hidden group ${containerAspect} ${className}`}
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
      onClick={togglePlay}
      tabIndex={0}
      aria-label={`Video: ${title || 'Listing'}`}
    >
      {/* Slow connection warning */}
      {slowConnection && state === 'idle' && (
        <div className="absolute top-2 left-2 right-2 z-20 bg-amber-500/90 text-white text-xs px-3 py-1.5 rounded-lg text-center pointer-events-none">
          Muunganiko wako ni polepole. Video inaweza kuchukua muda.
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        poster={poster ?? undefined}
        preload="metadata"
        playsInline
        muted={isMuted}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setState('buffering')}
        onPlaying={() => setState('playing')}
        onPause={() => { if (state === 'playing') setState('paused') }}
        onEnded={() => {
          setState('paused')
          setProgress(0)
          if (videoRef.current) videoRef.current.currentTime = 0
        }}
        onError={() => setState('error')}
      >
        <source src={src} type="video/mp4" />
        <source src={src} type="video/webm" />
        Kivinjari chako hakisaidii video.
      </video>

      {/* Buffering spinner */}
      {(state === 'buffering' || state === 'loading') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Play button overlay */}
      {(state === 'idle' || state === 'ready' || state === 'paused') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30 transition-transform group-hover:scale-110">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white ml-1 fill-current" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-3" onClick={e => e.stopPropagation()}>
          <svg viewBox="0 0 24 24" className="w-12 h-12 text-white/40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M15.75 10.5l4.72-4.72M15.75 10.5H11.25M15.75 10.5V6m-10.5 8.25l4.72 4.72M5.25 18.75H9.75M5.25 18.75V14.25" />
            <path d="M3 16.5V7.5a3 3 0 013-3h12a3 3 0 013 3v9a3 3 0 01-3 3H6a3 3 0 01-3-3z" />
          </svg>
          <p className="text-sm font-medium">Video haiwezi kuchezwa</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline text-white/50 hover:text-white/80"
            onClick={e => e.stopPropagation()}
          >
            Pakua video
          </a>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 pointer-events-none ${
          showControls || state !== 'playing' ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-4 pt-2 pointer-events-auto space-y-2">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="relative h-1 bg-white/30 rounded-full cursor-pointer group/bar hover:h-2 transition-all"
            onClick={handleSeek}
          >
            <div className="absolute inset-y-0 left-0 bg-white/40 rounded-full" style={{ width: `${buffered}%` }} />
            <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${progress}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity -ml-1.5"
              style={{ left: `${progress}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-white hover:text-white/80 transition-colors p-1"
              aria-label={state === 'playing' ? 'Simamisha' : 'Cheza'}
            >
              {state === 'playing' ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current ml-0.5" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <span className="text-white/80 text-xs font-mono tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <button
              onClick={toggleMute}
              className="text-white hover:text-white/80 transition-colors p-1"
              aria-label={isMuted ? 'Washa sauti' : 'Zima sauti'}
            >
              {isMuted ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              )}
            </button>

            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-white/80 transition-colors p-1"
              aria-label={isFullscreen ? 'Toka fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
