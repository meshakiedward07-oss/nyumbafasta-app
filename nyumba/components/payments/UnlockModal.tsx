'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PaymentMethodSelector, { PAYMENT_METHODS } from '@/components/payments/PaymentMethodSelector'
import CardDetailsForm from '@/components/payments/CardDetailsForm'
import type { CardDetails } from '@/components/payments/CardDetailsForm'
import type { PaymentMethod as PaymentProvider } from '@/components/payments/PaymentMethodSelector'

// ── Provider config (keyed for quick lookup) ──────────────
const PROVIDERS = Object.fromEntries(
  PAYMENT_METHODS.map(m => [m.id, {
    name:     m.name,
    badge:    m.company,
    hint:     m.hint,
    icon:     m.icon,
    btnColor: m.color,
    type:     m.type,
  }])
) as Record<PaymentProvider, { name: string; badge: string; hint: string; icon: React.ReactNode; btnColor: string; type: 'mobile' | 'card' }>

// ── Types ─────────────────────────────────────────────────
type ModalStep = 'select' | 'card_details' | 'phone' | 'waiting' | 'success' | 'failed'

type Props = {
  listingId: string
  dalaliName: string
  listingTitle: string
  whatsappNumber: string
  onClose: () => void
  onUnlocked: () => void
}

const POLL_INTERVAL_MS = 3000
const TIMEOUT_SECS     = 120
const UNLOCK_AMOUNT    = 2000

