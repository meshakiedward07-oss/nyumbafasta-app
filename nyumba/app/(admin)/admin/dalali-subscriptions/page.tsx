'use client'
import { useState, useEffect, useCallback } from 'react'

const PLAN_LABEL: Record<string, string>   = { free: 'Bure', basic: 'Basic', premium: 'Premium', enterprise: 'Enterprise' }
const PLAN_COLOR: Record<string, string>   = { free: 'bg-gray-100 text-gray-600', basic: 'bg-blue-100 text-blue-700', premium: 'bg-amber-100 text-amber-700', enterprise: 'bg-purple-100 text-purple-700' }
const STATUS_LABEL: Record<string, string> = { trial: 'Jaribio', active: 'Hai', grace_period: 'Muda wa Neema', expired: 'Imekwisha', cancelled: 'Imefutwa' }
const STATUS_COLOR: Record<string, string> = { trial: 'bg-sky-100 text-sky-700', active: 'bg-primary-100 text-primary-700', grace_period: 'bg-orange-100 text-orange-700', expired: 'bg-red-100 text-red-600', cancelled: 'bg-gray-100 text-gray-500' }

function fmt(d: string) { return new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) }
function daysLeft(expires: string) {
  const diff = Math.ceil((new Date(expires).getTime() - Date.now()) / 86400000)
  return diff
}

type Sub = {
  id: string; plan: string; status: string; expires_at: string; created_at: string
  dalali: { id: string; full_name: string; phone: string | null; username: string | null; dalali_profiles: { whatsapp_number: string | null; is_premium_verified: boolean }[] } | null
}
type Summary = { active: number; trial: number; expired: number; basic: number; premium: number }

export default function DalaliSubscriptionsPage() {
  const [subs, setSubs]       = useState<Sub[]>([])
  const [summary, setSummary] = useState<Summary>({ active: 0, trial: 0, expired: 0, basic: 0, premium: 0 })
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ]             = useState('')
  const [status, setStatus]   = useState('all')
  const [plan, setPlan]       = useState('all')
  const [extending, setExtending] = useState<string | null>(null)
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status, plan, q, page: String(page), limit: '50' })
    const res  = await fetch(`/api/v1/admin/dalali/subscriptions?${params}`)
    const data = await res.json() as { subscriptions: Sub[]; total: number; summary: Summary }
    setSubs(data.subscriptions ?? [])
    setTotal(data.total ?? 0)
    if (data.summary) setSummary(data.summary)
    setLoading(false)
  }, [status, plan, q, page])

  useEffect(() => { load() }, [load])

  async function extendSub(dalaliId: string, days = 30) {
    setExtending(dalaliId)
    const res = await fetch(`/api/v1/admin/dalali/${dalaliId}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    })
    const data = await res.json() as { error?: string; message?: string }
    setExtending(null)
    if (!res.ok) { showToast(data.error ?? 'Imeshindwa', false); return }
    showToast('Imepanuliwa kwa siku 30')
    load()
  }

  const STATUS_TABS = [
    { key: 'all',          label: 'Zote' },
    { key: 'active',       label: `Hai (${summary.active})` },
    { key: 'trial',        label: `Jaribio (${summary.trial})` },
    { key: 'grace_period', label: 'Neema' },
    { key: 'expired',      label: `Imekwisha (${summary.expired})` },
  ]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm text-white ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Usajili wa Madalali</h1>
        <p className="text-sm text-gray-500 mt-0.5">Simamia subscriptions za madalali wote kwenye mfumo</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Hai',      value: summary.active,  color: 'text-primary-600' },
          { label: 'Jaribio',  value: summary.trial,   color: 'text-sky-600' },
          { label: 'Imekwisha',value: summary.expired, color: 'text-red-600' },
          { label: 'Basic',    value: summary.basic,   color: 'text-blue-600' },
          { label: 'Premium',  value: summary.premium, color: 'text-amber-600' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex gap-2">
          <input
            value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
            placeholder="Tafuta jina, simu, username..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none">
            <option value="all">Mpango Wote</option>
            {Object.entries(PLAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => { setStatus(t.key); setPage(1) }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${status === t.key ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Inapakia...</div>
        ) : subs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Hakuna matokeo</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Dalali', 'Mpango', 'Hali', 'Inaisha', 'Ilisajiliwa', 'Hatua'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subs.map(s => {
                  const d = s.dalali
                  const left = daysLeft(s.expires_at)
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{d?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{d?.phone ?? ''}{d?.username ? ` · @${d.username}` : ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PLAN_COLOR[s.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                          {PLAN_LABEL[s.plan] ?? s.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{fmt(s.expires_at)}</p>
                        {left < 7 && left >= 0 && (
                          <p className="text-xs text-orange-500 font-medium">Siku {left} zimebaki</p>
                        )}
                        {left < 0 && (
                          <p className="text-xs text-red-500 font-medium">Imekwisha</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{fmt(s.created_at)}</td>
                      <td className="px-4 py-3">
                        {d && (
                          <button
                            onClick={() => extendSub(d.id)}
                            disabled={extending === d.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 disabled:opacity-50 font-medium transition-colors"
                          >
                            {extending === d.id ? '...' : '+30 Siku'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>{total} jumla</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">←</button>
              <span className="px-3 py-1.5">Uk. {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
