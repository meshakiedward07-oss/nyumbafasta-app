'use client'
import { useState } from 'react'

const PLAN_OPTIONS = [
  { id: 'basic',      label: 'Basic' },
  { id: 'premium',    label: 'Premium' },
  { id: 'enterprise', label: 'Enterprise' },
] as const

type PlanId = typeof PLAN_OPTIONS[number]['id']

export default function ExtendSubscriptionModal({
  dalaliId,
  dalaliName,
  currentPlan,
  onClose,
  onDone,
}: {
  dalaliId:    string
  dalaliName:  string
  currentPlan?: string | null
  onClose:     () => void
  onDone:      (msg: string) => void
}) {
  const [plan, setPlan]     = useState<PlanId>(
    (PLAN_OPTIONS.some(p => p.id === currentPlan) ? currentPlan : 'basic') as PlanId
  )
  const [days, setDays]     = useState(30)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function submit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/admin/dalali/${dalaliId}/extend`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ days, plan, reason: reason.trim() || undefined }),
      })
      const d = await res.json() as { error?: string; message?: string }
      if (!res.ok) { setError(d.error ?? 'Imeshindwa kupanua usajili'); return }
      onDone(d.message ?? 'Usajili umepanuliwa')
      onClose()
    } catch {
      setError('Imeshindwa kuunganika. Jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ti ti-calendar-plus text-primary-600 text-lg" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Panua Usajili</h2>
            <p className="text-xs text-gray-400">{dalaliName}</p>
          </div>
        </div>

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Usajili utakuwa <strong>active mara moja</strong> baada ya kuthibitisha — hakuna malipo yanayohitajika, dalali ataarifiwa moja kwa moja.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs px-3 py-2.5 rounded-xl">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Kifurushi</label>
          <div className="grid grid-cols-3 gap-2">
            {PLAN_OPTIONS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  plan === p.id
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="ext-days" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Siku za kuongeza
          </label>
          <input
            id="ext-days"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={e => setDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 30)))}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div>
          <label htmlFor="ext-reason" className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Sababu (hiari)
          </label>
          <textarea
            id="ext-reason"
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Mfano: Fidia ya tatizo la mfumo, zawadi ya uaminifu..."
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Ghairi
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold transition disabled:opacity-50"
          >
            {loading ? '...' : 'Panua Sasa'}
          </button>
        </div>
      </div>
    </div>
  )
}
