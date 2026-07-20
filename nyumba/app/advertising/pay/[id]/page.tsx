'use client'
import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import PaymentMethodSelector, { PAYMENT_METHODS } from '@/components/payments/PaymentMethodSelector'
import { detectProvider } from '@/lib/payments/azampay'
import type { PaymentMethod as PaymentProvider } from '@/components/payments/PaymentMethodSelector'

const PROVIDERS = Object.fromEntries(
  PAYMENT_METHODS.map(m => [m.id, {
    name:     m.name,
    badge:    m.company,
    hint:     m.hint,
    iconSrc:  m.iconSrc,
    iconAlt:  m.iconAlt,
    iconChar: m.iconChar,
    btnColor: m.color,
  }])
) as Record<PaymentProvider, {
  name: string; badge: string; hint: string
  iconSrc: string; iconAlt: string; iconChar?: string; btnColor: string
}>

type Campaign = {
  id: string; title: string; ad_type: string; status: string; payment_status: string
  plan: { name: string; price_tzs: number; duration_days: number } | null
}

type Step = 'select' | 'phone' | 'waiting' | 'success' | 'failed'

const TIMEOUT_SECS      = 240
const RESEND_AFTER_SECS = 70

function normalisePhone(raw: string): { normalized: string; valid: boolean } {
  const digits   = raw.replace(/\D/g, '')
  const stripped = digits.replace(/^(255|0)/, '')
  return { normalized: `255${stripped}`, valid: stripped.length === 9 }
}

