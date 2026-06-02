'use client'
import { useState } from 'react'

type WeekOption = { weeks: number; price: number; label: string; savings?: string }

const WEEK_OPTIONS: WeekOption[] = [
  { weeks: 1, price: 5_000, label: 'Wiki 1' },
  { weeks: 2, price: 9_000, label: 'Wiki 2', savings: 'Punguzo 10%' },
  { weeks: 4, price: 16_000, label: 'Wiki 4', savings: 'Punguzo 20%' },
]

type Props = {
  listingId: string
  listingTitle: string
  isCurrentlyBoosted: boolean
  boostedUntil: string | null
  onClose: () => void
  onBoosted: (boostedUntil: string) => void
}

function fmt(n: number) {
  return n.toLocaleString()
}

export default function BoostModal({
  listingId, listingTitle, boostedUntil, onClose, onBoosted,
}: Props) {
  const [selectedWeeks, setSelectedWeeks] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const selected = WEEK_OPTIONS.find(o => o.weeks === selectedWeeks)!

  const boostedUntilDate = boostedUntil ? new Date(boostedUntil) : null
  const isStillBoosted = boostedUntilDate && boostedUntilDate > new Date()

  async function handleBoost() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/listings/${listingId}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks: selectedWeeks }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa kuboost')
      setDone(true)
      setTimeout(() => {
        onBoosted(data.boosted_until)
        onClose()
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl px-5 pt-5 pb-10 shadow-xl max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />

        {done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3 animate-bounce">🚀</div>
            <p className="text-lg font-bold text-gray-900 mb-1">Listing Imeboostwa!</p>
            <p className="text-sm text-gray-500">Listing yako itaonekana juu kwa wiki {selectedWeeks}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🚀</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">Boost Listing Yako</h3>
                <p className="text-xs text-gray-500 truncate">{listingTitle}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 text-xl leading-none">✕</button>
            </div>

            {/* Currently boosted info */}
            {isStillBoosted && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
                <span className="text-base">⚡</span>
                <div>
                  <p className="text-xs font-semibold text-yellow-800">Imeboostwa tayari</p>
                  <p className="text-xs text-yellow-600" suppressHydrationWarning>
                    Hadi: {boostedUntilDate!.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            )}

            {/* Week options */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Chagua Muda</p>
            <div className="space-y-2 mb-4">
              {WEEK_OPTIONS.map(opt => (
                <button
                  key={opt.weeks}
                  onClick={() => setSelectedWeeks(opt.weeks)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
                    selectedWeeks === opt.weeks
                      ? 'border-yellow-400 bg-yellow-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedWeeks === opt.weeks ? 'border-yellow-400 bg-yellow-400' : 'border-gray-300'
                    }`}>
                      {selectedWeeks === opt.weeks && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                      {opt.savings && (
                        <p className="text-xs text-green-600 font-medium">{opt.savings}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">Tsh {fmt(opt.price)}</p>
                    <p className="text-xs text-gray-400">
                      Tsh {fmt(Math.round(opt.price / opt.weeks))} / wiki
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Benefits */}
            <div className="bg-primary-50 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold text-primary-800 mb-2">✨ Faida za Boost</p>
              <div className="space-y-1.5">
                {[
                  'Inaonekana JUU ya listings zote',
                  'Badge ya "🚀 Inashauriwa" inayovutia',
                  'Wateja wengi zaidi wanakuona',
                  'Leads +300% average kwa dalali wanaobust',
                ].map(b => (
                  <div key={b} className="flex items-center gap-2">
                    <span className="text-primary-500 text-xs font-bold">✓</span>
                    <p className="text-xs text-primary-700">{b}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center py-3 border-t border-gray-100 mb-4">
              <p className="text-sm font-semibold text-gray-700">Jumla ya Kulipa</p>
              <p className="text-lg font-bold text-gray-900">Tsh {fmt(selected.price)}</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-xl mb-3">
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleBoost}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-yellow-400 text-gray-900 font-bold text-sm
                         shadow-sm shadow-yellow-200 disabled:opacity-60
                         active:scale-[0.97] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                  Inaboostwa...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Lipa Tsh {fmt(selected.price)} — Boost Sasa
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 text-sm text-gray-400 mt-2"
            >
              Ghairi
            </button>
          </>
        )}
      </div>
    </div>
  )
}
