'use client'
import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/context'

type Props = {
  unlockId: string
  dalaliName: string
  onSubmitted: () => void
  onDismiss?: () => void
}

const RATING_LABELS = ['', 'Mbaya sana', 'Mbaya', 'Wastani', 'Nzuri', 'Bora kabisa!']
const RATING_COLORS = ['', 'text-red-500', 'text-orange-400', 'text-amber-400', 'text-lime-500', 'text-green-500']
const RATING_BG    = ['', 'bg-red-50 border-red-200', 'bg-orange-50 border-orange-200', 'bg-amber-50 border-amber-200', 'bg-lime-50 border-lime-200', 'bg-green-50 border-green-200']

export default function ReviewForm({ unlockId, dalaliName, onSubmitted, onDismiss }: Props) {
  const { t } = useLanguage()
  const [rating,     setRating]     = useState(0)
  const [hovered,    setHovered]    = useState(0)
  const [comment,    setComment]    = useState('')
  const [foundHouse, setFoundHouse] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  async function handleSubmit() {
    if (rating === 0) { setError(t('cl_star_required')); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlock_id: unlockId, rating, comment, found_house: foundHouse }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Hitilafu ilitokea'); return }
      onSubmitted()
    } catch {
      setError(t('cl_no_internet'))
    } finally {
      setSubmitting(false)
    }
  }

  const display = hovered || rating

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200 shadow-sm">

      {/* Colored header */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <i className="ti ti-star-filled" aria-hidden="true" />
              {t('cl_review_title')}
            </h3>
            <p className="text-amber-100 text-xs mt-0.5">{t('cl_review_subtitle')} {dalaliName}?</p>
          </div>
          {onDismiss && (
            <button
              aria-label="Funga"
              onClick={onDismiss}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <i className="ti ti-x text-lg" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white px-5 py-5 space-y-5">

        {/* ── Star picker ── */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Chagua kiwango:</p>

          <div className="flex flex-col items-center gap-3">
            {/* Stars row */}
            <div
              className="flex items-center gap-2"
              onMouseLeave={() => setHovered(0)}
            >
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  aria-label={`Nyota ${star} — ${RATING_LABELS[star]}`}
                  aria-pressed={rating === star}
                  onClick={() => { setRating(star); setError('') }}
                  onMouseEnter={() => setHovered(star)}
                  className="group flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-150 active:scale-90 touch-manipulation"
                  style={{
                    background: display >= star
                      ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                      : '#f9fafb',
                    boxShadow: display >= star
                      ? '0 4px 12px rgba(245,158,11,0.35)'
                      : '0 1px 3px rgba(0,0,0,0.08)',
                    border: display >= star ? '2px solid #f59e0b' : '2px solid #e5e7eb',
                  }}
                >
                  <i
                    className={`${display >= star ? 'ti ti-star-filled' : 'ti ti-star'} text-2xl transition-all`}
                    style={{ color: display >= star ? '#fff' : '#d1d5db' }}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>

            {/* Rating label pill */}
            <div className={`min-h-[32px] transition-all duration-200 ${display > 0 ? 'opacity-100' : 'opacity-0'}`}>
              {display > 0 && (
                <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border ${RATING_BG[display]} ${RATING_COLORS[display]}`}>
                  {display === 5 && <i className="ti ti-confetti text-sm" aria-hidden="true" />}
                  {RATING_LABELS[display]}
                  {display === 5 && <i className="ti ti-confetti text-sm" aria-hidden="true" />}
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium mt-2 text-center flex items-center justify-center gap-1">
              <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
            </p>
          )}
        </div>

        {/* ── Found house? ── */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
            Ulipata nyumba? <span className="font-normal text-gray-400 normal-case">(hiari)</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFoundHouse(true)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                foundHouse === true
                  ? 'bg-primary-500 border-primary-500 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300 hover:bg-primary-50'
              }`}
            >
              <i className="ti ti-circle-check text-lg" aria-hidden="true" /> Ndiyo
            </button>
            <button
              type="button"
              onClick={() => setFoundHouse(false)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                foundHouse === false
                  ? 'bg-red-500 border-red-500 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
              }`}
            >
              <i className="ti ti-circle-x text-lg" aria-hidden="true" /> Hapana
            </button>
          </div>
        </div>

        {/* ── Comment ── */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Maoni yako <span className="font-normal text-gray-400 normal-case">(hiari)</span>
          </p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Andika maoni yako hapa..."
            maxLength={300}
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-3
                       focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300
                       resize-none placeholder-gray-300 text-gray-700 transition-colors"
          />
          <p className="text-right text-xs text-gray-300 mt-0.5">{comment.length}/300</p>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-1">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm text-gray-500 font-semibold hover:bg-gray-50 transition-colors"
            >
              Baadaye
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
            style={{
              background: rating > 0
                ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                : undefined,
              backgroundColor: rating === 0 ? '#d1d5db' : undefined,
              boxShadow: rating > 0 ? '0 4px 12px rgba(245,158,11,0.35)' : 'none',
            }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                Inatuma...
              </span>
            ) : (
              <><i className="ti ti-send" aria-hidden="true" /> Tuma Maoni</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
