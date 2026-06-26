'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import PaymentMethodSelector, { PAYMENT_METHODS } from '@/components/payments/PaymentMethodSelector'
import type { PaymentMethod } from '@/components/payments/PaymentMethodSelector'

type BoostStep = 'select_package' | 'select_payment' | 'mobile_phone' | 'processing' | 'waiting' | 'success'

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
  const [boostStep,         setBoostStep]         = useState<BoostStep>('select_package')
  const [selectedWeeks,     setSelectedWeeks]     = useState<1 | 2 | 4>(1)
  const [selectedMethod,    setSelectedMethod]    = useState<PaymentMethod | null>(null)
  const [phoneNumber,       setPhoneNumber]       = useState('')
  const [phoneError,        setPhoneError]        = useState('')
  const [error,             setError]             = useState('')
  const [, setPaymentRef]        = useState('')
  const [finalBoostedUntil, setFinalBoostedUntil] = useState('')
  const [secondsLeft,       setSecondsLeft]       = useState(120)

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const startPolling = useCallback((ref: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/v1/payments/boost/status?ref=${encodeURIComponent(ref)}`)
        const data = await res.json()
        if (data.status === 'completed') {
          stopPolling()
          setFinalBoostedUntil(data.boosted_until ?? '')
          onBoosted(data.boosted_until ?? '')
          setBoostStep('success')
        } else if (data.status === 'failed') {
          stopPolling()
          setError('Malipo hayakufanikiwa. Jaribu tena.')
          setBoostStep('select_payment')
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 3000)
  }, [stopPolling, onBoosted])

  useEffect(() => {
    if (boostStep !== 'waiting') return
    setSecondsLeft(120)
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          stopPolling()
          setError('Muda umeisha. Jaribu tena.')
          setBoostStep('select_payment')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [boostStep, stopPolling])

  useEffect(() => { return () => stopPolling() }, [stopPolling])

  const providerInfo = PAYMENT_METHODS.find(m => m.id === selectedMethod)

  function validatePhone(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '')
    return /^(255|0)[67]\d{8}$/.test(cleaned) || /^[67]\d{8}$/.test(cleaned)
  }

  function normalizeForApi(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('255')) return cleaned
    if (cleaned.startsWith('0'))   return '255' + cleaned.slice(1)
    return '255' + cleaned
  }

  const boostedUntilDate = boostedUntil ? new Date(boostedUntil) : null
  const isStillBoosted   = boostedUntilDate && boostedUntilDate > new Date()

  const pkg    = WEEK_OPTIONS.find(o => o.weeks === selectedWeeks)!
  const amount = pkg.price

  function handlePackageContinue() {
    setBoostStep('select_payment')
  }

  function handleSelectorPay(method: PaymentMethod) {
    setSelectedMethod(method)
    setPhoneError('')
    setBoostStep('mobile_phone')
  }

  function handlePhoneSubmit() {
    if (!validatePhone(phoneNumber)) {
      setPhoneError('Nambari si sahihi — ingiza nambari ya Tanzania (mfano: 0754 XXX XXX)')
      return
    }
    setPhoneError('')
    processBoostPayment()
  }

  async function processBoostPayment() {
    setBoostStep('processing')
    setError('')
    try {
      const msisdn = normalizeForApi(phoneNumber)
      const res  = await fetch('/api/v1/payments/boost/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          listing_id: listingId,
          weeks:      selectedWeeks,
          msisdn,
          provider:   selectedMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa kuwasiliana na AzamPay')

      if (data.mock) {
        setFinalBoostedUntil(data.boosted_until ?? '')
        onBoosted(data.boosted_until ?? '')
        setBoostStep('success')
        return
      }

      setPaymentRef(data.payment_ref)
      setBoostStep('waiting')
      startPolling(data.payment_ref)
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
        onTouchEnd={e => e.stopPropagation()}
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
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">⚡</span>
                  <p className="text-xs font-semibold text-yellow-800">Imeboostwa tayari</p>
                </div>
                <p className="text-xs text-yellow-600 mb-1" suppressHydrationWarning>
                  Inaisha: {boostedUntilDate!.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-xs text-yellow-700 font-medium">
                  Boost mpya itaongeza muda kutoka tarehe ya mwisho ya boost iliyopo.
                </p>
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
                  'Leads +300% average kwa dalali wanaotumia boost',
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

        {/* ── STEP 3: Nambari ya Simu ── */}
        {boostStep === 'mobile_phone' && (
          <div>
            <button
              onClick={() => setBoostStep('select_payment')}
              className="flex items-center gap-1 text-sm text-gray-500 mb-4 active:opacity-70"
            >
              ← Rudi
            </button>

            <div className="flex items-center gap-2 mb-4">
              {providerInfo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={providerInfo.iconSrc} alt={providerInfo.iconAlt} className="h-6 w-auto object-contain" />
              )}
              <div>
                <h3 className="font-bold text-base text-gray-900">📱 Nambari ya Simu</h3>
                <p className="text-xs text-gray-400">
                  {providerInfo?.name ?? 'Mobile Money'} · Tsh {fmt(amount)}
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-xl mb-3">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1.5 block">
                Nambari ya {providerInfo?.name ?? 'simu yako'}
              </label>
              <div className="flex gap-2">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3
                  text-sm text-gray-500 flex-shrink-0">
                  🇹🇿 +255
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={providerInfo?.hint?.split(' ')[0] ?? '7XXXXXXXX'}
                  value={phoneNumber}
                  onChange={e => {
                    setPhoneNumber(e.target.value.replace(/\D/g, ''))
                    setPhoneError('')
                  }}
                  maxLength={10}
                  className={`flex-1 border-2 rounded-xl px-4 py-3 text-base font-mono
                    focus:outline-none focus:ring-2 ${
                      phoneError
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-200 focus:ring-yellow-300'
                    }`}
                />
              </div>
              {phoneError && <p className="text-red-500 text-xs mt-1">❌ {phoneError}</p>}
              {providerInfo?.hint && !phoneError && (
                <p className="text-xs text-gray-400 mt-1">Mfano: {providerInfo.hint}</p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
              <p className="text-blue-700 text-xs">
                ℹ️ Utapata ombi la PIN kwenye simu yako — ingiza PIN kukamilisha malipo ya{' '}
                <span className="font-semibold">Tsh {fmt(amount)}</span>
              </p>
            </div>

            <button
              onClick={handlePhoneSubmit}
              disabled={phoneNumber.length < 9}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm
                disabled:opacity-50 active:scale-[0.97] transition-all"
              style={{
                backgroundColor: phoneNumber.length >= 9
                  ? (providerInfo?.color ?? '#1D9E75')
                  : '#9CA3AF'
              }}
            >
              Endelea → Ingiza PIN Kwenye Simu
            </button>
            <button onClick={onClose} className="w-full py-3 text-sm text-gray-400 mt-2">
              Ghairi
            </button>
          </div>
        )}

        {/* ── STEP 4: Inawasiliana na AzamPay ── */}
        {boostStep === 'processing' && (
          <div className="text-center py-14">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full
                            animate-spin mx-auto mb-5" />
            <p className="font-semibold text-lg text-gray-900">⏳ Inawasiliana na AzamPay...</p>
            <p className="text-gray-400 text-sm mt-1">Tafadhali subiri</p>
          </div>
        )}

        {/* ── STEP 5: Subiri USSD ── */}
        {boostStep === 'waiting' && (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full
                            animate-spin mx-auto mb-5" />
            <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-100
                            text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              ✅ Subiri USSD popup kwenye simu yako
            </div>
            <p className="text-gray-500 text-sm mb-1">
              Ingiza PIN yako ya {providerInfo?.name ?? 'mobile money'} kukamilisha malipo
            </p>
            <p className="text-gray-400 text-xs mb-6">
              Tsh {fmt(amount)} · Inakagua kiotomatiki...
            </p>
            <div className="bg-gray-50 rounded-2xl p-3 mb-4">
              <p className="text-gray-400 text-xs">
                Muda uliobaki: <span className="font-semibold text-gray-600">{secondsLeft}s</span>
              </p>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-xl mt-3">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 6: Imefanikiwa ── */}
        {boostStep === 'success' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4 animate-bounce">🚀</div>
            <h3 className="font-bold text-xl text-gray-900 mb-2">Listing Imeboostwa!</h3>
            <p className="text-gray-500 text-sm mb-1">Listing yako itaonekana juu ya wote</p>
            {finalBoostedUntil && (
              <p className="text-gray-400 text-xs mb-6" suppressHydrationWarning>
                Hadi: {new Date(finalBoostedUntil).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
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
