'use client'
import { useState, useEffect } from 'react'

type Subscription = {
  id: string
  plan: string
  status: string
  amount_paid: number | null
  payment_method: string | null
  payment_ref: string | null
  starts_at: string | null
  expires_at: string | null
  created_at: string
}

type ContactUnlock = {
  id: string
  listing_id: string
  dalali_id: string
  status: string
  amount_paid: number | null
  payment_method: string | null
  payment_ref: string | null
  created_at: string
}

type BoostPayment = {
  id: string
  listing_id: string
  amount: number
  weeks: number
  status: string
  payment_method: string | null
  payment_ref: string | null
  boosted_from: string | null
  boosted_until: string | null
  created_at: string
}

type PaymentData = {
  subscriptions:  Subscription[]
  client_unlocks: ContactUnlock[]
  boost_payments: BoostPayment[]
  summary: {
    total_spent:        number
    subscription_count: number
    unlock_count:       number
    boost_count:        number
    pending_count:      number
  }
}

type Tab = 'subscriptions' | 'unlocks' | 'boosts'
type BtnColor = 'green' | 'blue' | 'red' | 'purple'
type FixAction = 'activate_subscription' | 'extend_subscription' | 'complete_unlock' | 'fail_payment'

const STATUS_STYLE: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  completed:    'bg-green-100 text-green-700',
  pending:      'bg-yellow-100 text-yellow-700',
  failed:       'bg-red-100 text-red-700',
  expired:      'bg-gray-100 text-gray-500',
  grace_period: 'bg-orange-100 text-orange-700',
}

const BTN_COLORS: Record<BtnColor, string> = {
  green:  'bg-green-50 text-green-700 border-green-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(n: number | null | undefined) {
  if (!n) return '—'
  return `Tsh ${n.toLocaleString()}`
}

function planLabel(plan: string) {
  if (plan === 'basic')      return 'Basic'
  if (plan === 'premium')    return 'Premium ⭐'
  if (plan === 'enterprise') return 'Enterprise 🏢'
  return plan
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <i className="ti ti-inbox text-gray-300 text-3xl" aria-hidden="true" />
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}

