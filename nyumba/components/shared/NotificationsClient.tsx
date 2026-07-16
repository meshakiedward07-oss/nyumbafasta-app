'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Notification } from '@/lib/types/database'
import BottomNav from '@/components/shared/BottomNav'
import DalaliBottomNav from '@/components/shared/DalaliBottomNav'
import ReviewForm from '@/components/listings/ReviewForm'
import { createClient } from '@/lib/supabase/client'

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  listing_approved:        { icon: 'circle-check', color: 'bg-primary-50 border-primary-100' },
  listing_rejected:        { icon: 'circle-x', color: 'bg-red-50 border-red-100' },
  listing_expired:         { icon: 'circle-x', color: 'bg-red-50 border-red-100' },
  listing_expiring_14days: { icon: 'clock', color: 'bg-yellow-50 border-yellow-100' },
  listing_expiring_7days:  { icon: 'alert-triangle', color: 'bg-orange-50 border-orange-100' },
  listing_expiring_today:  { icon: 'circle-dot', color: 'bg-red-50 border-red-100' },
  new_lead:                { icon: 'phone', color: 'bg-blue-50 border-blue-100' },
  subscription_active:     { icon: 'star-filled', color: 'bg-amber-50 border-amber-100' },
  review_request:          { icon: 'star-filled', color: 'bg-amber-50 border-amber-100' },
  review_reminder:         { icon: 'bell', color: 'bg-orange-50 border-orange-100' },
  new_review:              { icon: 'star-filled', color: 'bg-amber-50 border-amber-100' },
  review_reply:            { icon: 'message-circle', color: 'bg-primary-50 border-primary-100' },
  boost_activated:         { icon: 'rocket', color: 'bg-yellow-50 border-yellow-100' },
  listing_taken:           { icon: 'home', color: 'bg-gray-50 border-gray-100' },
  trial_started:           { icon: 'gift', color: 'bg-primary-50 border-primary-100' },
  trial_reminder_7days:    { icon: 'clock', color: 'bg-yellow-50 border-yellow-100' },
  trial_reminder_3days:    { icon: 'alert-triangle', color: 'bg-orange-50 border-orange-100' },
  trial_reminder_last_day: { icon: 'circle-dot', color: 'bg-red-50 border-red-100' },
  admin_alert:             { icon: 'alert-circle', color: 'bg-red-50 border-red-100' },
  default:                 { icon: 'bell', color: 'bg-gray-50 border-gray-100' },
}

function groupByDate(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {}
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  notifications.forEach(n => {
    const d = new Date(n.created_at)
    let label: string
    if (d.toDateString() === today.toDateString())     label = 'Leo'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Jana'
    else label = d.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(n)
  })
  return groups
}

type ReviewNotifData = {
  unlock_id: string
  listing_id?: string
  dalali_id?: string
}

type Props = {
  notifications: Notification[]
  role: string
}

