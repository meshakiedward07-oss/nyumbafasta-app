'use client'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

/* ─── Types ─────────────────────────────────────────────────── */

type SubscriptionRow = {
  id: string
  plan: string
  status: string
  amount_paid: number | null
  payment_ref: string | null
  starts_at: string | null
  expires_at: string | null
  created_at: string
}

type BoostRow = {
  id: string
  listing_id: string
  amount: number
  status: string
  payment_ref: string | null
  weeks: number
  boosted_until: string | null
  created_at: string
}

type ExtraRow = {
  id: string
  type: string
  amount: number
  status: string
  external_id: string | null
  created_at: string
}

type PaymentsData = {
  subscriptions: SubscriptionRow[]
  boosts:        BoostRow[]
  extras:        ExtraRow[]
}

type Tab = 'subscriptions' | 'boosts' | 'extras'

/* ─── Helpers ────────────────────────────────────────────────── */

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return `Tsh ${n.toLocaleString('en-TZ')}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function planLabel(plan: string) {
  if (plan === 'basic')      return 'Basic'
  if (plan === 'premium')    return 'Premium'
  if (plan === 'enterprise') return 'Enterprise'
  return plan
}

function typeLabel(type: string, t: (k: TKey) => string) {
  if (type === 'extra_listings') return t('pay_type_extra_listings')
  if (type === 'upgrade')        return t('pay_type_upgrade')
  return type
}

const STATUS_STYLE: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  completed:    'bg-green-100 text-green-700',
  confirmed:    'bg-green-100 text-green-700',
  pending:      'bg-yellow-100 text-yellow-700',
  failed:       'bg-red-100 text-red-700',
  expired:      'bg-gray-100 text-gray-500',
  grace_period: 'bg-orange-100 text-orange-700',
}

const STATUS_LABEL_KEYS: Record<string, TKey> = {
  active:       'pay_status_active',
  completed:    'pay_status_completed',
  confirmed:    'pay_status_confirmed',
  pending:      'pay_status_pending',
  failed:       'pay_status_failed',
  expired:      'pay_status_expired',
  grace_period: 'pay_status_grace',
}

function statusBadge(s: string, t: (k: TKey) => string) {
  const style    = STATUS_STYLE[s] ?? 'bg-gray-100 text-gray-500'
  const labelKey = STATUS_LABEL_KEYS[s]
  const label    = labelKey ? t(labelKey) : s
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${style}`}>
      {label}
    </span>
  )
}

function isRetryable(status: string) {
  return status === 'failed' || status === 'pending'
}

function isActive(status: string) {
  return status === 'active' || status === 'grace_period'
}

/* ─── Inline Retry Form ──────────────────────────────────────── */

type RetryTarget =
  | { kind: 'subscription'; plan: string }
  | { kind: 'boost';        listing_id: string; weeks: number }
  | { kind: 'extra';        count: number }

function parseExtraCount(externalId: string | null): number {
  if (!externalId || !externalId.startsWith('EX-')) return 1
  const parts = externalId.split('-')
  // Format: EX-{5 UUID segments}-{count}[-{suffix}] → count is at index 6
  if (parts.length >= 7) {
    const n = parseInt(parts[6], 10)
    return Number.isInteger(n) && n >= 1 ? n : 1
  }
  return 1
}

