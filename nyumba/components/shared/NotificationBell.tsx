'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props {
  className?: string
  /** true (default): renders as <Link>. false: renders as <span> — use inside an existing <Link> */
  asLink?: boolean
}

export default function NotificationBell({ className = '', asLink = true }: Props) {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetch('/api/v1/notifications?count=true')
      .then(r => r.ok ? r.json() : { unread_count: 0 })
      .then(d => setUnread(d.unread_count ?? 0))
      .catch(() => {})
  }, [])

  const inner = (
    <>
      <span className="text-xl">🔔</span>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white
                         text-[10px] font-bold rounded-full flex items-center justify-center px-0.5
                         animate-fadeIn">
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
    <Link href="/notifications" className={`relative inline-flex items-center justify-center ${className}`}>
      {inner}
    </Link>
  )
}
