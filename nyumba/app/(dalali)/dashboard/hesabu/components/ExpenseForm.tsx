'use client'
import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/context'

const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'mpesa',  label: 'M-Pesa' },
  { value: 'tigo',   label: 'Tigo Pesa' },
  { value: 'airtel', label: 'Airtel Money' },
  { value: 'bank',   label: 'Benki' },
]

interface Props { onClose: () => void; onSuccess: () => void }

export default function ExpenseForm({ onClose, onSuccess }: Props) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    amount: '', category: 'transport',
    date: new Date().toISOString().split('T')[0],
    description: '', vendor: '', payment_method: 'cash', receipt_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const CATEGORIES = [
    { value: 'transport',   label: t('hesabu_cat_transport')  },
    { value: 'marketing',   label: t('hesabu_cat_marketing')  },
    { value: 'phone',       label: t('hesabu_cat_phone')      },
    { value: 'office',      label: t('hesabu_cat_office')     },
    { value: 'commission',  label: t('hesabu_cat_exp_comm')   },
    { value: 'other',       label: t('hesabu_cat_other')      },
  ]

  async function handleSubmit() {
    if (!form.amount || parseInt(form.amount) <= 0) { setError(t('hesabu_ef_err_amount')); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/v1/dalali/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseInt(form.amount), receipt_url: form.receipt_url || null }),
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else setError(data.error || t('hesabu_ef_err_amount'))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="ti ti-trending-down text-red-500" aria-hidden="true" /> {t('hesabu_ef_title')}
            </h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
              <i className="ti ti-x text-gray-500" aria-hidden="true" />
            </button>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('hesabu_ef_amount_label')}</label>
            <input
              type="number" inputMode="numeric" placeholder="e.g. 15000"
              value={form.amount} onChange={e => set('amount', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Category chips */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">{t('hesabu_ef_cat_label')}</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => set('category', c.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${form.category === c.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('hesabu_ef_date_label')}</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          {/* Vendor + description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('hesabu_ef_vendor_label')}</label>
              <input type="text" placeholder={t('hesabu_ef_vendor_ph')} value={form.vendor} onChange={e => set('vendor', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('hesabu_ef_desc_label')}</label>
              <input type="text" placeholder={t('hesabu_ef_desc_ph')} value={form.description} onChange={e => set('description', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>

          {/* Receipt URL */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('hesabu_ef_receipt_label')}</label>
            <input type="url" placeholder="https://..." value={form.receipt_url} onChange={e => set('receipt_url', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          {/* Payment method chips */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">{t('hesabu_ef_payment_label')}</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(p => (
                <button key={p.value} type="button" onClick={() => set('payment_method', p.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.payment_method === p.value ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={saving}
            className="w-full bg-red-600 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all">
            {saving ? t('hesabu_ef_saving') : t('hesabu_ef_save_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}
