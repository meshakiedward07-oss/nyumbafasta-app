'use client'
import { useEffect, useState, useCallback } from 'react'

type PayStatus = 'pending' | 'partial' | 'late' | 'proof_uploaded' | 'paid' | 'void'

interface RentPayment {
  id:            string
  lease_id:      string
  status:        PayStatus
  amount_due:    number | null
  amount_paid:   number | null
  due_date:      string | null
  paid_date:     string | null
  verified_at:   string | null
  proof_url:     string | null
  payment_method:string | null
  reference:     string | null
  // enriched
  org_id:        string | null
  org_name:      string | null
  tenant_name:   string | null
  tenant_phone:  string | null
  unit_number:   string | null
}

interface Summary {
  total: number; pending: number; proof: number; paid: number; overdue: number
  total_due: number; total_paid: number
}

const STATUS_BADGE: Record<string, string> = {
  pending:        'bg-amber-50 text-amber-700',
  partial:        'bg-orange-50 text-orange-700',
  late:           'bg-red-100 text-red-700',
  proof_uploaded: 'bg-blue-50 text-blue-700',
  paid:           'bg-green-50 text-green-700',
  void:           'bg-gray-100 text-gray-400',
}
const STATUS_LABEL: Record<string, string> = {
  pending:        'Inasubiri',
  partial:        'Ilipwa Kidogo',
  late:           'Imechelewa',
  proof_uploaded: 'Ushahidi Umepakiwa',
  paid:           'Imelipwa',
  void:           'Imebatilishwa',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtAmt(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `TZS ${n.toLocaleString()}`
}

export default function AdminRentPage() {
  const [payments,     setPayments]     = useState<RentPayment[]>([])
  const [summary,      setSummary]      = useState<Summary>({ total: 0, pending: 0, proof: 0, paid: 0, overdue: 0, total_due: 0, total_paid: 0 })
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'proof' | 'paid' | 'overdue'>('all')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [err,          setErr]          = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const params = new URLSearchParams({ limit: '50', status: statusFilter })
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo)   params.set('date_to',   dateTo)
      const res  = await fetch(`/api/v1/admin/rent-payments?${params}`)
      const data = await res.json()
      setPayments(data.payments  ?? [])
      setTotal(data.total        ?? 0)
      if (data.summary) setSummary(data.summary)
    } catch { setErr('Imeshindwa kupakia data. Jaribu tena.') }
    finally   { setLoading(false) }
  }, [statusFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filterChips = [
    { value: 'all',     label: 'Zote',                  count: summary.total,   color: 'bg-gray-100 text-gray-600'    },
    { value: 'pending', label: 'Zinazosubiri',          count: summary.pending, color: 'bg-amber-100 text-amber-700'  },
    { value: 'proof',   label: 'Ushahidi Umepakiwa',    count: summary.proof,   color: 'bg-blue-100 text-blue-700'    },
    { value: 'overdue', label: 'Zimechelewa',           count: summary.overdue, color: 'bg-red-100 text-red-700'      },
    { value: 'paid',    label: 'Zimelipwa',             count: summary.paid,    color: 'bg-green-100 text-green-700'  },
  ] as const

  const collectRate = summary.total_due > 0
    ? Math.round((summary.total_paid / summary.total_due) * 100)
    : 0

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Ukaguzi wa Malipo ya Kodi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Malipo ya kodi kutoka mashirika yote kwenye mfumo
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Zinazosubiri',    value: summary.pending, icon: 'clock',         color: 'text-amber-500 bg-amber-50'  },
          { label: 'Ushahidi (Hakiki)',value: summary.proof,   icon: 'file-check',   color: 'text-blue-500  bg-blue-50'   },
          { label: 'Zimechelewa',     value: summary.overdue, icon: 'alert-triangle',color: 'text-red-500   bg-red-50'    },
          { label: 'Zimelipwa',       value: summary.paid,    icon: 'circle-check',  color: 'text-green-500 bg-green-50'  },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${c.color.split(' ')[1]}`}>
              <i className={`ti ti-${c.icon} text-base ${c.color.split(' ')[0]}`} aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 text-sm">Muhtasari wa Mapato</h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${collectRate >= 80 ? 'bg-green-100 text-green-700' : collectRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {collectRate}% imekusanywa
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">Jumla Inayostahili</p>
            <p className="text-lg font-bold text-gray-900">{fmtAmt(summary.total_due)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Jumla Iliyolipwa</p>
            <p className="text-lg font-bold text-green-600">{fmtAmt(summary.total_paid)}</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${collectRate >= 80 ? 'bg-green-500' : collectRate >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(collectRate, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Deni bado: {fmtAmt((summary.total_due - summary.total_paid))}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filterChips.map(chip => (
          <button key={chip.value} onClick={() => setStatusFilter(chip.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === chip.value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {chip.label}
            <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 flex items-center justify-center ${
              statusFilter === chip.value ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            }`}>{chip.count}</span>
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Kutoka:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Hadi:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo('') }}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">
            <i className="ti ti-x mr-1" aria-hidden="true" />Futa tarehe
          </button>
        )}
      </div>

      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <i className="ti ti-receipt text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna malipo yaliyopatikana</p>
          <p className="text-sm text-gray-400 mt-1">Badilisha vichujio ili kupata matokeo.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-3 font-semibold">Shirika / Mpangaji</th>
                    <th className="text-left px-4 py-3 font-semibold">Chumba</th>
                    <th className="text-left px-4 py-3 font-semibold">Tarehe ya Malipo</th>
                    <th className="text-right px-4 py-3 font-semibold">Inastahili</th>
                    <th className="text-right px-4 py-3 font-semibold">Ilipwa</th>
                    <th className="text-left px-4 py-3 font-semibold">Hali</th>
                    <th className="text-left px-4 py-3 font-semibold">Ushahidi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map(p => {
                    const isOverdue = p.due_date && p.due_date < new Date().toISOString().split('T')[0]
                      && ['pending', 'partial', 'late'].includes(p.status)
                    return (
                      <tr key={p.id} className={`hover:bg-gray-50/50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm leading-tight">
                            {p.org_name ?? '—'}
                          </p>
                          {p.tenant_name && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <i className="ti ti-user" aria-hidden="true" />
                              {p.tenant_name}
                              {p.tenant_phone && (
                                <a href={`tel:${p.tenant_phone}`} className="hover:text-primary-500">{p.tenant_phone}</a>
                              )}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {p.unit_number ? `Chumba ${p.unit_number}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <div>{fmtDate(p.due_date)}</div>
                          {isOverdue && (
                            <span className="text-[10px] text-red-500 font-medium">Imechelewa</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-900 tabular-nums">
                          {fmtAmt(p.amount_due)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums">
                          <span className={p.amount_paid && p.amount_paid > 0 ? 'text-green-600' : 'text-gray-300'}>
                            {fmtAmt(p.amount_paid)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABEL[p.status] ?? p.status}
                          </span>
                          {p.paid_date && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(p.paid_date)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.proof_url ? (
                            <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                              <i className="ti ti-file" aria-hidden="true" />
                              Angalia
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {total > payments.length && (
              <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/40">
                <p className="text-xs text-gray-400">Inaonyesha {payments.length} ya {total} malipo</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
