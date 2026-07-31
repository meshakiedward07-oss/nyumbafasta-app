'use client'
import { useState, useEffect, useCallback } from 'react'

function fmt(d: string) { return new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }) }
function fmtMoney(n: number) { return `Tsh ${n.toLocaleString()}` }

type Unlock = {
  id: string; amount_paid: number; payment_method: string; status: string; created_at: string
  client:  { id: string; full_name: string; phone: string | null } | null
  dalali:  { id: string; full_name: string; phone: string | null; username: string | null } | null
  listing: { id: string; title: string; type: string; district: string; region: string } | null
}
type Summary = { total_revenue: number; total_count: number; today_count: number }

export default function UnlocksPage() {
  const [unlocks, setUnlocks] = useState<Unlock[]>([])
  const [summary, setSummary] = useState<Summary>({ total_revenue: 0, total_count: 0, today_count: 0 })
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ]             = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q, page: String(page), limit: '50' })
    if (fromDate) params.set('from', fromDate)
    if (toDate)   params.set('to', new Date(toDate + 'T23:59:59').toISOString())
    const res  = await fetch(`/api/v1/admin/unlocks?${params}`)
    const data = await res.json() as { unlocks: Unlock[]; total: number; summary: Summary }
    setUnlocks(data.unlocks ?? [])
    setTotal(data.total ?? 0)
    if (data.summary) setSummary(data.summary)
    setLoading(false)
  }, [q, page, fromDate, toDate])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Malipo ya Mawasiliano</h1>
        <p className="text-sm text-gray-500 mt-0.5">Rekodi zote za wateja waliofungua nambari za madalali (Tsh 2,000/kila mmoja)</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-primary-600">{fmtMoney(summary.total_revenue)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Mapato Yote</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{summary.total_count.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Jumla ya Malipo</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-sky-600">{summary.today_count}</p>
          <p className="text-xs text-gray-500 mt-0.5">Leo</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
            placeholder="Tafuta jina, listing, dalali..."
            className="flex-1 min-w-48 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); setPage(1) }}
              className="text-xs text-red-500 hover:text-red-700 px-2">Futa tarehe</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Inapakia...</div>
        ) : unlocks.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Hakuna malipo yaliyopatikana</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Tarehe', 'Mteja', 'Dalali', 'Listing', 'Kiasi', 'Njia'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {unlocks.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-gray-700">{fmt(u.created_at)}</p>
                      <p className="text-xs text-gray-400">{fmtTime(u.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.client?.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{u.client?.phone ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{u.dalali?.full_name ?? '—'}</p>
                      {u.dalali?.username && <p className="text-xs text-gray-400">@{u.dalali.username}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-gray-700 truncate">{u.listing?.title ?? '—'}</p>
                      <p className="text-xs text-gray-400">{u.listing?.district ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-primary-700">{fmtMoney(u.amount_paid ?? 0)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{u.payment_method ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 50 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>{total.toLocaleString()} jumla</span>
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