export default function NotificationsClient({ notifications, role }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeReview, setActiveReview] = useState<ReviewNotifData & { notifId: string } | null>(null)
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [reviewDalaliName, setReviewDalaliName] = useState('Dalali')

  useEffect(() => {
    if (!activeReview?.dalali_id) { setReviewDalaliName('Dalali'); return }
    supabase.from('users').select('full_name').eq('id', activeReview.dalali_id).single()
      .then(({ data }) => { if (data?.full_name) setReviewDalaliName(data.full_name) })
  }, [activeReview?.dalali_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mark all as read on mount
  useEffect(() => {
    if (notifications.some(n => !n.is_read)) {
      fetch('/api/v1/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .catch(() => {})
    }
  }, [notifications])

  const groups = groupByDate(notifications)
  const isReviewType = (type: string) => type === 'review_request' || type === 'review_reminder'

  function handleNotifTap(n: Notification) {
    if (isReviewType(n.type) && !reviewed.has(n.id)) {
      if (n.ref_id) {
        setActiveReview({ unlock_id: n.ref_id, notifId: n.id })
      }
      return
    }
    // Navigate to the relevant page for action-type notifications
    if (n.ref_id) {
      if (n.type === 'listing_approved' || n.type === 'listing_rejected' || n.type === 'listing_taken') {
        router.push('/dashboard/listings')
      } else if (n.type === 'listing_expired' || n.type === 'listing_expiring_7days' ||
                 n.type === 'listing_expiring_14days' || n.type === 'listing_expiring_today') {
        router.push(`/dashboard/listings?renew=${n.ref_id}`)
      } else if (n.type === 'new_lead') {
        router.push(`/dashboard/crm`)
      } else if (n.type === 'new_review') {
        router.push(`/dashboard/reviews`)
      } else if (n.type === 'boost_activated') {
        router.push(`/listings/${n.ref_id}`)
      } else if (n.type === 'subscription_active') {
        router.push(`/dashboard/subscription`)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-fadeIn">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-90 transition-transform">
          ←
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1">Arifa</h1>
        {notifications.some(n => !n.is_read) && (
          <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
            {notifications.filter(n => !n.is_read).length} mpya
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <i className="ti ti-bell text-5xl text-gray-300 mb-4" aria-hidden="true" />
          <p className="text-gray-600 font-medium mb-1">Hakuna arifa bado</p>
          <p className="text-gray-400 text-sm">Arifa zitaonekana hapa wakati zinatokea</p>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-6">
          {Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide" suppressHydrationWarning>{label}</p>
              <div className="space-y-2">
                {items.map(n => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.default
                  const isReview = isReviewType(n.type)
                  const alreadyReviewed = reviewed.has(n.id)
                  const isTappable = isReview ? !alreadyReviewed : !!n.ref_id
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotifTap(n)}
                      className={`w-full text-left rounded-2xl border p-4 flex gap-3 transition-all
                        ${cfg.color}
                        ${!n.is_read && !alreadyReviewed ? 'shadow-sm' : 'opacity-70'}
                        ${isTappable ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}
                      `}
                    >
                      <i className={`ti ti-${cfg.icon} text-2xl flex-shrink-0 mt-0.5`} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-snug mb-0.5">{n.title}</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{n.body}</p>
                        {isReview && !alreadyReviewed && (
                          <span className="inline-block mt-2 text-xs bg-amber-400 text-white font-semibold px-3 py-1 rounded-full">
                            Toa Maoni →
                          </span>
                        )}
                        {alreadyReviewed && (
                          <span className="inline-block mt-2 text-xs text-primary-600 font-medium">
                            <i className="ti ti-circle-check" aria-hidden="true" /> Maoni yametolewa
                          </span>
                        )}
                        {(n.type === 'listing_expired' || n.type === 'listing_expiring_7days' || n.type === 'listing_expiring_today') && n.ref_id && (
                          <span className="inline-block mt-2 text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg font-medium">
                            <i className="ti ti-refresh" aria-hidden="true" /> Huisha Sasa →
                          </span>
                        )}
                        <p className="text-xs text-gray-400 mt-1.5" suppressHydrationWarning>
                          {new Date(n.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!n.is_read && !alreadyReviewed && (
                        <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {role === 'dalali' ? <DalaliBottomNav /> : <BottomNav role={role} />}

      {/* Review modal — inafunguka kwa click ya review_request notification */}
      {activeReview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setActiveReview(null)}>
          <div className="bg-gray-50 w-full rounded-t-3xl max-h-[85vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-4 mb-2" />
            <div className="px-4 pb-10">
              <ReviewForm
                unlockId={activeReview.unlock_id}
                dalaliName={reviewDalaliName}
                onSubmitted={() => {
                  setReviewed(prev => new Set(prev).add(activeReview.notifId))
                  setActiveReview(null)
                }}
                onDismiss={() => setActiveReview(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
