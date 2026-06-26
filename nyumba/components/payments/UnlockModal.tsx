'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PaymentMethodSelector, { PAYMENT_METHODS } from '@/components/payments/PaymentMethodSelector'
import { detectProvider } from '@/lib/payments/azampay'
import type { PaymentMethod as PaymentProvider } from '@/components/payments/PaymentMethodSelector'

// ── Provider config (keyed for quick lookup) ──────────────
const PROVIDERS = Object.fromEntries(
  PAYMENT_METHODS.map(m => [m.id, {
    name:     m.name,
    badge:    m.company,
    hint:     m.hint,
    iconSrc:  m.iconSrc,
    iconAlt:  m.iconAlt,
    btnColor: m.color,
    type:     m.type,
  }])
) as Record<PaymentProvider, { name: string; badge: string; hint: string; iconSrc: string; iconAlt: string; btnColor: string; type: 'mobile' }>

// ── Types ─────────────────────────────────────────────────
type ModalStep = 'select' | 'phone' | 'waiting' | 'success' | 'failed'

type Props = {
  listingId: string
  dalaliName: string
  listingTitle: string
  listingPrice: number
  listingLocation: string
  listingBedrooms?: number
  whatsappNumber: string
  onClose: () => void
  onUnlocked: () => void
}

const POLL_INTERVAL_MS = 3000
const TIMEOUT_SECS     = 120
const UNLOCK_AMOUNT    = 2000

// Normalise any phone input → 255XXXXXXXXX (9 subscriber digits)
function normalisePhone(raw: string): { normalized: string; valid: boolean } {
  const digits = raw.replace(/\D/g, '')
  // Strip any leading country code (255) or leading zero
  const stripped = digits.replace(/^(255|0)/, '')
  const normalized = `255${stripped}`
  return { normalized, valid: stripped.length === 9 }
}

