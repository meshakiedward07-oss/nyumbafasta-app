'use client'
import { useState } from 'react'

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'leo'
  if (days === 1) return 'jana'
  if (days < 7) return `siku ${days} zilizopita`
  if (days < 30) return `wiki ${Math.floor(days / 7)} zilizopita`
  if (days < 365) return `mwezi ${Math.floor(days / 30)} uliopita`
  return `mwaka ${Math.floor(days / 365)} uliopita`
}

export default function ReviewList({ reviews, ratingAvg, ratingCount }: Props) {
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">⭐ Maoni ya Wateja</h3>
          <div className="flex items-center gap-1">
            <span className="text-amber-400 text-base">★</span>
            <span className="font-bold text-gray-900 text-sm">{ratingAvg.toFixed(1)}</span>
            <span className="text-xs text-gray-400">({ratingCount})</span>
          </div>
        </div>

        {/* Star distribution bars */}
        <div className="space-y-1.5 mb-3">
          {[5, 4, 3, 2, 1].map(star => {
            const count = reviews.filter(r => r.rating === star).length
            const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-3 flex-shrink-0">{star}</span>
                <span className="text-amber-400 text-xs flex-shrink-0">★</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">{count}</span>
              </div>
            )
          })}
        </div>

        {/* Sort tabs */}
        <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
          {([
            { key: 'recent',  label: 'Hivi karibuni' },
            { key: 'highest', label: '⭐ Juu zaidi' },
            { key: 'helpful', label: '👍 Msaada' },
          ] as { key: SortOrder; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setSort(key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sort === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Review items */}
      <div className="divide-y divide-gray-50">
        {sorted.map(review => {
          const hCount = helpfulCounts[review.id] ?? 0
          const voted  = helpfulVoted.has(review.id)
          return (
            <div key={review.id} className="px-4 py-4">
              {/* Reviewer */}
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center
                                text-primary-700 text-xs font-bold flex-shrink-0">
                  {review.reviewer?.full_name?.[0]?.toUpperCase() ?? 'W'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-800">
                      {review.reviewer?.full_name ?? 'Mteja'}
                    </span>
                    {review.is_verified && (
                      <span className="text-xs bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">
                        ✓ Imethibitishwa
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <span key={i} className={`text-sm ${i <= review.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-400" suppressHydrationWarning>{timeAgo(review.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Comment */}
              {review.comment && (
                <p className="text-sm text-gray-600 leading-relaxed mb-3 pl-11">
                  &ldquo;{review.comment}&rdquo;
                </p>
              )}

              {/* Helpful */}
              <div className="pl-11">
                <button
                  onClick={() => handleHelpful(review.id)}
                  disabled={voted}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
                    voted
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100 active:scale-95'
                  }`}
                >
                  <span>👍</span>
                  <span>{voted ? 'Umepiga kura' : 'Ilikuwa na msaada'}</span>
                  {hCount > 0 && <span className="font-semibold">({hCount})</span>}
                </button>
              </div>

              {/* Dalali reply */}
              {review.response && (
                <div className="mt-3 ml-11 bg-primary-50 rounded-xl px-3 py-2.5 border-l-2 border-primary-300">
                  <p className="text-xs font-semibold text-primary-700 mb-1">💬 Jibu la Dalali</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{review.response}</p>
                  {review.response_at && (
                    <p className="text-xs text-gray-400 mt-1" suppressHydrationWarning>{timeAgo(review.response_at)}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