function UssdPreview({ amount, provider }: { amount: number; provider: PaymentProvider }) {
  const names: Record<PaymentProvider, string> = {
    Mpesa: 'M-PESA', Airtel: 'AIRTEL MONEY', Tigo: 'TIGO PESA',
    Halopesa: 'HALOPESA', Azampesa: 'AZAMPESA',
  }
  return (
    <div className="mx-auto max-w-[220px] bg-gray-900 rounded-2xl p-1 shadow-xl">
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="flex justify-between items-center px-3 pt-2 pb-1">
          <span className="text-[9px] text-gray-400 font-medium">9:41</span>
          <div className="flex gap-1 items-center">
            <div className="flex gap-0.5 items-end h-3">
              {[2,3,4,5].map(h => <div key={h} className="w-1 rounded-sm bg-gray-400" style={{height: h*2}} />)}
            </div>
            <span className="text-[9px] text-gray-400">●●</span>
          </div>
        </div>
        <div className="bg-gray-700 mx-2 mb-2 rounded-xl px-3 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-primary-500 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">NYF</div>
            <div>
              <p className="text-[10px] font-bold text-white leading-tight">{names[provider]}</p>
              <p className="text-[8px] text-gray-400">Sasa hivi</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-200 leading-snug mb-2">
            Weka namba ya siri kukamilisha malipo ya{' '}
            <span className="text-white font-bold">Tsh {amount.toLocaleString()}</span>{' '}
            kwenda <span className="text-primary-300 font-bold">NyumbaFasta</span>
          </p>
          <div className="flex gap-1.5 mt-2">
            <div className="flex-1 bg-gray-600 rounded-lg py-1 text-center text-[9px] font-bold text-gray-300">Kataa</div>
            <div className="flex-1 bg-primary-500 rounded-lg py-1 text-center text-[9px] font-bold text-white">Thibitisha</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PayCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const supabase = createClient()

  const [campaign, setCampaign]           = useState<Campaign | null>(null)
  const [loadError, setLoadError]         = useState('')
  const [step, setStep]                   = useState<Step>('select')
  const [provider, setProvider]           = useState<PaymentProvider>('Mpesa')
  const [phone, setPhone]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [paymentId, setPaymentId]         = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft]     = useState(TIMEOUT_SECS)
  const [secondsSinceSent, setSecondsSinceSent] = useState(0)

  const userChoseProvider = useRef(false)
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null)
  const sentTimer         = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef        = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    fetch(`/api/v1/advertising/campaigns/${id}`)
      .then(r => r.json())
      .then(d => {
        if (!d.campaign) { setLoadError('Kampeni haikupatikana'); return }
        if (d.campaign.payment_status === 'completed') {
          router.replace('/advertising/dashboard?paid=1')
          return
        }
        setCampaign(d.campaign)
      })
      .catch(() => setLoadError('Imeshindwa kupakua data ya kampeni'))
  }, [id, router])

  const stopAll = useCallback(() => {
    if (timerRef.current)  clearInterval(timerRef.current)
    if (sentTimer.current) clearInterval(sentTimer.current)
    if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null }
  }, [])
  useEffect(() => () => stopAll(), [stopAll])

  const handleSuccess = useCallback(() => {
    stopAll()
    setStep('success')
    setTimeout(() => router.push('/advertising/dashboard?paid=1'), 3000)
  }, [stopAll, router])

  const handleFailed = useCallback((msg: string) => {
    stopAll()
    setError(msg)
    setStep('failed')
  }, [stopAll])

  useEffect(() => {
    if (step !== 'waiting') return
    history.pushState({ __paymentLock: true }, '', window.location.href)
    const handle = () => history.pushState({ __paymentLock: true }, '', window.location.href)
    window.addEventListener('popstate', handle)
    return () => {
      window.removeEventListener('popstate', handle)
      if ((window.history.state as Record<string, unknown>)?.__paymentLock) {
        window.history.go(-1)
      }
    }
  }, [step])

  useEffect(() => {
    if (step !== 'waiting') return
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { handleFailed('Muda umeisha. Jaribu tena.'); return 0 }
        return s - 1
      })
    }, 1000)
    sentTimer.current = setInterval(() => setSecondsSinceSent(s => s + 1), 1000)
    return () => {
      if (timerRef.current)  clearInterval(timerRef.current)
      if (sentTimer.current) clearInterval(sentTimer.current)
    }
  }, [step, handleFailed])

  const subscribeRealtime = useCallback((pmtId: string) => {
    channelRef.current = supabase
      .channel(`ad_payment:${pmtId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ad_payments', filter: `id=eq.${pmtId}` },
        payload => {
          const status = (payload.new as { status?: string }).status
          if (status === 'completed') handleSuccess()
          else if (status === 'failed') handleFailed('Malipo hayakufanikiwa. Jaribu tena.')
        })
      .subscribe()
  }, [supabase, handleSuccess, handleFailed])

  async function submitPay(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { normalized, valid } = normalisePhone(phone)
    if (!valid) { setError('Namba ya simu si sahihi. Mfano: 0744 123 456'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/advertising/pay/initiate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id, phone: normalized, provider }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Imeshindwa kuanzisha malipo'); return }

      setPaymentId(d.payment_id)
      setSecondsSinceSent(0)
      setSecondsLeft(TIMEOUT_SECS)
      setStep('waiting')
      subscribeRealtime(d.payment_id)
    } catch {
      setError('Haikuweza kuunganika. Jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!phone) return
    setSecondsSinceSent(0)
    const { normalized } = normalisePhone(phone)
    try {
      const res = await fetch('/api/v1/advertising/pay/initiate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id, phone: normalized, provider }),
      })
      const d = await res.json()
      if (res.ok && d.payment_id && d.payment_id !== paymentId) {
        if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null }
        setPaymentId(d.payment_id)
        subscribeRealtime(d.payment_id)
      }
    } catch { /* existing realtime channel still active */ }
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
    setPaymentId(null)
    setStep('select'); setError(''); setPhone('')
    setSecondsLeft(TIMEOUT_SECS); setSecondsSinceSent(0)
  }

  if (loadError || (!campaign && !loadError)) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center text-gray-400">
        {loadError || (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        )}
      </div>
    )
  }

  const plan         = campaign!.plan
  const amount       = plan?.price_tzs ?? 0
  const pInfo        = PROVIDERS[provider]
  const progressPct  = ((TIMEOUT_SECS - secondsLeft) / TIMEOUT_SECS) * 100
  const displayPhone = phone.replace(/^(255|0)/, '').replace(/^/, '0')

  return (
    <div className="min-h-screen bg-gray-50 flex items-end sm:items-center justify-center pb-0 sm:py-8">
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-y-auto max-h-[92vh] sm:max-h-none
                   shadow-xl border border-gray-100"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* ── SELECT ── */}
        {step === 'select' && (
          <div className="px-5 pt-4 pb-2">
            <h1 className="text-base font-bold text-gray-900 text-center mb-0.5">Malipo ya Tangazo</h1>
            <p className="text-xs text-gray-400 text-center mb-4">
              {campaign!.title}
            </p>

            {plan && (
              <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3 mb-5">
                <div>
                  <p className="text-xs font-semibold text-gray-700">{plan.name}</p>
                  <p className="text-[11px] text-gray-400">Siku {plan.duration_days}</p>
                </div>
                <p className="text-primary-600 font-bold text-base">
                  Tsh {plan.price_tzs.toLocaleString()}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2.5 rounded-xl mb-4">{error}</div>
            )}

            <PaymentMethodSelector
              selected={provider}
              onSelect={v => v && setProvider(v)}
              amount={amount}
              onPay={handleSelectorPay}
            />

            <p className="text-[11px] text-center text-gray-400 mt-4">
              Malipo yanafanywa kwa usalama kupitia <strong>AzamPay</strong> Tanzania
            </p>
          </div>
        )}

        {/* ── PHONE INPUT ── */}
        {step === 'phone' && (
          <div className="px-5 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => { setStep('select'); setError('') }}
                aria-label="Rudi nyuma"
                className="text-gray-400 text-lg p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >←</button>
              <div className="flex items-center gap-2">
                {pInfo.iconSrc
                  ? <Image src={pInfo.iconSrc} alt={pInfo.iconAlt} width={40} height={20} className="h-5 w-auto object-contain" />
                  : pInfo.iconChar
                    ? <span className="inline-flex items-center justify-center rounded px-2 h-5 text-xs font-extrabold text-white" style={{ backgroundColor: pInfo.btnColor }}>{pInfo.iconChar}</span>
                    : null}
                <span className="text-sm font-semibold text-gray-800">{pInfo.name}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{pInfo.badge}</span>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[10px] text-gray-400 text-center mb-2 uppercase tracking-wide font-semibold">
                Utaona hivi kwenye simu yako
              </p>
              <UssdPreview amount={amount} provider={provider} />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
            )}

            <form onSubmit={submitPay} className="space-y-4">
              <div>
                <label htmlFor="pay-phone" className="text-xs text-gray-500 mb-1.5 block">
                  Namba ya simu ya {pInfo.name}
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">+255</div>
                  <input
                    id="pay-phone"
                    type="tel" inputMode="numeric" required
                    placeholder={pInfo.hint.split(' ')[0] + ' XXX XXXX'}
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    maxLength={12}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                {pInfo.hint && <p className="text-xs text-gray-400 mt-1">Mfano: {pInfo.hint}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || normalisePhone(phone).normalized.length !== 12}
                className="w-full text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold disabled:opacity-50 transition-all active:scale-[0.98]"
                style={{ backgroundColor: loading || normalisePhone(phone).normalized.length !== 12 ? '#9CA3AF' : pInfo.btnColor }}
              >
                {loading ? 'Inatuma ombi...' : `Lipa Tsh ${amount.toLocaleString()}`}
              </button>
            </form>

            <button
              onClick={() => { setStep('select'); setError('') }}
              className="w-full py-3 min-h-[44px] text-sm text-gray-400 text-center mt-1"
            >
              ← Badilisha mtandao
            </button>
          </div>
        )}

        {/* ── WAITING ── */}
        {step === 'waiting' && (
          <div className="px-5 pt-3 pb-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-xs text-amber-700 font-medium flex items-center gap-2">
              <i className="ti ti-alert-triangle flex-shrink-0" aria-hidden="true" />
              Usifunge — malipo yanashughulikiwa
            </div>

            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-3 relative">
                <i className="ti ti-device-mobile text-4xl text-primary-500" aria-hidden="true" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
                  <span className="w-2 h-2 bg-white rounded-full animate-ping absolute" />
                  <span className="w-2 h-2 bg-white rounded-full" />
                </span>
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Angalia Simu Yako!</h2>
              <p className="text-sm text-gray-500">
                Ombi la PIN limetumwa kwa <span className="font-bold text-gray-800">+255{displayPhone.replace(/^0/, '')}</span>
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-3">
                Ombi linalokungojea kwenye simu
              </p>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">NYF</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{pInfo.name} — NyumbaFasta</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Weka namba ya siri kukamilisha malipo ya{' '}
                    <span className="font-bold text-gray-800">Tsh {amount.toLocaleString()}</span>{' '}
                    kwenda <span className="text-primary-600 font-bold">NyumbaFasta</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <div className="flex-1 py-1.5 rounded-lg bg-gray-200 text-center text-xs font-semibold text-gray-500">Kataa</div>
                <div className="flex-1 py-1.5 rounded-lg bg-primary-500 text-center text-xs font-semibold text-white">Thibitisha →</div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {[
                { n: 1, text: 'Angalia simu yako — ombi la PIN limetumwa moja kwa moja', done: secondsSinceSent > 5 },
                { n: 2, text: 'Bonyeza "Thibitisha" na ingiza PIN yako', done: false },
                { n: 3, text: 'Tangazo lako litaanzishwa mara malipo yakikamilika', done: false },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-500
                    ${s.done ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {s.done ? <i className="ti ti-check text-xs" aria-hidden="true" /> : s.n}
                  </div>
                  <p className={`text-sm leading-tight pt-0.5 ${s.done ? 'text-gray-700' : 'text-gray-500'}`}>{s.text}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-100 rounded-full h-1.5 mb-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progressPct}%`, backgroundColor: pInfo.btnColor }} />
            </div>
            <p className="text-xs text-gray-400 text-center mb-4">Inasubiri uthibitisho... ({secondsLeft}s)</p>

            {secondsSinceSent >= RESEND_AFTER_SECS && (
              <button
                onClick={handleResend}
                className="w-full py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-sm text-primary-600 font-medium mb-3 active:scale-[0.98] transition-all"
              >
                <i className="ti ti-refresh mr-1.5" aria-hidden="true" />
                Sijapata ombi — Tuma tena
              </button>
            )}

            <button onClick={handleRetry} className="w-full py-2 min-h-[44px] text-xs text-gray-400 text-center">
              ← Badilisha mtandao au namba
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && (
          <div className="px-5 pt-4 text-center pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-3">
              <i className="ti ti-confetti text-4xl text-primary-500" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Malipo Yamefanikiwa!</h2>
            <p className="text-sm text-gray-500 mb-2">
              Tangazo lako <span className="font-semibold text-gray-800">{campaign!.title}</span> linaendelea.
            </p>
            <p className="text-xs text-gray-400 mb-5">Unabadilishwa kwenye dashibodi yako...</p>
            <div className="flex justify-center items-center gap-2 text-sm text-primary-600">
              <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
              <span>Tafadhali subiri...</span>
            </div>
          </div>
        )}

        {/* ── FAILED ── */}
        {step === 'failed' && (
          <div className="px-5 pt-4 text-center pb-2">
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
              className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold mb-3 min-h-[48px] active:scale-[0.98] transition-transform shadow-md"
            >
              Jaribu Tena
            </button>
            <button
              onClick={() => router.push('/advertising/dashboard')}
              className="w-full py-3 min-h-[44px] text-sm text-gray-400"
            >
              Rudi Dashibodi
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
