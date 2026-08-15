'use client'
import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

type SortOrder = 'recent' | 'highest' | 'helpful'

type ReviewItem = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  is_verified?: boolean
  helpful_count?: number
  response?: string | null
  response_at?: string | null
  reviewer: { full_name: string } | null
}

type Props = {
  reviews: ReviewItem[]
  ratingAvg: number
  ratingCount: number
}

function timeAgo(dateStr: string, t: (k: TKey) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return t('lst_ago_today').toLowerCase()
  if (days === 1) return t('lst_ago_yesterday').toLowerCase()
  if (days < 30) return t('lst_ago_days').replace('{{n}}', String(days)).toLowerCase()
  if (days < 60) return t('lst_ago_1month').toLowerCase()
  return t('lst_ago_months').replace('{{n}}', String(Math.floor(days / 30))).toLowerCase()
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm'
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Nyota ${rating} kati ya 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <i
          key={i}
          className={`${i <= rating ? 'ti ti-star-filled text-amber-400' : 'ti ti-star text-gray-200'} ${sizeClass}`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

export default function ReviewList({ reviews, ratingAvg, ratingCount }: Props) {
  const { t } = useLanguage()
  const [sort, setSort] = useState<SortOrder>('recent')
  const [helpfulVoted, setHelpfulVoted] = useState<Set<string>>(new Set())
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>(
    Object.fromEntries(reviews.map(r => [r.id, r.helpful_count ?? 0]))
  )

  if (ratingCount === 0) return null

  const sorted = [...reviews].sort((a, b) => {
    if (sort === 'highest') return b.rating - a.rating
    if (sort === 'helpful') return (helpfulCounts[b.id] ?? 0) - (helpfulCounts[a.id] ?? 0)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  async function handleHelpful(reviewId: string) {
    if (helpfulVoted.has(reviewId)) return
    setHelpfulVoted(prev => new Set(prev).add(reviewId))
    setHelpfulCounts(prev => ({ ...prev, [reviewId]: (prev[reviewId] ?? 0) + 1 }))
    fetch(`/api/v1/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'helpful' }),
    }).catch(() => {})
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">

      {/* ── Header: overall score ── */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-4">
        <div className="flex items-center gap-5">
          {/* Big score */}
          <div className="text-center flex-shrink-0">
            <p className="text-5xl font-extrabold text-white leading-none">{ratingAvg.toFixed(1)}</p>
            <Stars rating={Math.round(ratingAvg)} size="sm" />
            <p className="text-amber-100 text-xs mt-1">{ratingCount} maoni</p>
          </div>

          {/* Distribution bars */}
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map(star => {
              const count = reviews.filter(r => r.rating === star).length
              const pct   = reviews.length > 0 ? (count / reviews.length) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-white/80 w-3 flex-shrink-0 font-medium">{star}</span>
                  <i className="ti ti-star-filled text-white/70 text-[10px] flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 bg-white/25 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-white h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/70 w-4 text-right flex-shrink-0">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white">
        {/* ── Sort tabs ── */}
        <div className="px-4 pt-3 pb-0">
          <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
            {([
              { key: 'recent',  label: t('cl_sort_recent')  },
              { key: 'highest', label: t('cl_sort_highest') },
              { key: 'helpful', label: t('cl_sort_helpful') },
            ] as { key: SortOrder; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setSort(key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  sort === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Review items ── */}
        <div className="divide-y divide-gray-50">
          {sorted.map(review => {
            const hCount = helpfulCounts[review.id] ?? 0
            const voted  = helpfulVoted.has(review.id)
            return (
              <div key={review.id} className="px-4 pt-4 pb-4">
                {/* Reviewer row */}
                <div className="flex items-start gap-3 mb-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold flex-shrink-0">
                    {review.reviewer?.full_name?.[0]?.toUpperCase() ?? 'W'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-gray-800">
                        {review.reviewer?.full_name ?? t('cl_customer')}
                      </span>
                      {review.is_verified && (
                        <span className="text-xs bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <i className="ti ti-circle-check text-[10px]" aria-hidden="true" /> {t('lst_verified')}
                        </span>
                      )}
                    </div>
                    {/* Stars + date */}
                    <div className="flex items-center gap-2">
                      <Stars rating={review.rating} size="sm" />
                      <span className="text-xs text-gray-400" suppressHydrationWarning>
                        · {timeAgo(review.created_at, t)}
                      </span>
                    </div>
                  </div>

                  {/* Rating number */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{
                      background: review.rating >= 4 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : review.rating === 3 ? '#f3f4f6' : '#fee2e2',
                      color: review.rating >= 4 ? '#fff' : review.rating === 3 ? '#6b7280' : '#ef4444',
                    }}
                  >
                    {review.rating}
                  </div>
                </div>

                {/* Comment */}
                {review.comment && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-3 pl-12 italic">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}

                {/* Helpful + dalali reply */}
                <div className="pl-12 space-y-2">
                  <button
                    onClick={() => handleHelpful(review.id)}
                    disabled={voted}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
                      voted
                        ? 'bg-primary-50 text-primary-600 font-medium border border-primary-200'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100 border border-transparent active:scale-95'
                    }`}
                  >
                    <i className="ti ti-thumb-up" aria-hidden="true" />
                    <span>{voted ? t('cl_voted') : t('cl_was_helpful')}</span>
                    {hCount > 0 && <span className="font-semibold">({hCount})</span>}
                  </button>

                  {review.response && (
                    <div className="bg-primary-50 rounded-xl px-3 py-2.5 border-l-2 border-primary-400">
                      <p className="text-xs font-semibold text-primary-700 mb-1 flex items-center gap-1">
                        <i className="ti ti-message-circle" aria-hidden="true" /> {t('cl_agent_reply')}
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed">{review.response}</p>
                      {review.response_at && (
                        <p className="text-xs text-gray-400 mt-1" suppressHydrationWarning>
                          {timeAgo(review.response_at, t)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
