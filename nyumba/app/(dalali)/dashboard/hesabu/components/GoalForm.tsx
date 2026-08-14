'use client'
import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

interface Props {
  currentGoal?: { title: string; target_amount: number; month: number; year: number } | null
  onClose: () => void
  onSuccess: () => void
}

const MONTH_KEYS: TKey[] = [
  'hesabu_month_1',  'hesabu_month_2',  'hesabu_month_3',
  'hesabu_month_4',  'hesabu_month_5',  'hesabu_month_6',
  'hesabu_month_7',  'hesabu_month_8',  'hesabu_month_9',
  'hesabu_month_10', 'hesabu_month_11', 'hesabu_month_12',
]

export default function GoalForm({ currentGoal, onClose, onSuccess }: Props) {
  const { t } = useLanguage()
  const now = new Date()
  const [form, setForm] = useState({
    title:         currentGoal?.title         ?? t('hesabu_gf_goal_name_ph'),
    target_amount: currentGoal?.target_amount ? String(currentGoal.target_amount) : '',
    month:         currentGoal?.month         ?? (now.getMonth() + 1),
    year:          currentGoal?.year          ?? now.getFullYear(),
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function getMonthName(month: number): string {
    return month >= 1 && month <= 12 ? t(MONTH_KEYS[month - 1]) : ''
  }

  async function handleSubmit() {
    if (!form.target_amount || parseInt(form.target_amount) <= 0) { setError(t('hesabu_gf_err_amount')); return }
    if (!form.title.trim()) { setError(t('hesabu_gf_err_title')); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/v1/dalali/finance/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         form.title.trim(),
          target_amount: parseInt(form.target_amount),
          month:         form.month,
          year:          form.year,
        }),
      })
      const data = await res.json()
      if (data.success) onSuccess()
      else setError(data.error || t('hesabu_gf_err_amount'))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="ti ti-target text-primary-500" aria-hidden="true" /> {t('hesabu_gf_title')}
            </h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
              <i className="ti ti-x text-gray-500" aria-hidden="true" />
            </button>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          {/* Month / Year display */}
          <div className="bg-primary-50 rounded-xl px-4 py-3 text-sm text-primary-700 font-medium">
            {t('hesabu_gf_month_label')} {getMonthName(form.month)} {form.year}
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('hesabu_gf_goal_name_label')}</label>
            <input type="text" placeholder={t('hesabu_gf_goal_name_ph')} value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          {/* Target amount */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('hesabu_gf_amount_label')}</label>
            <input type="number" inputMode="numeric" placeholder="e.g. 1000000"
              value={form.target_amount}
              onChange={e => setForm(p => ({ ...p, target_amount: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          <button onClick={handleSubmit} disabled={saving}
            className="w-full bg-gray-900 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all">
            {saving ? t('hesabu_gf_saving') : currentGoal ? t('hesabu_gf_update_btn') : t('hesabu_gf_save_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}
