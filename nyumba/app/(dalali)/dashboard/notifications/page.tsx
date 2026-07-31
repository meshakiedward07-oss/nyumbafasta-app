'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const TYPE_META: Record<string, { icon: string; color: string; href?: (refId: string | null) => string }> = {
  new_lead:                { icon: 'ti-phone-incoming', color: 'text-green-500 bg-green-50',  href: () => '/dashboard/leads' },
  listing_expired:         { icon: 'ti-clock-x',        color: 'text-red-500 bg-red-50',       href: (id) => id ? `/dashboard/listings?renew=${id}` : '/dashboard/listings' },
  listing_expiry_soon:     { icon: 'ti-clock',          color: 'text-orange-500 bg-orange-50', href: (id) => id ? `/dashboard/listings?renew=${id}` : '/dashboard/listings' },
  subscription_expired:    { icon: 'ti-credit-card-off',color: 'text-red-500 bg-red-50',       href: () => '/dashboard/subscription' },
  subscription_expiring_soon: { icon: 'ti-credit-card', color: 'text-amber-500 bg-amber-50',  href: () => '/dashboard/subscription' },
  subscription_expiring_7days:{ icon: 'ti-credit-card', color: 'text-amber-400 bg-amber-50',  href: () => '/dashboard/subscription' },
  review_received:         { icon: 'ti-star',           color: 'text-yellow-500 bg-yellow-50', href: () => '/dashboard/reviews' },
  listing_approved:        { icon: 'ti-circle-check',   color: 'text-green-500 bg-green-50',   href: (id) => id ? `/listings/${id}` : '/dashboard/listings' },
  listing_rejected:        { icon: 'ti-circle-x',       color: 'text-red-500 bg-red-50',       href: () => '/dashboard/listings' },
  verification_approved:   { icon: 'ti-shield-check',   color: 'text-green-500 bg-green-50',   href: () => '/dashboard/profile' },
  verification_rejected:   { icon: 'ti-shield-x',       color: 'text-red-500 bg-red-50',       href: () => '/dashboard/verify' },
  boost_expired:           { icon: 'ti-rocket-off',     color: 'text-gray-500 bg-gray-50',     href: (id) => id ? `/dashboard/listings?boost=${id}` : '/dashboard/listings' },
  payment_received:        { icon: 'ti-cash',           color: 'text-green-500 bg-green-50',   href: () => '/dashboard/hesabu' },
  info:                    { icon: 'ti-info-circle',    color: 'text-blue-500 bg-blue-50' },
}

function timeSince(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return 'sasa hivi'
  if (diff < 3600) return `dakika ${Math.floor(diff / 60)} zilizopita`
  if (diff < 86400) return `saa ${Math.floor(diff / 3600)} zilizopita`
  const days = Math.floor(diff / 86400)
  if (days === 1)  return 'jana'
  if (days < 7)   return `siku ${days} zilizopita`
  if (days < 30)  return `wiki ${Math.floor(days / 7)} zilizopita`
  return `mwezi ${Math.floor(days / 30)} uliopita`
}

function groupLabel(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 86400)       return 'Leo'
  if (diff < 2 * 86400)  return 'Jana'
  if (diff < 7 * 86400)  return 'Wiki hii'
  if (diff < 30 * 86400) return 'Mwezi huu'
  return 'Zamani'
}

interface Notif {
  id: string; title: string; body: string; type: string
  is_read: boolean; ref_id: string | null; created_at: string
}

export default function NotificationsPage() {
  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/notifications')
      const json = await res.json()
      setNotifs(json.notifications ?? [])
      // Mark all read after viewing
      await fetch('/api/v1/notifications', { method: 'PATCH' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Group by day bucket
  const groups: { label: string; items: Notif[] }[] = []
  for (const n of notifs) {
    const label = groupLabel(n.created_at)
    const last  = groups[groups.length - 1]
    if (last?.label === label) last.items.push(n)
    else groups.push({ label, items: [n] })
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-10 pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <i className="ti ti-arrow-left text-lg" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Arifa</h1>
            <p className="text-xs text-gray-400">{notifs.filter(n => !n.is_read).length > 0 ? `${notifs.filter(n => !n.is_read).length} mpya` : 'Zote zimesomwa'}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <i className="ti ti-bell-off text-3xl text-gray-300" />
          </div>
          <p className="font-semibold text-gray-700">Hakuna arifa bado</p>
          <p className="text-sm text-gray-400 mt-1">Arifa mpya zitaonekana hapa</p>
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">{group.label}</p>
              <div className="space-y-1.5">
                {group.items.map(n => {
                  const meta = TYPE_META[n.type] ?? TYPE_META['info']
                  const href = meta.href?.(n.ref_id)
                  const Inner = (
                    <div className={`flex gap-3 bg-white rounded-2xl p-3.5 border transition-colors ${!n.is_read ? 'border-primary-100 bg-primary-50/30' : 'border-gray-100'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                        <i className={`ti ${meta.icon} text-lg`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                          {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-1 flex-shrink-0" />}
                        </div>
                        {n.body && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>}
                        <p className="text-[11px] text-gray-400 mt-1">{timeSince(n.created_at)}</p>
                      </div>
                    </div>
                  )
                  return href ? (
                    <Link key={n.id} href={href}>{Inner}</Link>
                  ) : (
                    <div key={n.id}>{Inner}</div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