function RetryForm({ target, onClose }: { target: RetryTarget; onClose: () => void }) {
  const { t } = useLanguage()
  const [msisdn,   setMsisdn]   = useState('')
  const [provider, setProvider] = useState('Tigo')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    let url  = ''
    let body: Record<string, unknown> = { msisdn, provider }

    if (target.kind === 'subscription') {
      url  = '/api/v1/payments/subscription/initiate'
      body = { ...body, plan: target.plan }
    } else if (target.kind === 'boost') {
      url  = '/api/v1/payments/boost/initiate'
      body = { ...body, listing_id: target.listing_id, weeks: target.weeks }
    } else {
      url  = '/api/v1/payments/extra-listings'
      body = { ...body, count: target.count }
    }

    try {
      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? t('wiz_err_generic'))
      setMsg({ text: t('pay_retry_sent'), ok: true })
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : t('wiz_err_generic'), ok: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
      <p className="text-[11px] font-semibold text-gray-600">{t('pay_retry_title')}</p>

      <div className="flex gap-2">
        <input
          required
          type="tel"
          placeholder="0712 345 678"
          value={msisdn}
          onChange={e => setMsisdn(e.target.value)}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        />
        <select
          value={provider}
          onChange={e => setProvider(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        >
          <option value="Mpesa">M-Pesa</option>
          <option value="Airtel">Airtel</option>
          <option value="Tigo">Tigo</option>
          <option value="Halopesa">Halo</option>
        </select>
      </div>

      {msg && (
        <p className={`text-[10px] font-medium ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>
          {msg.ok ? '✓' : '✗'} {msg.text}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded-lg disabled:opacity-50 transition-all active:scale-[0.97]"
        >
          <i className={`ti ti-${loading ? 'loader-2 animate-spin' : 'send'}`} aria-hidden="true" />
          {loading ? t('pay_retry_sending') : t('pay_retry_submit')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
        >
          {t('pay_retry_close')}
        </button>
      </div>
    </form>
  )
}

/* ─── Cancel Subscription ────────────────────────────────────── */

function CancelButton({ subId, onDone }: { subId: string; onDone: () => void }) {
  const { t } = useLanguage()
  const [confirm,  setConfirm]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState<string | null>(null)

  async function cancel() {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/payments/subscription/cancel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription_id: subId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? t('wiz_err_generic'))
      setMsg(t('pay_cancelled'))
      onDone()
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : t('wiz_err_generic'))
    } finally {
      setLoading(false)
      setConfirm(false)
    }
  }

  if (msg) return <p className="text-[10px] text-red-600 font-medium mt-1">✗ {msg}</p>

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="mt-1 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 font-semibold transition-colors"
      >
        <i className="ti ti-x" aria-hidden="true" />
        {t('pay_cancel_sub')}
      </button>
    )
  }

  return (
    <div className="mt-2 bg-red-50 rounded-xl p-2.5 border border-red-100 space-y-2">
      <p className="text-[11px] text-red-700 font-medium">{t('pay_cancel_confirm')}</p>
      <div className="flex gap-2">
        <button
          onClick={cancel}
          disabled={loading}
          className="px-3 py-1 bg-red-600 text-white text-[11px] font-semibold rounded-lg disabled:opacity-50 active:scale-[0.97] transition-all"
        >
          {loading ? t('pay_cancelling') : t('pay_yes_cancel')}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="px-3 py-1 text-[11px] text-gray-500 rounded-lg hover:text-gray-700 transition-colors"
        >
          {t('pay_hapana')}
        </button>
      </div>
    </div>
  )
}

/* ─── Upgrade Modal ──────────────────────────────────────────── */

function UpgradeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useLanguage()
  const [msisdn,   setMsisdn]   = useState('')
  const [provider, setProvider] = useState('Tigo')
  const [plan,     setPlan]     = useState('premium')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const res  = await fetch('/api/v1/payments/subscription/upgrade', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ to_plan: plan, msisdn, provider }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? t('wiz_err_generic'))
      setMsg({ text: t('pay_upgrade_sent'), ok: true })
      setTimeout(() => { onDone(); onClose() }, 2000)
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : t('wiz_err_generic'), ok: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-sm">{t('pay_upgrade_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">{t('pay_new_plan')}</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="premium">Premium — Tsh 25,000/mwezi</option>
              <option value="enterprise">Enterprise — Tsh 50,000/mwezi</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">{t('pay_phone_label')}</label>
            <input
              required
              type="tel"
              placeholder="0712 345 678"
              value={msisdn}
              onChange={e => setMsisdn(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">{t('pay_provider_label')}</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="Mpesa">M-Pesa</option>
              <option value="Airtel">Airtel</option>
              <option value="Tigo">Tigo</option>
              <option value="Halopesa">Halo</option>
            </select>
          </div>

          {msg && (
            <p className={`text-xs font-medium ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>
              {msg.ok ? '✓' : '✗'} {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {loading ? t('pay_retry_sending') : t('pay_upgrade_pay_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function DalaliPaymentsPage() {
  const { t } = useLanguage()
  const [data,         setData]         = useState<PaymentsData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<Tab>('subscriptions')
  const [retryOpen,    setRetryOpen]    = useState<string | null>(null)
  const [upgradeOpen,  setUpgradeOpen]  = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/dalali/payments')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Loading ── */
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <i className="ti ti-loader-2 animate-spin text-primary-500 text-3xl" aria-hidden="true" />
        <p className="text-sm text-gray-400 mt-2">{t('pay_loading')}</p>
      </div>
    </div>
  )

  const subscriptions = data?.subscriptions ?? []
  const boosts        = data?.boosts ?? []
  const extras        = data?.extras ?? []

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'subscriptions', label: t('pay_tab_subscriptions'), count: subscriptions.length },
    { id: 'boosts',        label: t('pay_tab_boosts'),        count: boosts.length        },
    { id: 'extras',        label: t('pay_tab_extras'),        count: extras.length        },
  ]

  const activeBasic = subscriptions.find(s => s.plan === 'basic' && isActive(s.status))

  return (
    <>
      {upgradeOpen && (
        <UpgradeModal onClose={() => setUpgradeOpen(false)} onDone={loadData} />
      )}

      <div className="min-h-screen bg-gray-50 pb-24">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-100 px-4 pt-10 pb-5">
          <div className="flex items-center gap-3 mb-1">
            <i className="ti ti-credit-card text-primary-500 text-xl" aria-hidden="true" />
            <h1 className="text-lg font-bold text-gray-800">{t('pay_header_title')}</h1>
          </div>
          <p className="text-xs text-gray-400 ml-8">{t('pay_header_sub')}</p>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white border-b border-gray-100 flex sticky top-0 z-10 shadow-sm">
          {tabs.map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex-1 px-3 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === tabItem.id
                  ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50/30'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tabItem.label}
              {tabItem.count > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab === tabItem.id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tabItem.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">

          {/* ── Upgrade prompt on active Basic ── */}
          {tab === 'subscriptions' && activeBasic && (
            <div className="bg-gradient-to-r from-primary-50 to-green-50 rounded-2xl p-4 flex items-center justify-between border border-primary-100">
              <div>
                <p className="text-xs font-bold text-primary-700">{t('pay_has_basic')}</p>
                <p className="text-[10px] text-primary-500 mt-0.5">{t('pay_upgrade_prompt')}</p>
              </div>
              <button
                onClick={() => setUpgradeOpen(true)}
                className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white text-xs font-semibold rounded-xl active:scale-[0.97] transition-all"
              >
                <i className="ti ti-arrow-up-circle" aria-hidden="true" />
                {t('pay_upgrade_btn')}
              </button>
            </div>
          )}

          {/* ────── SUBSCRIPTIONS TAB ────── */}
          {tab === 'subscriptions' && (
            subscriptions.length === 0
              ? <EmptyCard label={t('pay_no_subscriptions')} icon="ti-credit-card-off" />
              : subscriptions.map(sub => (
                  <div key={sub.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <i className="ti ti-star text-primary-500 text-sm" aria-hidden="true" />
                          <p className="text-sm font-bold text-gray-800">{planLabel(sub.plan)}</p>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {fmtDate(sub.starts_at)} → {fmtDate(sub.expires_at)}
                        </p>
                        {sub.payment_ref && (
                          <p className="text-[10px] text-gray-300 font-mono mt-0.5">{sub.payment_ref.slice(0, 18)}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        {statusBadge(sub.status, t)}
                        <p className="text-xs font-bold text-gray-700">{fmtMoney(sub.amount_paid)}</p>
                        <p className="text-[10px] text-gray-300">{fmtDate(sub.created_at)}</p>
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      {sub.payment_ref && (
                        <a
                          href={`/payments/receipt/${sub.payment_ref}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-primary-600 border border-primary-200 bg-primary-50 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-primary-100 transition-colors"
                        >
                          <i className="ti ti-file-text" aria-hidden="true" />
                          {t('pay_receipt_btn')}
                        </a>
                      )}

                      {isActive(sub.status) && (
                        <CancelButton subId={sub.id} onDone={loadData} />
                      )}

                      {isRetryable(sub.status) && (
                        <button
                          onClick={() => setRetryOpen(retryOpen === sub.id ? null : sub.id)}
                          className="flex items-center gap-1 text-[11px] text-amber-700 border border-amber-200 bg-amber-50 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-100 transition-colors"
                        >
                          <i className="ti ti-refresh" aria-hidden="true" />
                          {t('pay_jaribu_tena')}
                        </button>
                      )}
                    </div>

                    {retryOpen === sub.id && (
                      <RetryForm
                        target={{ kind: 'subscription', plan: sub.plan }}
                        onClose={() => setRetryOpen(null)}
                      />
                    )}
                  </div>
                ))
          )}

          {/* ────── BOOSTS TAB ────── */}
          {tab === 'boosts' && (
            boosts.length === 0
              ? <EmptyCard label={t('pay_no_boosts')} icon="ti-rocket-off" />
              : boosts.map(b => (
                  <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <i className="ti ti-rocket text-orange-500 text-sm" aria-hidden="true" />
                          <p className="text-sm font-bold text-gray-800">
                            {t('pay_boost_weeks').replace('{{n}}', String(b.weeks))}
                          </p>
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {t('pay_boost_listing').replace('{{id}}', b.listing_id.slice(0, 8) + '…')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {t('pay_boost_until').replace('{{date}}', fmtDate(b.boosted_until))}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        {statusBadge(b.status, t)}
                        <p className="text-xs font-bold text-gray-700">{fmtMoney(b.amount)}</p>
                        <p className="text-[10px] text-gray-300">{fmtDate(b.created_at)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      {b.payment_ref && (
                        <a
                          href={`/payments/receipt/${b.payment_ref}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-primary-600 border border-primary-200 bg-primary-50 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-primary-100 transition-colors"
                        >
                          <i className="ti ti-file-text" aria-hidden="true" />
                          {t('pay_receipt_btn')}
                        </a>
                      )}

                      {isRetryable(b.status) && (
                        <button
                          onClick={() => setRetryOpen(retryOpen === b.id ? null : b.id)}
                          className="flex items-center gap-1 text-[11px] text-amber-700 border border-amber-200 bg-amber-50 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-100 transition-colors"
                        >
                          <i className="ti ti-refresh" aria-hidden="true" />
                          {t('pay_jaribu_tena')}
                        </button>
                      )}
                    </div>

                    {retryOpen === b.id && (
                      <RetryForm
                        target={{ kind: 'boost', listing_id: b.listing_id, weeks: b.weeks }}
                        onClose={() => setRetryOpen(null)}
                      />
                    )}
                  </div>
                ))
          )}

          {/* ────── EXTRAS TAB ────── */}
          {tab === 'extras' && (
            extras.length === 0
              ? <EmptyCard label={t('pay_no_extras')} icon="ti-box-off" />
              : extras.map(ex => (
                  <div key={ex.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <i className="ti ti-plus-circle text-blue-500 text-sm" aria-hidden="true" />
                          <p className="text-sm font-bold text-gray-800">{typeLabel(ex.type, t)}</p>
                        </div>
                        {ex.external_id && (
                          <p className="text-[10px] text-gray-300 font-mono">{ex.external_id.slice(0, 18)}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        {statusBadge(ex.status, t)}
                        <p className="text-xs font-bold text-gray-700">{fmtMoney(ex.amount)}</p>
                        <p className="text-[10px] text-gray-300">{fmtDate(ex.created_at)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      {ex.external_id && (
                        <a
                          href={`/payments/receipt/${ex.external_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-primary-600 border border-primary-200 bg-primary-50 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-primary-100 transition-colors"
                        >
                          <i className="ti ti-file-text" aria-hidden="true" />
                          {t('pay_receipt_btn')}
                        </a>
                      )}

                      {isRetryable(ex.status) && (
                        <button
                          onClick={() => setRetryOpen(retryOpen === ex.id ? null : ex.id)}
                          className="flex items-center gap-1 text-[11px] text-amber-700 border border-amber-200 bg-amber-50 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-100 transition-colors"
                        >
                          <i className="ti ti-refresh" aria-hidden="true" />
                          {t('pay_jaribu_tena')}
                        </button>
                      )}
                    </div>

                    {retryOpen === ex.id && (
                      <RetryForm
                        target={{ kind: 'extra', count: parseExtraCount(ex.external_id) }}
                        onClose={() => setRetryOpen(null)}
                      />
                    )}
                  </div>
                ))
          )}

        </div>
      </div>
    </>
  )
}

/* ─── Empty State ────────────────────────────────────────────── */

function EmptyCard({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <i className={`ti ${icon} text-gray-200 text-4xl block mb-2`} aria-hidden="true" />
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}
