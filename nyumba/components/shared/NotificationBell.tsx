'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// Polling-based notification bell — no persistent WebSocket per user.
// Supabase Realtime has a hard cap on concurrent connections (10,000 on Pro).
// At scale, one realtime channel per active user would exhaust that cap
// instantly. Polling every 30 s stays within HTTP rate limits, uses CDN
// caching on the count endpoint, and degrades gracefully under load.

interface Props {
  className?: string
  /** true (default): renders as <Link>. false: renders as <span> — use inside an existing <Link> */
  asLink?: boolean
}

export default function NotificationBell({ className = '', asLink = true }: Props) {
  const [unread, setUnread] = useState(0)

  const fetchCount = useCallback(() => {
    fetch('/api/v1/notifications?count=true')
      .then(r => r.ok ? r.json() : { unread_count: 0 })
      .then(d => setUnread(d.unread_count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCount()

    // Re-fetch when tab becomes visible (handles background-tab resumption)
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchCount() }
    const onFocus = () => fetchCount()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    // 30-second poll — frequent enough to feel responsive, light enough for scale
    const timer = setInterval(fetchCount, 30_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      clearInterval(timer)
    }
  }, [fetchCount])

  const inner = (
    <>
      <i className="ti ti-bell text-xl" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white
                         text-[10px] font-bold rounded-full flex items-center justify-center px-0.5
                         animate-bounce">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </>
  )

  if (!asLink) {
    return (
      <span className={`relative inline-flex items-center justify-center ${className}`}>
        {inner}
      </span>
    )
  }

  return (
    <Link href="/notifications" aria-label={`Arifa${unread > 0 ? ` (${unread} mpya)` : ''}`} className={`relative inline-flex items-center justify-center ${className}`}>
      {inner}
    </Link>
  )
}
