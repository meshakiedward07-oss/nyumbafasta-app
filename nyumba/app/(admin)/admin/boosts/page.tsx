'use client'
import { useState, useEffect, useCallback } from 'react'
function fmt(d: string) { return new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) }
function fmtMoney(n: number) { return `Tsh ${n.toLocaleString()}` }

const STATUS_LABEL: Record<string, string> = { pending: 'Inasubiri', active: 'Hai', completed: 'Imekamilika', expired: 'Imekwisha', failed: 'Imeshindwa' }
const STATUS_COLOR: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', active: 'bg-primary-100 text-primary-700', completed: 'bg-gray-100 text-gray-600', expired: 'bg-red-100 text-red-600', failed: 'bg-red-100 text-red-700' }

type Boost = {
  id: string; amount_paid: number; status: string; boost_days: number; created_at: string; expires_at: string | null
  dalali:  { id: string; full_name: string; phone: string | null; username: string | null } | null
  listing: { id: string; title: string; type: string; district: string; region: string; is_boosted: boolean } | null
}
type Summary = { active_boosts: number; boosted_listings: number; total_revenue: number }

export default function BoostsPage() {
  const [boosts, setBoosts]   = useState<Boost[]>([])
  const [summary, setSummary] = useState<Summary>({ active_boosts: 0, boosted_listings: 0, total_revenue: 0 })
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ]             = useState('')
  const [status, setStatus]   = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status, q, page: String(page), limit: '50' })
    const res  = await fetch(`/api/v1/admin/boosts?${params}`)
    const data = await res.json() as { boosts: Boost[]; total: number; summary: Summary }
    setBoosts(data.boosts ?? [])
    setTotal(data.total ?? 0)
    if (data.summary) setSummary(data.summary)
    setLoading(false)
  }, [status, q, page])

  useEffect(() => { load() }, [load])

  const STATUS_TABS = [
    { key: 'all',       label: 'Zote' },
    { key: 'active',    label: `Hai (${summary.active_boosts})` },
    { key: 'pending',   label: 'Inasubiri' },
    { key: 'expired',   label: 'Imekwisha' },
    { key: 'completed', label: 'Imekamilika' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Matangazo Yaliyoimarishwa</h1>
        <p className="text-sm text-gray-500 mt-0.5">Orodha ya listings zilizolipwa Boost na madalali</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-primary-600">{summary.active_boosts}</p>
          <p className="text-xs text-gray-500 mt-0.5">Boost Zinazoendelea</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-amber-600">{summary.boosted_listings}</p>
          <p className="text-xs text-gray-500 mt-0.5">Listings Zimeboosted</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{fmtMoney(summary.total_revenue)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Mapato ya Boost</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
          placeholder="Tafuta dalali, listing, wilaya..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
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
        ) : boosts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Hakuna boost zilizopakiwa</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Tarehe', 'Dalali', 'Listing', 'Siku', 'Inaisha', 'Kiasi', 'Hali'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {boosts.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmt(b.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{b.dalali?.full_name ?? '—'}</p>
                      {b.dalali?.username && <p className="text-xs text-gray-400">@{b.dalali.username}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-gray-700 truncate">{b.listing?.title ?? '—'}</p>
                      <p className="text-xs text-gray-400">{b.listing?.district ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.boost_days} siku</td>
                    <td className="px-4 py-3 text-gray-500">{b.expires_at ? fmt(b.expires_at) : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-primary-700">{fmtMoney(b.amount_paid ?? 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
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
