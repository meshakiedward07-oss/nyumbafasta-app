'use client'
import { useState } from 'react'

const REPORT_REASONS = [
  { value: 'Anaomba pesa nje ya app', icon: 'alert-triangle' },
  { value: 'Picha ni fake',           icon: 'photo' },
  { value: 'Nyumba haipatikani',      icon: 'home-off' },
  { value: 'Nambari si ya kweli',     icon: 'phone-off' },
  { value: 'Unyanyasaji wa wateja',   icon: 'mood-angry' },
  { value: 'Sababu nyingine',         icon: 'pencil' },
]

type Props = {
  listingId: string
  dalaliName: string
  onClose: () => void
}

export default function ReportDalaliModal({ listingId, dalaliName, onClose }: Props) {
  const [reason, setReason]   = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit() {
    if (!reason) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/listings/${listingId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details: details.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa')
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl pb-10 max-h-[90vh] overflow-y-auto
                   animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {done ? (
          <div className="px-6 pt-2 text-center pb-4">
            <div className="text-4xl mb-3 flex justify-center"><i className="ti ti-circle-check text-primary-500" aria-hidden="true" /></div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Ripoti Imetumwa!</h2>
            <p className="text-sm text-gray-500 mb-5">
              Asante kwa kutuarifu. Timu yetu itaangalia ripoti yako ndani ya saa 24.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold"
            >
              Funga
            </button>
          </div>
        ) : (
          <div className="px-6 pt-2">
            <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" />Ripoti Dalali</h2>
            <p className="text-xs text-gray-400 mb-4">
              Dalali: <span className="font-medium text-gray-600">{dalaliName}</span>
            </p>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Chagua sababu:
            </p>
            <div className="space-y-2 mb-4">
              {REPORT_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${
                    reason === r.value ? 'border-red-400 bg-red-50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    reason === r.value ? 'border-red-500 bg-red-500' : 'border-gray-300'
                  }`}>
                    {reason === r.value && <span className="text-white text-[8px]">●</span>}
                  </div>
                  <i className={`ti ti-${r.icon} text-sm`} aria-hidden="true" />
                  <span className="text-sm text-gray-700">{r.value}</span>
                </button>
              ))}
            </div>

            <div className="mb-5">
              <label className="text-xs text-gray-500 mb-1.5 block">Maelezo ya ziada (optional)</label>
              <textarea
                placeholder="Elezea zaidi hali uliyoona..."
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={2}
                maxLength={300}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!reason || loading}
              className="w-full bg-red-500 text-white py-3.5 rounded-2xl text-sm font-semibold
                         disabled:opacity-40 active:scale-[0.98] transition-all mb-3"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Inatuma...
                </span>
              ) : 'Tuma Ripoti'}
            </button>
            <button onClick={onClose} className="w-full py-3 text-sm text-gray-400">
              Ghairi
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
