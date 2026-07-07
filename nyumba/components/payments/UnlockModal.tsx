'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import PaymentMethodSelector, { PAYMENT_METHODS } from '@/components/payments/PaymentMethodSelector'
import { detectProvider } from '@/lib/payments/azampay'
import type { PaymentMethod as PaymentProvider } from '@/components/payments/PaymentMethodSelector'
import { buildContactWhatsAppMessage } from '@/lib/utils/whatsappTemplates'

// ── Provider config ────────────────────────────────────────
const PROVIDERS = Object.fromEntries(
  PAYMENT_METHODS.map(m => [m.id, {
    name:     m.name,
    badge:    m.company,
    hint:     m.hint,
    iconSrc:  m.iconSrc,
    iconAlt:  m.iconAlt,
    iconChar: m.iconChar,
    btnColor: m.color,
    type:     m.type,
  }])
) as Record<PaymentProvider, {
  name: string; badge: string; hint: string; iconSrc: string;
  iconAlt: string; iconChar?: string; btnColor: string; type: 'mobile'
}>

// USSD codes shown in "how to confirm" section per provider
const USSD_CODES: Record<PaymentProvider, string> = {
  Mpesa:    '*150*00#',
  Airtel:   '*100#',
  Tigo:     '*150*00#',
  Halopesa: '*160*00#',
  Azampesa: '*150*00#',
}

// ── Types ─────────────────────────────────────────────────
type ModalStep = 'select' | 'phone' | 'waiting' | 'success' | 'failed'

// 3-stage progress during USSD wait
type UssdStage = 'sent' | 'confirm' | 'processing'

type Props = {
  listingId:        string
  dalaliName:       string
  listingTitle:     string
  listingPrice:     number
  listingLocation:  string
  listingBedrooms?: number
  onClose:          () => void
  onUnlocked:       (whatsappNumber: string) => void
}

async function getContactNumber(listingId: string): Promise<string> {
  try {
    const res = await fetch(`/api/v1/listings/${listingId}/contact`)
    if (!res.ok) return ''
    const json = await res.json() as { whatsapp_number?: string | null }
    return json.whatsapp_number ?? ''
  } catch { return '' }
}

const TIMEOUT_SECS          = 240
const CONTACT_FETCH_TIMEOUT = 10_000
const UNLOCK_AMOUNT         = 2000
// Seconds after which "Sikupata ombi" resend button appears
const RESEND_AFTER_SECS     = 60

function normalisePhone(raw: string): { normalized: string; valid: boolean } {
  const digits   = raw.replace(/\D/g, '')
  const stripped = digits.replace(/^(255|0)/, '')
  return { normalized: `255${stripped}`, valid: stripped.length === 9 }
}

