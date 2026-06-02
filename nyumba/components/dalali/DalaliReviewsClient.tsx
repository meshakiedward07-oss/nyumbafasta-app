'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DalaliBottomNav from '@/components/shared/DalaliBottomNav'
import type { DalaliReview } from '@/app/(dalali)/dashboard/reviews/page'

type Props = {
  reviews: DalaliReview[]
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
  return `mwezi ${Math.floor(days / 30)} uliopita`
}

export default function DalaliReviewsClient({ reviews: initial, ratingAvg, ratingCount }: Props) {
  const router = useRouter()
  const [reviews, setReviews] = useState(initial)
  const [replyId, setReplyId]     = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyError, setReplyError]     = useState('')

  async function submitReply(reviewId: string) {
    if (!replyText.trim()) return
    setReplyLoading(true)
    setReplyError('')
    try {
      const res = await fetch(`/api/v1/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', response: replyText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa')
      const now = new Date().toISOString()
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, response: replyText, response_at: now } : r
      ))
      setReplyId(null)
      setReplyText('')
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setReplyLoading(false)
    }
  }

  const fiveStar = reviews.filter(r => r.rating === 5).length

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white">
            ←
          </button>
          <h1 className="text-white text-lg font-bold">Maoni ya Wateja</h1>
        </div>

        {/* Rating summary */}
        <div className="bg-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-white">{ratingAvg > 0 ? ratingAvg.toFixed(1) : '—'}</p>
              <div className="flex gap-0.5 justify-center mt-1">
                {[1,2,3,4,5].map(i => (
                  <span key={i} className={`text-sm ${i <= Math.round(ratingAvg) ? 'text-amber-300' : 'text-white/30'}`}>★</span>
                ))}
              </div>
              <p className="text-white/70 text-xs mt-1">{ratingCount} maoni</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {[5,4,3,2,1].map(star => {
                const count = reviews.filter(r => r.rating === star).length
                const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-white/70 text-xs w-3">{star}</span>
                    <div className="flex-1 bg-white/20 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-300 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-white/70 text-xs w-3 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
            <p className="text-lg font-bold text-gray-900">{ratingCount}</p>
            <p className="text-[11px] text-gray-400">Jumla</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
            <p className="text-lg font-bold text-amber-500">{fiveStar}</p>
            <p className="text-[11px] text-gray-400">⭐⭐⭐⭐⭐</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
            <p className="text-lg font-bold text-primary-500">{reviews.filter(r => !r.response).length}</p>
            <p className="text-[11px] text-gray-400">Hazijajibiwa</p>
          </div>
        </div>

        {/* Reviews list */}
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">⭐</div>
            <p className="text-sm font-semibold text-gray-600 mb-1">Hakuna maoni bado</p>
            <p className="text-xs text-gray-400">Wateja wataandika maoni baada ya kufungua contact yako</p>
          </div>
        ) : reviews.map(review => (
          <div key={review.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4">
              {/* Reviewer */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                  {review.reviewer?.full_name?.[0]?.toUpperCase() ?? 'W'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{review.reviewer?.full_name ?? 'Mteja'}</p>
                    {review.is_verified && (
                      <span className="text-[10px] bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">✓ Verified</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} className={`text-sm ${i <= review.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-400" suppressHydrationWarning>{timeAgo(review.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <span>👍</span>
                  <span>{review.helpful_count ?? 0}</span>
                </div>
              </div>

              {/* Comment */}
              {review.comment && (
                <p className="text-sm text-gray-600 leading-relaxed mb-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  &ldquo;{review.comment}&rdquo;
                </p>
              )}

              {/* Existing reply */}
              {review.response && (
                <div className="bg-primary-50 rounded-xl px-3 py-2.5 border-l-2 border-primary-300 mb-3">
                  <p className="text-[11px] font-semibold text-primary-700 mb-1">💬 Jibu lako</p>
                  <p className="text-xs text-gray-600">{review.response}</p>
                  {review.response_at && (
                    <p className="text-[10px] text-gray-400 mt-1" suppressHydrationWarning>{timeAgo(review.response_at)}</p>
                  )}
                </div>
              )}

              {/* Reply form */}
              {replyId === review.id ? (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Andika jibu lako..."
                    rows={3}
                    maxLength={500}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5
                               focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                  />
                  <p className="text-right text-xs text-gray-300">{replyText.length}/500</p>
                  {replyError && <p className="text-xs text-red-500">{replyError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setReplyId(null); setReplyText(''); setReplyError('') }}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-500 font-medium">
                      Ghairi
                    </button>
                    <button
                      onClick={() => submitReply(review.id)}
                      disabled={replyLoading || !replyText.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-xs font-semibold disabled:opacity-40"
                    >
                      {replyLoading ? 'Inatuma...' : '💬 Tuma Jibu'}
                    </button>
                  </div>
                </div>
              ) : !review.response ? (
                <button
                  onClick={() => { setReplyId(review.id); setReplyText('') }}
                  className="w-full py-2.5 rounded-xl bg-gray-50 text-gray-600 text-xs font-medium
                             hover:bg-gray-100 active:scale-[0.97] transition-all border border-gray-100"
                >
                  💬 Jibu Review
                </button>
              ) : (
                <button
                  onClick={() => { setReplyId(review.id); setReplyText(review.response ?? '') }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✏️ Hariri jibu
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <DalaliBottomNav />
    </div>
  )
}
