'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { HistoryItem } from '@/app/(dalali)/dashboard/subscription/page'
import PaymentMethodSelector, { PAYMENT_METHODS } from '@/components/payments/PaymentMethodSelector'
import type { PaymentMethod as PaymentProvider } from '@/components/payments/PaymentMethodSelector'
import {
  SUBSCRIPTION_PLANS,
  PLAN_BADGES,
  getPlan,
  type PlanType,
} from '@/lib/config/subscription-plans'
import { useLanguage } from '@/lib/i18n/context'

const PAYMENT_PROVIDERS = PAYMENT_METHODS

const PLAN_ORDER: Record<string, number> = { free: 0, basic: 1, premium: 2, enterprise: 3 }

function getLoyaltyDiscount(months: number): number {
  if (months >= 12) return 20
  if (months >= 6)  return 15
  if (months >= 3)  return 10
  return 0
}

function applyDiscount(price: number, pct: number): number {
  return Math.round(price * (1 - pct / 100))
}

function fmt(n: number) { return n.toLocaleString() }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

type Props = {
  currentPlan: string | null
  currentStatus: string | null
  expiresAt: string | null
  gracePeriodUntil: string | null
  completedMonths: number
  history: HistoryItem[]
  isTrial?: boolean | null
  trialEndsAt?: string | null
  defaultPhone?: string
}