export default function UnlockModal({
  listingId, dalaliName, listingTitle, listingPrice, listingLocation, listingBedrooms,
  whatsappNumber, onClose, onUnlocked,
}: Props) {
  const supabase = createClient()

  const [step, setStep]           = useState<ModalStep>('select')
  const [provider, setProvider]   = useState<PaymentProvider>('Mpesa')
  const [phone, setPhone]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECS)
  const userChoseProvider = useRef(false)

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Normalise the dalali's WhatsApp number once for all links
  const waPhone = whatsappNumber.replace(/\D/g, '').replace(/^0/, '255')

  // Pre-filled WhatsApp message with listing details
  const bedroomLine = listingBedrooms ? `\n🛏️ Vyumba ${listingBedrooms}` : ''
  const waMessage = `Habari ${dalaliName}! 👋\n\nNimefungua mawasiliano yako kwenye NyumbaFasta na ninapenda kujua zaidi kuhusu:\n\n🏠 *${listingTitle}*\n📍 ${listingLocation}${bedroomLine}\n💰 TZS ${listingPrice.toLocaleString()}/mwezi\n\n🔗 https://nyumbafasta.co/listings/${listingId}\n\nJe, nyumba hii bado inapatikana? Ningependa kuitembelea.`
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`

  // ── Block Android back-gesture during payment ─────────────
  useEffect(() => {
    if (step !== 'waiting') return
    history.pushState(null, '', window.location.href)
    function handlePop() {
      history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [step])

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

    const { normalized, valid } = normalisePhone(phone)
    if (!valid) {
      setError('Namba ya simu si sahihi. Mfano: 0744 123 456')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/payments/unlock/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          msisdn: normalized,
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

  function handleSelectorPay(method: PaymentProvider) {
    userChoseProvider.current = true
    setProvider(method)
    setStep('phone')
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, '')
    setPhone(digits)
    if (!userChoseProvider.current && digits.length >= 9) {
      const { normalized } = normalisePhone(digits)
      setProvider(detectProvider(normalized))
    }
  }

  function handleRetry() {
    userChoseProvider.current = false
    setStep('select')
    setError('')
    setPhone('')
    setSecondsLeft(TIMEOUT_SECS)
    stopPolling()
  }

  const progressPct = ((TIMEOUT_SECS - secondsLeft) / TIMEOUT_SECS) * 100
  const pInfo = PROVIDERS[provider]

  // Display phone in waiting step (strip leading digits to show local form)
  const displayPhone = phone.replace(/^(255|0)/, '').replace(/^/, '0')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={step === 'waiting' ? undefined : onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-md pb-10 overflow-hidden
                   animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
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

        {/* ── STEP: Phone input ── */}
        {step === 'phone' && (
          <div className="px-5 pt-2">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setStep('select')}
                aria-label="Rudi nyuma"
                className="text-gray-400 text-lg p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ←
              </button>
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pInfo.iconSrc} alt={pInfo.iconAlt} className="h-5 w-auto object-contain" />
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
                    onChange={e => handlePhoneChange(e.target.value)}
                    maxLength={12}
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
                disabled={loading || normalisePhone(phone).normalized.length !== 12}
                className="w-full text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold
                           disabled:opacity-50 transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: loading || normalisePhone(phone).normalized.length !== 12
                    ? '#9CA3AF'
                    : pInfo.btnColor,
                }}
              >
                {loading ? 'Inaanzisha...' : `Lipa Tsh ${UNLOCK_AMOUNT.toLocaleString()} na ${pInfo.name}`}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-3 mb-1">
              Utapata ombi la PIN kwenye simu yako
            </p>
            <button
              onClick={() => setStep('select')}
              className="w-full py-3 min-h-[44px] text-sm text-gray-400 text-center"
            >
              ← Badilisha njia ya kulipa
            </button>
          </div>
        )}

        {/* ── STEP: Waiting ── */}
        {step === 'waiting' && (
          <div className="px-5 pt-2 text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-xs text-amber-700 font-medium">
              ⚠️ Usifunge — malipo yanashughulikiwa
            </div>
            <div className="text-4xl mb-3">📲</div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Angalia Simu Yako!</h2>
            <p className="text-sm text-gray-500 mb-1">
              Ombi la malipo limetumwa kwa
              <span className="font-semibold text-gray-700 ml-1">+255{displayPhone.replace(/^0/, '')}</span>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Ingiza PIN yako ya <span className="font-semibold">{pInfo.name}</span>
            </p>

            <button
              onClick={handleRetry}
              className="text-sm text-primary-600 font-medium py-2 min-h-[44px] mb-3"
            >
              ← Badilisha njia ya kulipa
            </button>

            <div className="bg-gray-100 rounded-full h-2 mb-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${progressPct}%`, backgroundColor: pInfo.btnColor }}
              />
            </div>
            <p className="text-xs text-gray-400 mb-5">Inasubiri uthibitisho... ({secondsLeft}s)</p>

            <div className="flex justify-center mb-5">
              <div
                className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${pInfo.btnColor} transparent ${pInfo.btnColor} ${pInfo.btnColor}` }}
              />
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-left mb-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">Jinsi ya kuthibitisha:</p>
              <div className="space-y-1.5">
                {[
                  `Angalia SMS au ombi la USSD kwenye simu`,
                  `Ingiza PIN yako ya ${pInfo.name}`,
                  `Thibitisha Tsh ${UNLOCK_AMOUNT.toLocaleString()}`,
                ].map((step, i) => (
                  <div key={i} className="flex gap-2 text-xs text-amber-700">
                    <span className="flex-shrink-0 font-bold">{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Success ── */}
        {step === 'success' && (
          <div className="px-5 pt-2 text-center">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Umefanikiwa!</h2>
            <p className="text-sm text-gray-500 mb-5">
              Sasa unaweza kuwasiliana na{' '}
              <span className="font-semibold text-gray-800">{dalaliName}</span> moja kwa moja.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl
                           bg-green-500 text-white font-semibold text-sm shadow-md
                           active:scale-[0.97] transition-transform"
              >
                <span className="text-2xl leading-none">💬</span>
                <span>WhatsApp</span>
                <span className="text-xs font-normal opacity-80">Na maelezo ya listing</span>
              </a>
              <a
                href={`tel:+${waPhone}`}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl
                           bg-blue-500 text-white font-semibold text-sm shadow-md
                           active:scale-[0.97] transition-transform"
              >
                <span className="text-2xl leading-none">📞</span>
                <span>Piga Simu</span>
                <span className="text-xs font-normal opacity-80">Zungumza moja kwa moja</span>
              </a>
            </div>
            <p className="text-xs text-gray-400 mb-3">Namba moja inatumika kwa njia zote mbili</p>
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