export default function UnlockModal({
  listingId, dalaliName, listingTitle, listingPrice, listingLocation, listingBedrooms,
  onClose, onUnlocked,
}: Props) {
  const supabase = createClient()

  const [step, setStep]           = useState<ModalStep>('select')
  const [provider, setProvider]   = useState<PaymentProvider>('Mpesa')
  const [phone, setPhone]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [secondsLeft, setSecondsLeft]       = useState(TIMEOUT_SECS)
  const [secondsSinceSent, setSecondsSinceSent] = useState(0)
  const [ussdStage, setUssdStage] = useState<UssdStage>('sent')
  const [contactPhone, setContactPhone]       = useState<string | null>(null)
  const [contactTimedOut, setContactTimedOut] = useState(false)
  const userChoseProvider = useRef(false)

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const sentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Supabase realtime channel
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const waPhone = contactPhone?.replace(/\D/g, '').replace(/^0/, '255') ?? null
  const waMessage = buildContactWhatsAppMessage({
    dalaliName, listingTitle, listingLocation, listingPrice, listingId,
    bedrooms: listingBedrooms,
  })
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}` : null

  // ── Contact fetch timeout (shown after success if number slow) ─
  useEffect(() => {
    if (step !== 'success' || contactPhone !== null) return
    const t = setTimeout(() => setContactTimedOut(true), CONTACT_FETCH_TIMEOUT)
    return () => clearTimeout(t)
  }, [step, contactPhone])

  // ── Block Android back gesture during payment ──────────────
  useEffect(() => {
    if (step !== 'waiting') return
    history.pushState(null, '', window.location.href)
    const handle = () => history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [step])

  // ── Cleanup timers + channel on unmount ───────────────────
  const stopAll = useCallback(() => {
    if (timerRef.current)     clearInterval(timerRef.current)
    if (sentTimerRef.current) clearInterval(sentTimerRef.current)
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])
  useEffect(() => () => stopAll(), [stopAll])

  // ── Handle unlock confirmed / failed ──────────────────────
  const handleConfirmed = useCallback(async () => {
    stopAll()
    const number = await getContactNumber(listingId)
    setContactPhone(number || null)
    onUnlocked(number)
    setStep('success')
  }, [stopAll, listingId, onUnlocked])

  const handleFailed = useCallback((msg: string) => {
    stopAll()
    setError(msg)
    setStep('failed')
  }, [stopAll])

  // ── Countdown + USSD stage progression ──────────────────
  useEffect(() => {
    if (step !== 'waiting') return

    // Main countdown
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { handleFailed('Muda umeisha. Jaribu tena.'); return 0 }
        return s - 1
      })
    }, 1000)

    // Seconds since sent (for resend button + stage progression)
    sentTimerRef.current = setInterval(() => {
      setSecondsSinceSent(s => {
        const next = s + 1
        // Stage: 0–20s = sent, 20–80s = confirm, 80s+ = processing
        if (next === 20) setUssdStage('confirm')
        if (next === 80) setUssdStage('processing')
        return next
      })
    }, 1000)

    return () => {
      if (timerRef.current)     clearInterval(timerRef.current)
      if (sentTimerRef.current) clearInterval(sentTimerRef.current)
    }
  }, [step, handleFailed])

  // ── Supabase Realtime subscription for unlock status ──────
  const subscribeRealtime = useCallback((id: string) => {
    channelRef.current = supabase
      .channel(`unlock:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contact_unlocks', filter: `id=eq.${id}` },
        payload => {
          const status = (payload.new as { status?: string }).status
          if (status === 'completed') handleConfirmed()
          else if (status === 'failed') handleFailed('Malipo hayakufanikiwa. Jaribu tena.')
        },
      )
      .subscribe()
  }, [supabase, handleConfirmed, handleFailed])

  // ── Initiate USSD push ────────────────────────────────────
  async function handleMobilePay(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { normalized, valid } = normalisePhone(phone)
    if (!valid) { setError('Namba ya simu si sahihi. Mfano: 0744 123 456'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/payments/unlock/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ listing_id: listingId, msisdn: normalized, provider }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.already_unlocked) { await handleConfirmed(); return }
        throw new Error(data.error ?? 'Imeshindwa kuanzisha malipo')
      }

      if (data.mock) { await handleConfirmed(); return }

      setSecondsSinceSent(0)
      setUssdStage('sent')
      setSecondsLeft(TIMEOUT_SECS)
      setStep('waiting')
      subscribeRealtime(data.unlock_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setLoading(false)
    }
  }

  // ── Resend: re-initiate same listing with same phone ──────
  async function handleResend() {
    if (!phone) return
    setSecondsSinceSent(0)
    setUssdStage('sent')

    const { normalized } = normalisePhone(phone)
    try {
      await fetch('/api/v1/payments/unlock/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ listing_id: listingId, msisdn: normalized, provider }),
      })
    } catch { /* ignore — old channel still polling */ }
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
    stopAll()
    userChoseProvider.current = false
    setStep('select')
    setError('')
    setPhone('')
    setSecondsLeft(TIMEOUT_SECS)
    setSecondsSinceSent(0)
    setUssdStage('sent')
  }

  const pInfo = PROVIDERS[provider]
  const displayPhone = phone.replace(/^(255|0)/, '').replace(/^/, '0')
  const progressPct  = ((TIMEOUT_SECS - secondsLeft) / TIMEOUT_SECS) * 100

  const STAGES: { key: UssdStage; label: string }[] = [
    { key: 'sent',       label: 'Ombi Limetumwa' },
    { key: 'confirm',    label: 'Ingiza PIN' },
    { key: 'processing', label: 'Inathibitishwa' },
  ]
  const stageIndex = STAGES.findIndex(s => s.key === ussdStage)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={step === 'waiting' ? undefined : onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-md overflow-hidden
                   animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* ── SELECT ── */}
        {step === 'select' && (
          <div className="px-5 pt-1 pb-2">
            <h2 className="text-base font-bold text-gray-900 text-center mb-0.5">
              Fungua Contact ya Dalali
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

            <button onClick={onClose} className="w-full py-3 mt-3 min-h-[44px] text-sm text-gray-400 text-center">
              Ghairi
            </button>
          </div>
        )}

        {/* ── PHONE INPUT ── */}
        {step === 'phone' && (
          <div className="px-5 pt-2">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => { setStep('select'); setError('') }}
                aria-label="Rudi nyuma"
                className="text-gray-400 text-lg p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >←</button>
              <div className="flex items-center gap-2">
                {pInfo.iconSrc ? (
                  <Image src={pInfo.iconSrc} alt={pInfo.iconAlt} width={40} height={20} className="h-5 w-auto object-contain" />
                ) : pInfo.iconChar ? (
                  <span className="inline-flex items-center justify-center rounded px-2 h-5 text-xs font-extrabold text-white" style={{ backgroundColor: pInfo.btnColor }}>{pInfo.iconChar}</span>
                ) : null}
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
                <label htmlFor="unlock-phone" className="text-xs text-gray-500 mb-1.5 block">
                  Namba ya simu ya {pInfo.name}
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">
                    +255
                  </div>
                  <input
                    id="unlock-phone"
                    type="tel"
                    inputMode="numeric"
                    required
                    autoFocus
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

              {/* Per-provider USSD info */}
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-500 flex items-center gap-2">
                <i className="ti ti-info-circle text-primary-400 flex-shrink-0" aria-hidden="true" />
                <span>
                  Utapata prompt ya USSD <strong>{USSD_CODES[provider]}</strong> kwenye simu.
                  Ingiza PIN yako ya {pInfo.name} kuthibitisha.
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || normalisePhone(phone).normalized.length !== 12}
                className="w-full text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold
                           disabled:opacity-50 transition-all active:scale-[0.98]"
                style={{
                  backgroundColor:
                    loading || normalisePhone(phone).normalized.length !== 12
                      ? '#9CA3AF' : pInfo.btnColor,
                }}
              >
                {loading
                  ? 'Inatuma ombi...'
                  : `Tuma Ombi la USSD — Tsh ${UNLOCK_AMOUNT.toLocaleString()}`}
              </button>
            </form>

            <button onClick={() => { setStep('select'); setError('') }} className="w-full py-3 min-h-[44px] text-sm text-gray-400 text-center mt-1">
              ← Badilisha mtandao
            </button>
          </div>
        )}

        {/* ── WAITING ── */}
        {step === 'waiting' && (
          <div className="px-5 pt-2 pb-2">
            {/* Stage stepper */}
            <div className="flex items-center justify-between mb-5">
              {STAGES.map((s, i) => {
                const done    = i < stageIndex
                const current = i === stageIndex
                return (
                  <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500
                      ${done    ? 'bg-primary-500 text-white'
                      : current ? 'bg-primary-100 border-2 border-primary-500 text-primary-600'
                      :           'bg-gray-100 text-gray-400'}`}
                    >
                      {done
                        ? <i className="ti ti-check text-xs" aria-hidden="true" />
                        : current
                          ? <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse inline-block" />
                          : i + 1}
                    </div>
                    <span className={`text-[9px] font-medium text-center leading-tight
                      ${current ? 'text-primary-600' : done ? 'text-primary-400' : 'text-gray-400'}`}
                    >
                      {s.label}
                    </span>
                    {i < STAGES.length - 1 && (
                      <div className={`absolute left-0 h-0.5 transition-all duration-500 ${done ? 'bg-primary-400' : 'bg-gray-200'}`}
                        style={{ display: 'none' }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Phone animation */}
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-3">
                <i className="ti ti-device-mobile text-4xl text-primary-500" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Angalia Simu Yako!</h2>
              <p className="text-sm text-gray-500">
                Ombi la <span className="font-semibold">{pInfo.name}</span> limetumwa kwa
              </p>
              <p className="text-sm font-bold text-gray-800">+255{displayPhone.replace(/^0/, '')}</p>
            </div>

            {/* Step-specific message */}
            <div className={`rounded-xl px-4 py-3 mb-4 text-sm text-center transition-all duration-500
              ${ussdStage === 'sent'       ? 'bg-blue-50 text-blue-700'
              : ussdStage === 'confirm'    ? 'bg-amber-50 text-amber-700'
              :                             'bg-green-50 text-green-700'}`}
            >
              {ussdStage === 'sent'    && <>Subiri kidogo — USSD prompt inakuja kwenye simu yako (<strong>{USSD_CODES[provider]}</strong>)</>}
              {ussdStage === 'confirm' && <>Ingiza PIN yako ya <strong>{pInfo.name}</strong> kwenye simu yako ili kuthibitisha Tsh {UNLOCK_AMOUNT.toLocaleString()}</>}
              {ussdStage === 'processing' && <>Malipo yanashughulikiwa — usifunge dirisha hili</>}
            </div>

            {/* Progress bar */}
            <div className="bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${progressPct}%`, backgroundColor: pInfo.btnColor }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center mb-4">{secondsLeft}s iliyobaki</p>

            {/* Resend button — appears after 60s */}
            {secondsSinceSent >= RESEND_AFTER_SECS && (
              <button
                onClick={handleResend}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium mb-3 active:scale-[0.98] transition-all"
              >
                <i className="ti ti-refresh mr-1.5" aria-hidden="true" />
                Sijapata ombi — Tuma tena
              </button>
            )}

            <button
              onClick={handleRetry}
              className="w-full py-2 min-h-[44px] text-xs text-gray-400 text-center"
            >
              ← Badilisha mtandao au namba
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && (
          <div className="px-5 pt-2 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-3">
              <i className="ti ti-confetti text-4xl text-primary-500" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Umefanikiwa!</h2>
            <p className="text-sm text-gray-500 mb-5">
              Sasa unaweza kuwasiliana na{' '}
              <span className="font-semibold text-gray-800">{dalaliName}</span> moja kwa moja.
            </p>

            {waPhone ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <a
                    href={waUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl
                               bg-green-500 text-white font-semibold text-sm shadow-md
                               active:scale-[0.97] transition-transform"
                  >
                    <i className="ti ti-brand-whatsapp text-2xl" aria-hidden="true" />
                    <span>WhatsApp</span>
                    <span className="text-xs font-normal opacity-80">Na maelezo ya listing</span>
                  </a>
                  <a
                    href={`tel:+${waPhone}`}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl
                               bg-blue-500 text-white font-semibold text-sm shadow-md
                               active:scale-[0.97] transition-transform"
                  >
                    <i className="ti ti-phone text-2xl" aria-hidden="true" />
                    <span>Piga Simu</span>
                    <span className="text-xs font-normal opacity-80">Zungumza moja kwa moja</span>
                  </a>
                </div>
                <p className="text-xs text-gray-400 mb-3">Namba moja inatumika kwa njia zote mbili</p>
              </>
            ) : contactTimedOut ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-700 text-left">
                <p className="font-semibold mb-1">Mawasiliano hayakupakia</p>
                <p className="text-xs mb-2">Malipo yamefanikiwa. Piga simu support kwa usaidizi:</p>
                <a href="https://wa.me/255665831694" target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 underline">
                  <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp Support
                </a>
              </div>
            ) : (
              <div className="flex justify-center items-center gap-2 mb-5 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                <span>Inapakia mawasiliano...</span>
              </div>
            )}

            <button onClick={onClose} className="w-full py-3 min-h-[44px] text-sm text-gray-400">
              Funga
            </button>
          </div>
        )}

        {/* ── FAILED ── */}
        {step === 'failed' && (
          <div className="px-5 pt-2 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-3">
              <i className="ti ti-circle-x text-4xl text-red-500" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-2">Malipo Hayakufanikiwa</h2>
            <p className="text-sm text-red-500 mb-1">{error}</p>
            <p className="text-xs text-gray-400 mb-5">
              Hakikisha una salio la kutosha na mtandao unafanya kazi, kisha jaribu tena.
            </p>
            <button
              onClick={handleRetry}
              className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold mb-3
                         min-h-[48px] active:scale-[0.98] transition-transform shadow-md"
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
