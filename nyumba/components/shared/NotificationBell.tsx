'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

interface Props {
  className?: string
  /** true (default): renders as <Link>. false: renders as <span> — use inside an existing <Link> */
  asLink?: boolean
}

export default function NotificationBell({ className = '', asLink = true }: Props) {
  const [unread, setUnread] = useState(0)
  const lastFetched = useRef(0)

  const fetchCount = useCallback(() => {
    lastFetched.current = Date.now()
    fetch('/api/v1/notifications?count=true')
      .then(r => r.ok ? r.json() : { unread_count: 0 })
      .then(d => setUnread(d.unread_count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCount()

    // Skip re-fetch on focus/visibility if a fetch happened within the last 25s
    // (prevents burst when the polling interval fires near the same time as a tab focus)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetched.current >= 25_000) fetchCount()
    }
    const onFocus = () => { if (Date.now() - lastFetched.current >= 25_000) fetchCount() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

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