function FixBtn({ label, icon, loading, onClick, color }: {
  label: string
  icon: string
  loading: boolean
  onClick: () => void
  color: BtnColor
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all active:scale-[0.97] disabled:opacity-40 ${BTN_COLORS[color]}`}
    >
      <i className={`ti ti-${loading ? 'loader-2 animate-spin' : icon}`} aria-hidden="true" />
      {label}
    </button>
  )
}

export default function PaymentHistoryPanel({ userId }: { userId: string }) {
  const [data,    setData]    = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('subscriptions')
  const [fixing,  setFixing]  = useState<string | null>(null)
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null)

  async function loadData() {
    const res = await fetch(`/api/v1/admin/payments/${userId}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadData() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fix(action: FixAction, record_type: string, record_id: string) {
    setFixing(record_id)
    setMsg(null)
    try {
      const res = await fetch(`/api/v1/admin/payments/${userId}/fix`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, record_type, record_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMsg({ text: json.message, ok: true })
      await loadData()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Hitilafu imetokea', ok: false })
    } finally {
      setFixing(null)
    }
  }

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center">
      <i className="ti ti-loader-2 animate-spin text-primary-500 text-2xl" aria-hidden="true" />
      <p className="text-xs text-gray-400 mt-2">Inapakia historia ya malipo...</p>
    </div>
  )

  if (!data) return null

  const { summary, subscriptions, client_unlocks, boost_payments } = data

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'subscriptions', label: 'Subscriptions', count: subscriptions.length  },
    { id: 'unlocks',       label: 'Unlocks',       count: client_unlocks.length },
    { id: 'boosts',        label: 'Boosts',        count: boost_payments.length },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
          <i className="ti ti-credit-card mr-1" aria-hidden="true" />Historia ya Malipo
        </p>
        {summary.pending_count > 0 && (
          <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">
            {summary.pending_count} zinasubiri fix
          </span>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
        {[
          { label: 'Jumla Iliyolipwa', value: fmtMoney(summary.total_spent), color: 'text-primary-600' },
          { label: 'Subscriptions',    value: summary.subscription_count,    color: 'text-blue-600'    },
          { label: 'Unlocks',          value: summary.unlock_count,          color: 'text-purple-600'  },
        ].map(s => (
          <div key={s.label} className="bg-white px-2 py-2.5 text-center">
            <p className={`font-bold text-xs ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-medium ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.ok ? '✅' : '❌'} {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              tab === t.id ? 'text-primary-600 border-b-2 border-primary-500' : 'text-gray-400'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">

        {/* ── Subscriptions ── */}
        {tab === 'subscriptions' && (
          subscriptions.length === 0
            ? <EmptyState label="Hakuna subscriptions" />
            : subscriptions.map(sub => (
                <div key={sub.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{planLabel(sub.plan)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {fmtDate(sub.starts_at)} → {fmtDate(sub.expires_at)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {sub.payment_method ?? '—'} · <span className="font-mono">{sub.payment_ref?.slice(0, 14) ?? '—'}</span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[sub.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {sub.status}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtMoney(sub.amount_paid)}</p>
                      <p className="text-[10px] text-gray-300">{fmtDate(sub.created_at)}</p>
                    </div>
                  </div>

                  {/* Fix buttons per status */}
                  {sub.status === 'pending' && (
                    <div className="flex gap-2 flex-wrap">
                      <FixBtn label="Washa Subscription" icon="player-play" loading={fixing === sub.id}
                        onClick={() => fix('activate_subscription', 'subscription', sub.id)} color="green" />
                      <FixBtn label="Futa (Fail)" icon="x" loading={fixing === sub.id}
                        onClick={() => fix('fail_payment', 'subscription', sub.id)} color="red" />
                    </div>
                  )}
                  {sub.status === 'active' && (
                    <FixBtn label="Ongeza Siku 30" icon="calendar-plus" loading={fixing === sub.id}
                      onClick={() => fix('extend_subscription', 'subscription', sub.id)} color="blue" />
                  )}
                  {(sub.status === 'expired' || sub.status === 'failed') && (
                    <FixBtn label="Washa Tena (+30d)" icon="refresh" loading={fixing === sub.id}
                      onClick={() => fix('activate_subscription', 'subscription', sub.id)} color="purple" />
                  )}
                </div>
              ))
        )}

        {/* ── Client unlocks ── */}
        {tab === 'unlocks' && (
          client_unlocks.length === 0
            ? <EmptyState label="Hakuna unlocks kama mteja" />
            : client_unlocks.map(unlock => (
                <div key={unlock.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">Listing Unlock</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                        listing: {unlock.listing_id.slice(0, 8)}…
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {unlock.payment_method ?? '—'} · <span className="font-mono">{unlock.payment_ref?.slice(0, 14) ?? '—'}</span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[unlock.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {unlock.status}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtMoney(unlock.amount_paid)}</p>
                      <p className="text-[10px] text-gray-300">{fmtDate(unlock.created_at)}</p>
                    </div>
                  </div>

                  {unlock.status === 'pending' && (
                    <div className="flex gap-2 flex-wrap">
                      <FixBtn label="Kamilisha Unlock" icon="lock-open" loading={fixing === unlock.id}
                        onClick={() => fix('complete_unlock', 'contact_unlock', unlock.id)} color="green" />
                      <FixBtn label="Futa (Fail)" icon="x" loading={fixing === unlock.id}
                        onClick={() => fix('fail_payment', 'contact_unlock', unlock.id)} color="red" />
                    </div>
                  )}
                </div>
              ))
        )}

        {/* ── Boost payments ── */}
        {tab === 'boosts' && (
          boost_payments.length === 0
            ? <EmptyState label="Hakuna boost payments" />
            : boost_payments.map(b => (
                <div key={b.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">Boost · Wiki {b.weeks}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {fmtDate(b.boosted_from)} → {fmtDate(b.boosted_until)}
                      </p>
                      <p className="text-[10px] text-gray-400">{b.payment_method ?? '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[b.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {b.status}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtMoney(b.amount)}</p>
                    </div>
                  </div>

                  {b.status === 'pending' && (
                    <FixBtn label="Futa (Fail)" icon="x" loading={fixing === b.id}
                      onClick={() => fix('fail_payment', 'boost_payment', b.id)} color="red" />
                  )}
                </div>
              ))
        )}

      </div>
    </div>
  )
}
