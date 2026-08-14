'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'

const REASONS = [
  'Situmii tena',
  'Ninabadilisha platform',
  'Matatizo ya kiufundi',
  'Sababu nyingine',
]

const CONFIRM_PHRASE = 'FUTA AKAUNTI YANGU'

type Step = 1 | 2 | 3

export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage()
  const router = useRouter()

  const [step, setStep]           = useState<Step>(1)
  const [reason, setReason]       = useState(REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [confirmText, setConfirmText]   = useState('')
  const [password, setPassword]         = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const finalReason = reason === 'Sababu nyingine' && customReason.trim()
    ? customReason.trim()
    : reason

  const canProceed3 = confirmText === CONFIRM_PHRASE && password.length >= 1

  async function handleDelete() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/v1/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, reason: finalReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa')

      // Redirect to home with deletion notice
      router.push('/?deleted=1')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl max-h-[92vh] overflow-y-auto pb-10
                   animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-4 px-6">
          {([1, 2, 3] as Step[]).map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-red-400' : 'bg-gray-200'
            }`} />
          ))}
        </div>

        {/* ── STEP 1: Warning ── */}
        {step === 1 && (
          <div className="px-6">
            <div className="text-4xl text-center mb-3 flex justify-center"><i className="ti ti-alert-triangle text-red-500" aria-hidden="true" /></div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-4">
              {t('dal_delete_title')}
            </h2>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 space-y-2">
              {([
                'dal_delete_warn1', 'dal_delete_warn2', 'dal_delete_warn3',
                'dal_delete_warn4', 'dal_delete_warn5',
              ] as const).map(key => (
                <div key={key} className="flex items-center gap-2">
                  <i className="ti ti-x text-red-400 text-sm flex-shrink-0" aria-hidden="true" />
                  <p className="text-sm text-red-700">{t(key)}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-red-500 text-white py-3.5 rounded-2xl text-sm font-semibold mb-3 active:scale-[0.98] transition-all"
            >
              {t('dal_delete_proceed')} →
            </button>
            <button onClick={onClose} className="w-full py-3 text-sm text-gray-400">
              {t('dal_delete_keep')}
            </button>
          </div>
        )}

        {/* ── STEP 2: Reason ── */}
        {step === 2 && (
          <div className="px-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">{t('dal_delete_why')}</h2>
            <p className="text-xs text-gray-400 mb-4">{t('dal_delete_why_sub')}</p>

            <div className="space-y-2 mb-4">
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${
                    reason === r ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    reason === r ? 'border-red-500 bg-red-500' : 'border-gray-300'
                  }`}>
                    {reason === r && <span className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-gray-700">{r}</span>
                </button>
              ))}
            </div>

            {reason === 'Sababu nyingine' && (
              <textarea
                placeholder="Elezea zaidi (optional)..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                rows={2}
                maxLength={200}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-red-200 resize-none mb-4"
              />
            )}

            <button
              onClick={() => setStep(3)}
              className="w-full bg-red-500 text-white py-3.5 rounded-2xl text-sm font-semibold mb-3 active:scale-[0.98] transition-all"
            >
              {t('dal_delete_proceed')} →
            </button>
            <button onClick={() => setStep(1)} className="w-full py-3 text-sm text-gray-400">
              ← {t('common_back')}
            </button>
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 3 && (
          <div className="px-6">
            <div className="text-3xl text-center mb-3 flex justify-center"><i className="ti ti-lock text-gray-600" aria-hidden="true" /></div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-4">
              {t('dal_delete_confirm')}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">
                  {t('dal_delete_type_msg')} <span className="font-mono font-bold text-red-600">{CONFIRM_PHRASE}</span>
                </label>
                <input
                  type="text"
                  placeholder={CONFIRM_PHRASE}
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm font-mono
                    focus:outline-none focus:ring-2 transition-colors ${
                    confirmText === CONFIRM_PHRASE
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-gray-200 focus:ring-gray-200'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block"><i className="ti ti-lock" aria-hidden="true" /> {t('dal_delete_pw_label')}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-base
                               focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
                    tabIndex={-1}
                  >
                    {showPass ? <i className="ti ti-eye-off" aria-hidden="true" /> : <i className="ti ti-eye" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={handleDelete}
              disabled={!canProceed3 || loading}
              className="w-full mt-5 bg-red-500 text-white py-3.5 rounded-2xl text-sm font-bold
                         disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('dal_delete_deleting')}
                </span>
              ) : t('dal_delete_btn')}
            </button>
            <button onClick={() => setStep(2)} className="w-full py-3 text-sm text-gray-400 mt-2">
              ← {t('common_back')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
