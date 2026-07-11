'use client'
import { useState } from 'react'

interface Props { onClose: () => void; onSuccess: () => void }

export default function CommissionForm({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    client_name: '', property_title: '',
    expected_amount: '', paid_amount: '0',
    due_date: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit() {
    if (!form.client_name) { setError('Weka jina la mteja'); return }
    if (!form.property_title) { setError('Weka jina la nyumba'); return }
    if (!form.expected_amount || parseInt(form.expected_amount) <= 0) { setError('Weka kiasi cha kamisheni'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/v1/dalali/finance/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name:     form.client_name,
          property_title:  form.property_title,
          expected_amount: parseInt(form.expected_amount),
          paid_amount:     parseInt(form.paid_amount || '0'),
          due_date:        form.due_date || null,
          notes:           form.notes || null,
        }),
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else setError(data.error || 'Imeshindwa')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="ti ti-receipt text-amber-500" aria-hidden="true" /> Kamisheni mpya
            </h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
              <i className="ti ti-x text-gray-500" aria-hidden="true" />
            </button>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          {/* Client name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Jina la mteja *</label>
            <input type="text" placeholder="e.g. Amina Hassan" value={form.client_name} onChange={e => set('client_name', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          {/* Property */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Nyumba / Mali *</label>
            <input type="text" placeholder="e.g. Mbezi 3BR Apartment" value={form.property_title} onChange={e => set('property_title', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Kamisheni (TSh) *</label>
              <input type="number" inputMode="numeric" placeholder="500000" value={form.expected_amount} onChange={e => set('expected_amount', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Imelipwa (TSh)</label>
              <input type="number" inputMode="numeric" placeholder="0" value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tarehe ya mwisho</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Maelezo ya ziada</label>
            <input type="text" placeholder="Maelezo..." value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          <button onClick={handleSubmit} disabled={saving}
            className="w-full bg-amber-500 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all">
            {saving ? 'Inahifadhi...' : '✓ Hifadhi Kamisheni'}
          </button>
        </div>
      </div>
    </div>
  )
}