export default function UnlockModal({
  listingId, dalaliName, listingTitle, whatsappNumber, onClose, onUnlocked,
}: Props) {
  const supabase = createClient()

  const [step, setStep]           = useState<ModalStep>('select')
  const [provider, setProvider]   = useState<PaymentProvider>('mpesa')
  const [phone, setPhone]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECS)

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Stop timers ──────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  // ── Countdown timer ──────────────────────────────────────
  useEffect(() => {
    if (step !== 'waiting') return
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          stopPolling()
          setStep('failed')
          setError('Muda umeisha. Jaribu tena.')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step, stopPolling])

  // ── Poll Supabase for unlock status ──────────────────────
  const startPolling = useCallback((id: string) => {
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('contact_unlocks')
        .select('status')
        .eq('id', id)
        .single()

      if (data?.status === 'completed') {
        stopPolling()
        setStep('success')
        onUnlocked()
      } else if (data?.status === 'failed') {
        stopPolling()
        setStep('failed')
        setError('Malipo hayakufanikiwa. Jaribu tena.')
      }
    }, POLL_INTERVAL_MS)
  }, [supabase, stopPolling, onUnlocked])

  useEffect(() => { return () => stopPolling() }, [stopPolling])

  // ── Initiate mobile payment ───────────────────────────────
  async function handleMobilePay(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/v1/payments/unlock/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          msisdn: phone,
          provider,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.already_unlocked) { setStep('success'); onUnlocked(); return }
        throw new Error(data.error ?? 'Imeshindwa kuanzisha malipo')
      }

      if (data.mock) { setStep('success'); onUnlocked(); return }

      setSecondsLeft(TIMEOUT_SECS)
      setStep('waiting')
      startPolling(data.unlock_id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setLoading(false)
    }
  }

  // ── Called by PaymentMethodSelector confirm button ────────
  // For cards: go to card_details step — do NOT pay yet
  // For mobile: go to phone input step
  function handleSelectorPay(method: PaymentProvider) {
    setProvider(method)
    if (method === 'visa' || method === 'mastercard') {
      setStep('card_details')   // ← STOP: wait for card form
      return
    }
    setStep('phone')
  }

  // ── Called AFTER CardDetailsForm submit ────────────────────
  async function handleCardSubmit(cardDetails: CardDetails) {
    void cardDetails
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/v1/payments/unlock/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, provider, payment_type: 'card' }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.already_unlocked) { setStep('success'); onUnlocked(); return }
        throw new Error(data.error ?? 'Imeshindwa kuanzisha malipo ya kadi')
      }
      if (data.mock) { setStep('success'); onUnlocked(); return }
      if (data.payment_url) { window.location.href = data.payment_url; return }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
      setStep('card_details')   // return to card form on error
    } finally {
      setLoading(false)
    }
  }

  function handleRetry() {
    setStep('select')
    setError('')
    setSecondsLeft(TIMEOUT_SECS)
    stopPolling()
  }

  const progressPct = ((TIMEOUT_SECS - secondsLeft) / TIMEOUT_SECS) * 100
  const pInfo = PROVIDERS[provider]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full max-w-md pb-10 overflow-hidden
                   animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* ── STEP: Provider selection ── */}
        {step === 'select' && (
          <div className="px-5 pt-1 pb-2">
            <h2 className="text-base font-bold text-gray-900 text-center mb-0.5">
              🔓 Fungua Contact ya Dalali
            </h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              Bei: <span className="font-semibold text-gray-700">Tsh {UNLOCK_AMOUNT.toLocaleString()}</span> · Lipa mara moja tu
            </p>

            {/* Listing info strip */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                {dalaliName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{dalaliName}</p>
                <p className="text-xs text-gray-400 truncate">{listingTitle}</p>
              </div>
              <p className="text-primary-600 font-bold text-sm flex-shrink-0">Tsh 2,000</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2.5 rounded-xl mb-4">
                {error}
              </div>
            )}

            <PaymentMethodSelector
              selected={provider}
              onSelect={v => v && setProvider(v)}
              amount={UNLOCK_AMOUNT}
              onPay={handleSelectorPay}
            />

            <button
              onClick={onClose}
              className="w-full py-3 mt-3 min-h-[44px] text-sm text-gray-400 text-center"
            >
              Ghairi
            </button>
          </div>
        )}

        {/* ── STEP: Phone input (mobile money) ── */}
        {step === 'phone' && (
          <div className="px-5 pt-2">
            {/* Back + provider badge */}
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setStep('select')} className="text-gray-400 text-lg">←</button>
              <div className="flex items-center gap-2">
                <span className="text-lg">{pInfo.icon}</span>
                <span className="text-sm font-semibold text-gray-800">{pInfo.name}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{pInfo.badge}</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleMobilePay} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">
                  Nambari ya {pInfo.name}
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">
                    🇹🇿 +255
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    placeholder={pInfo.hint.split(' ')[0] + ' XXX XXXX'}
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    maxLength={10}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                {pInfo.hint && (
                  <p className="text-xs text-gray-400 mt-1">Mfano: {pInfo.hint}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 9}
                className="w-full text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold
                           disabled:opacity-50 transition-all active:scale-[0.98]"
                style={{ background: phone.length >= 9 && !loading ? pInfo.btnColor : undefined,
                         backgroundColor: phone.length < 9 || loading ? '#9CA3AF' : undefined }}
              >
                {loading ? 'Inaanzisha...' : `Lipa Tsh ${UNLOCK_AMOUNT.toLocaleString()} na ${pInfo.name}`}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-3 mb-1">
              Utapata ombi la PIN kwenye simu yako
            </p>
            <button onClick={() => setStep('select')} className="w-full py-3 text-sm text-gray-400 text-center">
              ← Badilisha njia ya kulipa
            </button>
          </div>
        )}

        {/* ── STEP: Card details form (separate step, explicit) ── */}
        {step === 'card_details' && (
          <div className="px-5 pt-2 pb-4">
            {loading ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent
                                rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Inashughulikia malipo...</p>
              </div>
            ) : (
              <CardDetailsForm
                cardType={provider as 'visa' | 'mastercard'}
                amount={UNLOCK_AMOUNT}
                onBack={() => setStep('select')}
                onSubmit={handleCardSubmit}
              />
            )}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mt-4">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Waiting for STK Push ── */}
        {step === 'waiting' && (
          <div className="px-5 pt-2 text-center">
            <div className="text-4xl mb-3">📲</div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Angalia Simu Yako!</h2>
            <p className="text-sm text-gray-500 mb-1">
              Ombi la malipo limetumwa kwa
              <span className="font-semibold text-gray-700 ml-1">+255{phone}</span>
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Ingiza PIN yako ya <span className="font-semibold">{pInfo.name}</span>
            </p>

            {/* Progress bar */}
            <div className="bg-gray-100 rounded-full h-2 mb-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: pInfo.btnColor,
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mb-5">Inasubiri uthibitisho... ({secondsLeft}s)</p>

            <div className="flex justify-center mb-5">
              <div
                className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${pInfo.btnColor} transparent ${pInfo.btnColor} ${pInfo.btnColor}` }}
              />
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 text-left mb-4">
              <p className="font-semibold mb-1">Jinsi ya kuthibitisha:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Angalia SMS au ombi la USSD kwenye simu</li>
                <li>Ingiza PIN yako ya {pInfo.name}</li>
                <li>Thibitisha Tsh {UNLOCK_AMOUNT.toLocaleString()}</li>
              </ol>
            </div>

            <button onClick={handleRetry} className="text-sm text-gray-400 underline py-3">
              Badilisha njia ya kulipa
            </button>
          </div>
        )}

        {/* ── STEP: Success ── */}
        {step === 'success' && (
          <div className="px-5 pt-2 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Umefanikiwa!</h2>
            <p className="text-sm text-gray-500 mb-5">
              Sasa unaweza kuzungumza na{' '}
              <span className="font-semibold text-gray-800">{dalaliName}</span> moja kwa moja.
            </p>
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                         bg-green-500 text-white font-semibold text-sm shadow-md
                         active:scale-[0.97] transition-transform mb-3"
            >
              <span className="text-xl">💬</span>
              Fungua WhatsApp
            </a>
            <button onClick={onClose} className="w-full py-3 min-h-[44px] text-sm text-gray-400">
              Funga
            </button>
          </div>
        )}

        {/* ── STEP: Failed ── */}
        {step === 'failed' && (
          <div className="px-5 pt-2 text-center">
            <div className="text-5xl mb-3">❌</div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Malipo Hayakufanikiwa</h2>
            <p className="text-sm text-red-500 mb-5">{error}</p>
            <button
              onClick={handleRetry}
              className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold mb-3"
            >
              Jaribu Tena
            </button>
            <button onClick={onClose} className="w-full py-3 min-h-[44px] text-sm text-gray-400">
              Funga
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
