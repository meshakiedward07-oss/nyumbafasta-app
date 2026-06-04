'use client'
import { useState } from 'react'
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector'
import CardDetailsForm from '@/components/payments/CardDetailsForm'
import type { PaymentMethod } from '@/components/payments/PaymentMethodSelector'
import type { CardDetails } from '@/components/payments/CardDetailsForm'

type BoostStep = 'select_package' | 'select_payment' | 'card_details' | 'processing' | 'success'

type WeekOption = { weeks: 1 | 2 | 4; price: number; label: string; discount: string | null }

const WEEK_OPTIONS: WeekOption[] = [
  { weeks: 1, price: 5_000,  label: 'Wiki 1', discount: null },
  { weeks: 2, price: 9_000,  label: 'Wiki 2', discount: '-10%' },
  { weeks: 4, price: 16_000, label: 'Wiki 4', discount: '-20%' },
]

type Props = {
  listingId:          string
  listingTitle:       string
  isCurrentlyBoosted: boolean
  boostedUntil:       string | null
  onClose:            () => void
  onBoosted:          (boostedUntil: string) => void
}

function fmt(n: number) { return n.toLocaleString() }

export default function BoostModal({
  listingId, listingTitle, boostedUntil, onClose, onBoosted,
}: Props) {
  const [boostStep,      setBoostStep]      = useState<BoostStep>('select_package')
  const [selectedWeeks,  setSelectedWeeks]  = useState<1 | 2 | 4>(1)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [error,          setError]          = useState('')

  const boostedUntilDate = boostedUntil ? new Date(boostedUntil) : null
  const isStillBoosted   = boostedUntilDate && boostedUntilDate > new Date()

  const pkg    = WEEK_OPTIONS.find(o => o.weeks === selectedWeeks)!
  const amount = pkg.price

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────────
  function handlePackageContinue() {
    setBoostStep('select_payment')
  }

  // ── Step 2: PaymentMethodSelector calls this ─────────────────────────────────
  function handleSelectorPay(method: PaymentMethod) {
    setSelectedMethod(method)
    if (method === 'visa' || method === 'mastercard') {
      setBoostStep('card_details')
    } else {
      processBoostPayment()
    }
  }

  // ── Step 3 (card) → processing ───────────────────────────────────────────────
  function handleCardSubmit(_cardDetails: CardDetails) {
    processBoostPayment()
  }

  // ── Core processing ──────────────────────────────────────────────────────────
  async function processBoostPayment() {
    setBoostStep('processing')
    setError('')
    try {
      // Simulated payment delay — replace with real Selcom STK push when ready
      await new Promise(r => setTimeout(r, 2000))

      const res  = await fetch(`/api/v1/listings/${listingId}/boost`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ weeks: selectedWeeks }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa kuboost')

      onBoosted(data.boosted_until)
      setBoostStep('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
      setBoostStep('select_payment')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl px-5 pt-5 pb-10 shadow-xl max-w-lg mx-auto max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />

        {/* ── STEP 1: Chagua Package ── */}
        {boostStep === 'select_package' && (
          <div>
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
                      {opt.discount && (
                        <p className="text-xs text-green-600 font-medium">{opt.discount}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">Tsh {fmt(opt.price)}</p>
                    <p className="text-xs text-gray-400">Tsh {fmt(Math.round(opt.price / opt.weeks))} / wiki</p>
                  </div>
                </button>
              ))}
            </div>

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

            <div className="flex justify-between items-center py-3 border-t border-gray-100 mb-4">
              <p className="text-sm font-semibold text-gray-700">Jumla ya Kulipa</p>
              <p className="text-lg font-bold text-gray-900">Tsh {fmt(amount)}</p>
            </div>

            <button
              onClick={handlePackageContinue}
              className="w-full py-4 rounded-2xl bg-yellow-400 text-gray-900 font-bold text-sm
                         shadow-sm shadow-yellow-200 active:scale-[0.97] transition-all
                         flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              Endelea → Lipa Tsh {fmt(amount)}
            </button>
            <button onClick={onClose} className="w-full py-3 text-sm text-gray-400 mt-2">
              Ghairi
            </button>
          </div>
        )}

        {/* ── STEP 2: Chagua Njia ya Kulipa ── */}
        {boostStep === 'select_payment' && (
          <div>
            <button
              onClick={() => setBoostStep('select_package')}
              className="flex items-center gap-1 text-sm text-gray-500 mb-4 active:opacity-70"
            >
              ← Rudi
            </button>
            <h3 className="font-bold text-base text-gray-900 mb-1">💳 Chagua Njia ya Kulipa</h3>
            <p className="text-gray-400 text-sm mb-4">
              Jumla: <span className="font-semibold text-gray-700">Tsh {fmt(amount)}</span>
            </p>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-xl mb-3">
                {error}
              </div>
            )}

            <PaymentMethodSelector
              selected={selectedMethod}
              onSelect={setSelectedMethod}
              amount={amount}
              onPay={handleSelectorPay}
            />

            <button onClick={onClose} className="w-full py-3 text-sm text-gray-400 mt-3">
              Ghairi
            </button>
          </div>
        )}

        {/* ── STEP 3: Taarifa za Kadi ── */}
        {boostStep === 'card_details' && (
          <CardDetailsForm
            cardType={selectedMethod as 'visa' | 'mastercard'}
            amount={amount}
            onBack={() => setBoostStep('select_payment')}
            onSubmit={handleCardSubmit}
          />
        )}

        {/* ── STEP 4: Inashughulikia ── */}
        {boostStep === 'processing' && (
          <div className="text-center py-14">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full
                            animate-spin mx-auto mb-5" />
            <p className="font-semibold text-lg text-gray-900">Inashughulikia Malipo...</p>
            <p className="text-gray-400 text-sm mt-1">Tafadhali subiri</p>
          </div>
        )}

        {/* ── STEP 5: Imefanikiwa ── */}
        {boostStep === 'success' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4 animate-bounce">🚀</div>
            <h3 className="font-bold text-xl text-gray-900 mb-2">Listing Imeboostwa!</h3>
            <p className="text-gray-500 text-sm mb-1">Listing yako itaonekana juu ya wote</p>
            <p className="text-gray-400 text-xs mb-6" suppressHydrationWarning>
              Hadi: {new Date(
                Date.now() + selectedWeeks * 7 * 24 * 60 * 60 * 1000
              ).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <button
              onClick={onClose}
              className="w-full bg-yellow-400 text-gray-900 py-3 rounded-2xl font-bold
                         active:scale-[0.97] transition-transform"
            >
              ✅ Sawa, Asante!
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