export default function SubscriptionClient({
  currentPlan, currentStatus, expiresAt, gracePeriodUntil, completedMonths, history,
  isTrial, trialEndsAt, defaultPhone,
}: Props) {
  const router = useRouter()
  const { t } = useLanguage()

  // Live pricing from DB — overrides static defaults when available
  const [livePrices, setLivePrices] = useState<Record<string, number>>({
    basic: 10_000, premium: 25_000, enterprise: 50_000,
  })
  useEffect(() => {
    fetch('/api/v1/pricing').then(r => r.json()).then(p => {
      if (p?.subscription) setLivePrices(p.subscription as Record<string, number>)
    }).catch(() => {})
  }, [])

  // Override plan.price with live prices before rendering
  const plans = SUBSCRIPTION_PLANS.map(p => ({
    ...p,
    price:             livePrices[p.id] ?? p.price,
    extraListingPrice: livePrices.extraListing ?? p.extraListingPrice,
  }))

  const [selectedPlan, setSelectedPlan] = useState<PlanType>(
    (currentPlan as PlanType) ?? 'basic'
  )
  const [step, setStep]             = useState<'overview' | 'new_plan' | 'provider' | 'phone' | 'renew_phone' | 'waiting' | 'success'>('overview')
  const [renewPlan, setRenewPlan]   = useState<PlanType | null>(null)
  const [provider, setProvider]     = useState<PaymentProvider>('Tigo')
  const [phone, setPhone]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [renewLoading, setRenewLoading] = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(120)

  // Auto-fill phone from dalali's WhatsApp number (stored as 255XXXXXXXXX)
  // Convert to local format 0XXXXXXXXX for display in M-Pesa input
  useEffect(() => {
    if (defaultPhone) {
      const local = defaultPhone.startsWith('255')
        ? '0' + defaultPhone.slice(3)
        : defaultPhone
      setPhone(local.replace(/\D/g, ''))
    }
  }, [defaultPhone])

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = createClient()

  const stopPolling = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const startPolling = useCallback((subId: string, onFail?: () => void) => {
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('id', subId)
        .single()
      if (data?.status === 'active') {
        stopPolling()
        setStep('success')
      } else if (data?.status === 'cancelled' || data?.status === 'failed') {
        stopPolling()
        setError(t('sub_err_pay_failed'))
        if (onFail) { onFail() } else { setStep('phone') }
      }
    }, 3000)
  }, [supabase, stopPolling, t])

  useEffect(() => {
    if (step !== 'waiting') return
    window.history.pushState({ __paymentLock: true }, '', window.location.href)
    const handle = () => window.history.pushState({ __paymentLock: true }, '', window.location.href)
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
    setSecondsLeft(120)
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          stopPolling()
          setError(t('sub_err_timeout'))
          setStep('phone')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step, stopPolling])

  useEffect(() => { return () => stopPolling() }, [stopPolling])

  useEffect(() => { setMounted(true) }, [])

  const discount      = getLoyaltyDiscount(completedMonths)
  const daysLeft      = mounted && expiresAt ? daysUntil(expiresAt) : null
  const graceDays     = mounted && gracePeriodUntil ? daysUntil(gracePeriodUntil) : null
  const trialDaysLeft = mounted && trialEndsAt ? daysUntil(trialEndsAt) : null
  const isActive      = currentStatus === 'active'
  const isGrace       = currentStatus === 'grace_period'
  const hasAnySub     = isActive || isGrace
  const isFree        = currentPlan === 'free'
  const isOnTrial     = !!(isTrial && isActive)
  const currentPlanData = getPlan(currentPlan)
  const renewPrice  = currentPlan && !isFree
    ? applyDiscount(livePrices[currentPlan] ?? currentPlanData.price, discount)
    : 0

  // Open phone-collection step for renewal (replaces old one-tap mock renewal)
  function handleRenew(plan?: PlanType) {
    setRenewPlan((plan ?? currentPlan) as PlanType)
    setPhone('')
    setError('')
    setStep('renew_phone')
  }

  // Submit renewal with real AzamPay checkout
  async function handleRenewSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const digits = phone.replace(/\D/g, '')
    if (!digits) { setError(t('sub_err_phone_empty')); return }
    const normalized = digits.startsWith('0') ? `255${digits.slice(1)}` : `255${digits}`
    if (!normalized.startsWith('255') || normalized.length !== 12) {
      setError(t('sub_err_phone_invalid'))
      return
    }

    setRenewLoading(true)
    try {
      const res = await fetch('/api/v1/payments/subscription/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: renewPlan, msisdn: normalized, provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa')
      setStep('waiting')
      startPolling(data.subscription_id, () => setStep('renew_phone'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setRenewLoading(false)
    }
  }

  // New subscription payment (mobile)
  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setRenewPlan(null)

    // Validate phone format before sending
    const digits = phone.replace(/\D/g, '')
    if (!digits) {
      setError(t('sub_err_phone_empty'))
      return
    }
    const normalized = digits.startsWith('0') ? `255${digits.slice(1)}` : `255${digits}`
    if (!normalized.startsWith('255') || normalized.length !== 12) {
      setError(t('sub_err_phone_invalid'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/payments/subscription/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan, msisdn: normalized, provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('sub_err_azampay'))
      if (data.mock) { setStep('success'); return }
      setStep('waiting')
      startPolling(data.subscription_id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('sub_err_network'))
    } finally {
      setLoading(false)
    }
  }

  // Mobile money only → phone step.
  function handleSelectorPay(method: PaymentProvider) {
    setProvider(method)
    setStep('phone')
  }

  // Plan badge for overview card
  const badge = PLAN_BADGES[currentPlan ?? 'free'] ?? PLAN_BADGES['free']

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3">
        <button onClick={() => step === 'overview' ? router.back() : setStep('overview')}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-90 transition-transform">
          ←
        </button>
        <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2"><i className="ti ti-credit-card" aria-hidden="true" />Subscription</h1>
      </div>

      {/* ── SUCCESS ── */}
      {step === 'success' && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-5xl mb-4 flex justify-center"><i className="ti ti-confetti text-primary-500" aria-hidden="true" /></div>
          <p className="text-lg font-bold text-gray-900 mb-2">{t('sub_success_title')}</p>
          <p className="text-sm text-gray-500 mb-6">{t('sub_success_sub')}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-primary-500 text-white px-8 py-3.5 rounded-2xl text-sm font-semibold active:scale-95 transition-all"
          >
            {t('sub_back_dashboard')}
          </button>
        </div>
      )}

      {/* ── PROVIDER SELECTION ── */}
      {step === 'provider' && (
        <div className="px-4 pt-4 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep('new_plan')} className="text-gray-400 text-lg">←</button>
            <p className="text-sm font-bold text-gray-900">{t('sub_choose_provider')}</p>
          </div>

          {/* Plan summary */}
          {(() => {
            const plan = getPlan(selectedPlan)
            const price = discount > 0 ? applyDiscount(plan.price, discount) : plan.price
            return (
              <div className="rounded-2xl p-3 mb-4 flex justify-between items-center"
                style={{ backgroundColor: plan.bgColor }}>
                <div>
                  <p className="text-xs text-gray-500">{t('sub_plan_selected')}</p>
                  <p className="text-sm font-bold text-gray-900"><><i className={`ti ti-${plan.icon}`} aria-hidden="true" /> {plan.name}</></p>
                </div>
                <p className="font-bold text-sm" style={{ color: plan.color }}>
                  Tsh {fmt(price)}{t('sub_per_month')}
                </p>
              </div>
            )
          })()}

          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

          <PaymentMethodSelector
            selected={provider}
            onSelect={v => setProvider(v)}
            amount={(() => {
              const p = getPlan(selectedPlan)
              return discount > 0 ? applyDiscount(p.price, discount) : p.price
            })()}
            onPay={handleSelectorPay}
          />
        </div>
      )}

      {/* ── PHONE ENTRY ── */}
      {step === 'phone' && (
        <div className="px-4 pt-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setStep('provider')} className="text-gray-400 text-base">←</button>
              {(() => {
                const p = PAYMENT_PROVIDERS.find(p => p.id === provider)
                return p ? (
                  <div className="flex items-center gap-1.5">
                    <Image src={p.iconSrc} alt={p.iconAlt} width={56} height={28} className="h-7 w-auto object-contain" />
                    <span className="text-sm font-bold text-gray-900">{t('sub_pay_with').replace('{{name}}', p.name)}</span>
                  </div>
                ) : <span className="text-sm font-bold text-gray-900">{t('sub_pay_mobile')}</span>
              })()}
            </div>
            {(() => {
              const p = getPlan(selectedPlan)
              const price = discount > 0 ? applyDiscount(p.price, discount) : p.price
              return (
                <p className="text-xs text-gray-400 mb-4">
                  Plan: {p.name} — Tsh {fmt(price)}
                  {discount > 0 && <span className="text-green-600 ml-1">(-{discount}%)</span>}
                </p>
              )
            })()}
            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  {t('sub_phone_label')}
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">
                    +255
                  </div>
                  <input type="tel" inputMode="numeric" required placeholder="7XX XXX XXX"
                    value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    maxLength={10}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={loading || phone.replace(/\D/g,'').length < 9}
                className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
                {loading ? t('sub_connecting') : t('sub_pay_now')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── RENEW PHONE ENTRY ── */}
      {step === 'renew_phone' && (
        <div className="px-4 pt-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => { setError(''); setStep('overview') }} className="text-gray-400 text-base">←</button>
              <span className="text-sm font-bold text-gray-900">{t('sub_renew_sub_title')}</span>
            </div>
            {renewPlan && (() => {
              const rp = getPlan(renewPlan)
              const price = discount > 0 ? applyDiscount(rp.price, discount) : rp.price
              return (
                <div className="rounded-xl p-3 mb-4 flex justify-between items-center"
                  style={{ backgroundColor: rp.bgColor }}>
                  <div>
                    <p className="text-xs text-gray-500">{t('sub_plan_renew')}</p>
                    <p className="text-sm font-bold text-gray-900"><><i className={`ti ti-${rp.icon}`} aria-hidden="true" /> {rp.name}</></p>
                  </div>
                  <p className="font-bold text-sm" style={{ color: rp.color }}>
                    Tsh {fmt(price)}{t('sub_per_month')}{discount > 0 ? ` (-${discount}%)` : ''}
                  </p>
                </div>
              )
            })()}

            <PaymentMethodSelector
              selected={provider}
              onSelect={v => setProvider(v)}
              amount={renewPlan ? applyDiscount(getPlan(renewPlan).price, discount) : 0}
              onPay={() => {}}
            />

            <form onSubmit={handleRenewSubmit} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  {t('sub_phone_pay_label')}
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">
                    +255
                  </div>
                  <input type="tel" inputMode="numeric" required placeholder="7XX XXX XXX"
                    value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    maxLength={10}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={renewLoading || phone.replace(/\D/g,'').length < 9}
                className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
                {renewLoading ? t('sub_connecting') : t('sub_pay_now')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── WAITING FOR USSD PUSH ── */}
      {step === 'waiting' && (
        <div className="px-4 pt-10 text-center">
          <div className="text-5xl mb-4 flex justify-center"><i className="ti ti-device-mobile text-primary-500" aria-hidden="true" /></div>
          <h2 className="text-base font-bold text-gray-900 mb-1">{t('sub_waiting_title')}</h2>

          {/* Success hint */}
          <div className="inline-flex items-center gap-1.5 bg-primary-50 border border-primary-100 text-primary-700
                          text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
            <i className="ti ti-circle-check" aria-hidden="true" /> {t('sub_waiting_hint')}
          </div>

          <p className="text-sm text-gray-500 mb-1">
            {t('sub_waiting_sent')}{' '}
            <span className="font-semibold text-gray-800">+255{phone.replace(/^0/, '')}</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {t('sub_waiting_enter_pin')}{' '}
            <span className="font-semibold">
              {PAYMENT_PROVIDERS.find(p => p.id === provider)?.name ?? provider}
            </span>{' '}
            {t('sub_waiting_confirm')}
          </p>

          <div className="bg-gray-100 rounded-full h-2 mb-1.5 overflow-hidden mx-6">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-1000"
              style={{ width: `${((120 - secondsLeft) / 120) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mb-6">{t('sub_waiting_checking')} ({secondsLeft}s)</p>

          <button
            onClick={() => { stopPolling(); setError(''); setStep(renewPlan ? 'renew_phone' : 'phone') }}
            className="text-sm text-primary-600 font-medium py-2 min-h-[44px] mb-3"
          >
            {t('sub_change_method')}
          </button>

          <div className="flex justify-center mb-6">
            <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 text-left mx-2 mb-4">
            <p className="font-semibold mb-1">{t('sub_how_confirm')}</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>{t('sub_confirm_step1')}</li>
              <li>{t('sub_confirm_step2').replace('{{name}}', PAYMENT_PROVIDERS.find(p => p.id === provider)?.name ?? provider)}</li>
              <li>{t('sub_confirm_step3')}</li>
            </ol>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mx-2 mb-3">
              <p className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-1"><i className="ti ti-circle-x" aria-hidden="true" />{t('sub_payment_failed_title')}</p>
              <p className="text-xs text-red-600">{error}</p>
              <button
                onClick={() => { stopPolling(); setError(''); setStep(renewPlan ? 'renew_phone' : 'phone') }}
                className="mt-2 w-full bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
              >
                <i className="ti ti-refresh" aria-hidden="true" /> {t('sub_retry_btn')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── NEW PLAN SELECTION — Cards za plans zote 4 ── */}
      {step === 'new_plan' && (
        <div className="px-4 pt-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

          {discount > 0 && (
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-3 flex items-center gap-3">
              <i className="ti ti-confetti text-primary-500 text-2xl" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-primary-800">{t('sub_loyalty_title').replace('{{n}}', String(completedMonths))}</p>
                <p className="text-xs text-primary-600">{t('sub_loyalty_discount').replace('{{n}}', String(discount))}</p>
              </div>
            </div>
          )}

          <p className="text-sm font-bold text-gray-800">{t('sub_choose_plan_title')}</p>

          {plans.map(plan => {
            const isCurrent = currentPlan === plan.id
            const isPaid    = plan.price > 0
            const isSelected = selectedPlan === plan.id
            const price = discount > 0 && isPaid
              ? applyDiscount(plan.price, discount)
              : plan.price

            return (
              <div
                key={plan.id}
                onClick={() => isPaid ? setSelectedPlan(plan.id) : undefined}
                className={`rounded-2xl border-2 overflow-hidden transition-all ${
                  isPaid ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
                } ${isSelected && isPaid ? 'ring-2 ring-offset-1' : ''}`}
                style={{
                  borderColor: plan.borderColor,
                  outlineColor: plan.color,
                  backgroundColor: 'white',
                }}
              >
                {/* "Inayopendwa zaidi" badge kwa Premium */}
                {plan.id === 'premium' && (
                  <div className="text-center py-1.5 text-white text-xs font-bold"
                    style={{ backgroundColor: plan.color }}>
                    <i className="ti ti-star-filled mr-1" aria-hidden="true" />{t('sub_popular_badge')}
                  </div>
                )}

                <div className="p-4">
                  {/* Plan header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: plan.bgColor }}>
                        <i className={`ti ti-${plan.icon}`} aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900">{plan.name}</p>
                          {isCurrent && (
                            <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                              style={{ backgroundColor: plan.color }}>
                              {t('sub_your_plan_badge')}
                            </span>
                          )}
                          {isSelected && !isCurrent && isPaid && (
                            <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium bg-primary-500">
                              {t('sub_selected_badge')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs">{plan.description}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      {plan.price === 0 ? (
                        <p className="font-bold text-lg text-gray-600">{t('sub_free_price')}</p>
                      ) : (
                        <>
                          <p className="font-bold text-lg" style={{ color: plan.color }}>
                            Tsh {fmt(price)}
                          </p>
                          {discount > 0 && (
                            <p className="text-xs text-gray-400 line-through">Tsh {fmt(plan.price)}</p>
                          )}
                          <p className="text-gray-400 text-xs">{t('sub_per_month')}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Key stats grid */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl mb-3"
                    style={{ backgroundColor: plan.bgColor }}>
                    <div className="text-center">
                      <p className="font-bold text-lg" style={{ color: plan.color }}>
                        {plan.listings}
                      </p>
                      <p className="text-xs text-gray-500">{t('sub_listings_label')}</p>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <p className="font-bold text-lg" style={{ color: plan.color }}>
                        {plan.photos}
                      </p>
                      <p className="text-xs text-gray-500">{t('sub_photos_label')}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg" style={{ color: plan.color }}>
                        {plan.limits.videos ? <i className="ti ti-check" aria-hidden="true" /> : <i className="ti ti-x" aria-hidden="true" />}
                      </p>
                      <p className="text-xs text-gray-500">{t('sub_video_label')}</p>
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="space-y-1.5 mb-3">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`text-sm flex-shrink-0 ${feature.included ? 'text-green-500' : 'text-gray-300'}`}>
                          {feature.included ? <i className="ti ti-check" aria-hidden="true" /> : <i className="ti ti-x" aria-hidden="true" />}
                        </span>
                        <span className={`text-xs ${
                          feature.included
                            ? feature.highlight ? 'font-semibold text-gray-800' : 'text-gray-600'
                            : 'text-gray-300 line-through'
                        }`}>
                          {feature.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Action area */}
                  {isCurrent ? (
                    <div className="w-full py-3 rounded-xl text-center text-sm font-semibold"
                      style={{ backgroundColor: plan.bgColor, color: plan.color }}>
                      <i className="ti ti-check" aria-hidden="true" /> {t('sub_current_plan_btn')}
                    </div>
                  ) : plan.price === 0 ? (
                    <div className="w-full py-3 rounded-xl text-center text-sm text-gray-400 bg-gray-50">
                      {t('sub_free_basic')}
                    </div>
                  ) : (
                    <div
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`w-full py-3 rounded-xl text-center text-sm font-semibold transition-all ${
                        isSelected
                          ? 'text-white'
                          : 'text-white opacity-70'
                      }`}
                      style={{ backgroundColor: plan.color }}
                    >
                      {isSelected
                        ? ((PLAN_ORDER[currentPlan ?? 'free'] ?? 0) < PLAN_ORDER[plan.id]
                            ? t('sub_upgrade_to').replace('{{name}}', plan.name)
                            : t('sub_downgrade_to').replace('{{name}}', plan.name))
                        : t('sub_select_plan').replace('{{name}}', plan.name)
                      }
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Note ya ulinganisho */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1 flex items-center gap-1"><i className="ti ti-bulb" aria-hidden="true" />{t('sub_tip_title')}</p>
            <p className="text-xs">
              {t('sub_tip_body').replace('{{price}}', livePrices.basic?.toLocaleString() ?? '10,000')}
            </p>
          </div>

          <button
            onClick={() => setStep('provider')}
            disabled={!selectedPlan || selectedPlan === currentPlan || selectedPlan === 'free'}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all"
          >
            {selectedPlan && selectedPlan !== 'free' ? t('sub_continue_with').replace('{{name}}', getPlan(selectedPlan).name) : t('sub_choose_first')}
          </button>
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {step === 'overview' && (
        <div className="px-4 pt-5 space-y-4">

          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

          {/* ── Grace period banner ── */}
          {isGrace && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4">
              <p className="font-bold text-yellow-800 mb-1 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" />{t('sub_grace_title')}</p>
              <p className="text-sm text-yellow-700 mb-1">
                {t('sub_grace_days').replace('{{n}}', String(Math.max(0, graceDays ?? 0)))}
              </p>
              <p className="text-xs text-yellow-600 mb-4">
                {t('sub_grace_visible')}
              </p>
              <button onClick={() => handleRenew()} disabled={renewLoading}
                className="w-full bg-yellow-500 text-white py-3.5 rounded-2xl text-sm font-bold disabled:opacity-60 active:scale-[0.97] transition-all">
                {renewLoading ? t('sub_renew_loading') : t('sub_renew_now_price').replace('{{price}}', fmt(renewPrice))}
              </button>
              {discount > 0 && <p className="text-xs text-yellow-600 text-center mt-1">{t('sub_loyalty_applied').replace('{{n}}', String(discount))}</p>}
            </div>
          )}

          {/* ── Trial subscription card ── */}
          {isOnTrial && trialEndsAt && (
            <div className="rounded-2xl p-4 border-2 border-green-300 bg-green-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <i className="ti ti-confetti text-primary-500 text-2xl" aria-hidden="true" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-green-900">{t('sub_trial_title')}</p>
                      <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-medium">
                        {t('sub_active_badge')}
                      </span>
                    </div>
                    <p className="text-xs text-green-700">{t('sub_trial_plan_desc')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    (trialDaysLeft ?? 0) <= 3 ? 'text-red-600'
                    : (trialDaysLeft ?? 0) <= 7 ? 'text-amber-600'
                    : 'text-green-700'
                  }`}>
                    {Math.max(0, trialDaysLeft ?? 0)}
                  </p>
                  <p className="text-xs text-green-600">{t('sub_days_left')}</p>
                </div>
              </div>

              <p className="text-xs text-green-700 mb-1" suppressHydrationWarning>
                {t('sub_trial_expires').replace('{{date}}', fmtDate(trialEndsAt))}
              </p>
              <p className="text-xs text-green-600 mb-4">
                {t('sub_trial_free_after')}
              </p>

              {(trialDaysLeft ?? 0) <= 7 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 mb-3 text-xs text-amber-700">
                  <i className="ti ti-alert-triangle" aria-hidden="true" /> {t('sub_trial_warning')}
                </div>
              )}

              <button
                onClick={() => { setSelectedPlan('basic'); setStep('new_plan') }}
                className="w-full py-3 rounded-2xl text-sm font-semibold active:scale-[0.97] transition-all text-white bg-green-600"
              >
                <i className="ti ti-rocket" aria-hidden="true" /> {t('sub_upgrade_now_price').replace('{{price}}', livePrices.basic?.toLocaleString() ?? '10,000')}
              </button>
            </div>
          )}

          {/* ── Active subscription card (paid, non-trial) ── */}
          {isActive && !isFree && !isOnTrial && daysLeft !== null && (
            <div className="rounded-2xl p-4 border"
              style={{
                backgroundColor: currentPlanData.bgColor,
                borderColor: currentPlanData.borderColor,
              }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <i className={`ti ti-${currentPlanData.icon} text-2xl`} aria-hidden="true" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{currentPlanData.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: currentPlanData.color }}>
                        {t('sub_active_badge')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${daysLeft <= 7 ? 'text-red-600' : daysLeft <= 14 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {daysLeft}
                  </p>
                  <p className="text-xs text-gray-400">{t('sub_days_left')}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3" suppressHydrationWarning>
                {expiresAt ? t('sub_expires_label').replace('{{date}}', fmtDate(expiresAt)) : '—'}
              </p>

              {daysLeft <= 7 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-2 mb-3 text-xs text-red-600">
                  <i className="ti ti-alert-triangle" aria-hidden="true" /> {t('sub_expiry_warning')}
                </div>
              )}

              <button onClick={() => handleRenew()} disabled={renewLoading}
                className="w-full py-3 rounded-2xl text-sm font-semibold disabled:opacity-60 active:scale-[0.97] transition-all text-white"
                style={{ backgroundColor: currentPlanData.color }}>
                {renewLoading ? t('sub_renew_loading') : t('sub_early_renew').replace('{{price}}', fmt(renewPrice))}
              </button>
              {discount > 0 && (
                <p className="text-xs text-gray-500 text-center mt-1">
                  {t('sub_discount_saving').replace('{{n}}', String(discount)).replace('{{amount}}', fmt(currentPlanData.price - renewPrice))}
                </p>
              )}
            </div>
          )}

          {/* ── Free plan card ── */}
          {isActive && isFree && (
            <div className="rounded-2xl p-4 border-2 border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <i className="ti ti-home text-2xl" aria-hidden="true" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-700">{t('sub_free_plan_title')}</p>
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{t('sub_always_free')}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t('sub_free_limits')}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {t('sub_free_upgrade_hint')}
              </p>
            </div>
          )}

          {/* Loyalty discount info */}
          {discount > 0 && currentPlan && !isFree && (
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-3 flex items-center gap-3">
              <i className="ti ti-confetti text-primary-500 text-2xl" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-primary-800">{t('sub_loyalty_thanks')}</p>
                <p className="text-xs text-primary-600">
                  {t('sub_loyalty_months').replace('{{n}}', String(completedMonths)).replace('{{n2}}', String(discount))}
                </p>
                <p className="text-xs font-semibold text-primary-700 mt-0.5">
                  {t('sub_loyalty_saving_mo').replace('{{amount}}', fmt(currentPlanData.price - renewPrice))}
                </p>
              </div>
            </div>
          )}

          {/* Plan badge summary */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{ backgroundColor: badge.bg, color: badge.color }}>
              {badge.label.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">{t('sub_current_plan_label')}</p>
              <p className="font-semibold text-sm" style={{ color: badge.color }}>{badge.label}</p>
            </div>
            <button onClick={() => setStep('new_plan')}
              className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
              style={{ backgroundColor: badge.color }}>
              {t('sub_change_plan_btn')}
            </button>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {/* Upgrade shortcuts */}
            {(!currentPlan || isFree) && (
              <button onClick={() => { setSelectedPlan('basic'); setStep('new_plan') }}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-primary-50 border border-primary-100 active:scale-[0.97] transition-all">
                <div className="flex items-center gap-3">
                  <i className="ti ti-rocket text-xl" aria-hidden="true" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">{t('sub_upgrade_basic')}</p>
                    <p className="text-xs text-gray-500">{t('sub_upgrade_basic_desc').replace('{{price}}', livePrices.basic?.toLocaleString() ?? '10,000')}</p>
                  </div>
                </div>
                <span className="text-primary-500 font-bold">→</span>
              </button>
            )}

            {hasAnySub && !isFree && currentPlan !== 'enterprise' && (
              <button onClick={() => { setSelectedPlan('enterprise'); setStep('new_plan') }}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-purple-50 border border-purple-100 active:scale-[0.97] transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⬆️</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">{t('sub_upgrade_enterprise')}</p>
                    <p className="text-xs text-gray-500">{t('sub_upgrade_enterprise_desc').replace('{{price}}', fmt(applyDiscount(livePrices.enterprise ?? 50_000, discount))).replace('{{discount}}', discount > 0 ? ` (-${discount}%)` : '')}</p>
                  </div>
                </div>
                <span className="text-purple-500 font-bold">→</span>
              </button>
            )}

            {hasAnySub && !isFree && currentPlan !== 'premium' && PLAN_ORDER[currentPlan ?? 'free'] < PLAN_ORDER['premium'] && (
              <button onClick={() => { setSelectedPlan('premium'); setStep('new_plan') }}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-amber-50 border border-amber-100 active:scale-[0.97] transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⬆️</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">{t('sub_upgrade_premium')}</p>
                    <p className="text-xs text-gray-500">{t('sub_upgrade_premium_desc').replace('{{price}}', fmt(applyDiscount(livePrices.premium ?? 25_000, discount))).replace('{{discount}}', discount > 0 ? ` (-${discount}%)` : '')}</p>
                  </div>
                </div>
                <span className="text-amber-500 font-bold">→</span>
              </button>
            )}

            <button onClick={() => setStep('new_plan')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-medium active:scale-[0.97] transition-all">
              <i className="ti ti-clipboard-list" aria-hidden="true" /> {t('sub_view_all_plans')}
            </button>
          </div>

          {/* Payment history */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{t('sub_history_title')}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {history.map(h => {
                  const hPlan = getPlan(h.plan)
                  return (
                    <div key={h.id} className="px-4 py-3 flex items-center gap-3">
                      <i className={`ti ti-${hPlan.icon} text-lg`} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900">{hPlan.name}</p>
                        <p className="text-xs text-gray-400" suppressHydrationWarning>
                          {h.starts_at ? fmtDate(h.starts_at) : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-800">
                          {h.amount_paid ? `Tsh ${fmt(h.amount_paid)}` : h.plan === 'free' ? t('sub_history_free') : '—'}
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          h.status === 'active' ? 'bg-primary-50 text-primary-600' :
                          h.status === 'grace_period' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {h.status === 'active' ? t('sub_status_active') : h.status === 'grace_period' ? t('sub_status_grace') : t('sub_status_expired')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
