'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Props {
  className?: string
  /** true (default): renders as <Link>. false: renders as <span> — use inside an existing <Link> */
  asLink?: boolean
}

export default function NotificationBell({ className = '', asLink = true }: Props) {
  const [unread, setUnread] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef  = useRef<any>(null)

  const fetchCount = useCallback(() => {
    fetch('/api/v1/notifications?count=true')
      .then(r => r.ok ? r.json() : { unread_count: 0 })
      .then(d => setUnread(d.unread_count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    // 1. Initial fetch
    fetchCount()

    // 2. Poll every 30 seconds (backup — always works)
    intervalRef.current = setInterval(fetchCount, 30_000)

    // 3. Refresh when tab regains focus
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchCount()
    }
    const onFocus = () => fetchCount()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    // 4. Supabase realtime — instant updates on INSERT to notifications
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = supabase.channel('notif-bell') as any
      ch.on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          setUnread(prev => prev + 1)
          if ('vibrate' in navigator) navigator.vibrate(200)
        }
      ).subscribe()
      channelRef.current = ch
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      if (channelRef.current) {
        createClient().removeChannel(channelRef.current)
      }
    }
  }, [fetchCount])

  const inner = (
    <>
      <span className="text-xl">🔔</span>
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
    <Link href="/notifications" className={`relative inline-flex items-center justify-center ${className}`}>
      {inner}
    </Link>
  )
}
