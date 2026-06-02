'use client'
import { useState } from 'react'

type Props = {
  unlockId: string
  dalaliName: string
  onSubmitted: () => void
  onDismiss?: () => void
}

export default function ReviewForm({ unlockId, dalaliName, onSubmitted, onDismiss }: Props) {
  const [rating, setRating]     = useState(0)
  const [hovered, setHovered]   = useState(0)
  const [comment, setComment]   = useState('')
  const [foundHouse, setFoundHouse] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit() {
    if (rating === 0) { setError('Chagua nyota kwanza'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unlock_id: unlockId,
          rating,
          comment,
          found_house: foundHouse,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Hitilafu ilitokea'); return }
      onSubmitted()
    } catch {
      setError('Hakuna mtandao. Jaribu tena.')
    } finally {
      setSubmitting(false)
    }
  }

  const displayRating  = hovered || rating
  const ratingLabels   = ['', 'Mbaya sana', 'Mbaya', 'Wastani', 'Nzuri', 'Nzuri sana!']

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">⭐ Toa Maoni</h3>
          <p className="text-xs text-gray-400 mt-0.5">Je, ulifurahi na huduma ya {dalaliName}?</p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-gray-400 text-xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
        )}
      </div>

      {/* Star picker */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">Rating:</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="text-4xl transition-transform active:scale-90 tap-highlight-none min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <span className={displayRating >= star ? 'text-amber-400' : 'text-gray-200'}>★</span>
              </button>
            ))}
          </div>
          {displayRating > 0 && (
            <span className="text-xs text-gray-500 font-medium">{ratingLabels[displayRating]}</span>
          )}
        </div>
      </div>

      {/* Found house? */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">Ulipata nyumba?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFoundHouse(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
              foundHouse === true
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
            }`}
          >
            ✅ Ndiyo
          </button>
          <button
            type="button"
            onClick={() => setFoundHouse(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
              foundHouse === false
                ? 'bg-red-500 border-red-500 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
            }`}
          >
            ❌ Hapana
          </button>
        </div>
      </div>

      {/* Comment */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">Maoni yako (hiari):</p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={`Andika maoni yako hapa...`}
          maxLength={300}
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5
                     focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none
                     placeholder-gray-300 text-gray-700"
        />
        <p className="text-right text-xs text-gray-300 mt-0.5">{comment.length}/300</p>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <div className="flex gap-2">
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 font-medium"
          >
            Baadaye
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold
                     disabled:opacity-40 active:scale-95 transition-all"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Inatuma...
            </span>
          ) : '📨 Tuma Maoni'}
        </button>
      </div>
    </div>
  )
}
