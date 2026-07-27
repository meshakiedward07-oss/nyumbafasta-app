'use client'
import { useEffect, useState, useCallback } from 'react'

type PayStatus = 'pending' | 'partial' | 'late' | 'proof_uploaded' | 'paid' | 'void'

interface RentPayment {
  id:             string
  lease_id:       string
  status:         PayStatus
  amount_due:     number | null
  amount_paid:    number | null
  due_date:       string | null
  paid_date:      string | null
  verified_at:    string | null
  proof_url:      string | null
  payment_method: string | null
  reference:      string | null
  org_id:         string | null
  org_name:       string | null
  tenant_name:    string | null
  tenant_phone:   string | null
  unit_number:    string | null
}

interface Summary {
  total: number; pending: number; proof: number; paid: number; overdue: number
  total_due: number; total_paid: number
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:        { bg: '#faeeda', color: '#854f0b', label: 'Inasubiri'          },
  partial:        { bg: '#faeeda', color: '#854f0b', label: 'Ilipwa Kidogo'      },
  late:           { bg: '#fcebeb', color: '#a32d2d', label: 'Imechelewa'         },
  proof_uploaded: { bg: '#e6f1fb', color: '#185fa5', label: 'Ushahidi Umepakiwa' },
  paid:           { bg: '#eaf3de', color: '#3b6d11', label: 'Imelipwa'           },
  void:           { bg: '#f4f4f0', color: '#999992', label: 'Imebatilishwa'      },
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtAmt(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `TZS ${n.toLocaleString()}`
}

export default function RentTab() {
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
      setPayments(data.payments ?? [])
      setTotal(data.total       ?? 0)
      if (data.summary) setSummary(data.summary)
    } catch { setErr('Imeshindwa kupakia data. Jaribu tena.') }
    finally { setLoading(false) }
  }, [statusFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filterChips = [
    { value: 'all'     as const, label: 'Zote',                count: summary.total,   bg: '#f4f4f0',  color: '#666660'  },
    { value: 'pending' as const, label: 'Zinazosubiri',        count: summary.pending, bg: '#faeeda',  color: '#854f0b'  },
    { value: 'proof'   as const, label: 'Ushahidi',            count: summary.proof,   bg: '#e6f1fb',  color: '#185fa5'  },
    { value: 'overdue' as const, label: 'Zimechelewa',         count: summary.overdue, bg: '#fcebeb',  color: '#a32d2d'  },
    { value: 'paid'    as const, label: 'Zimelipwa',           count: summary.paid,    bg: '#eaf3de',  color: '#3b6d11'  },
  ]

  const collectRate = summary.total_due > 0
    ? Math.round((summary.total_paid / summary.total_due) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Zinazosubiri',     value: summary.pending, icon: 'clock',          bg: '#faeeda', color: '#854f0b' },
          { label: 'Ushahidi (Hakiki)',value: summary.proof,   icon: 'file-check',     bg: '#e6f1fb', color: '#185fa5' },
          { label: 'Zimechelewa',      value: summary.overdue, icon: 'alert-triangle', bg: '#fcebeb', color: '#a32d2d' },
          { label: 'Zimelipwa',        value: summary.paid,    icon: 'circle-check',   bg: '#eaf3de', color: '#3b6d11' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: c.bg }}>
              <i className={`ti ti-${c.icon} text-base`} style={{ color: c.color }} aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold" style={{ color: '#1a1a18' }}>{c.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#999992' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue summary */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm" style={{ color: '#1a1a18' }}>Muhtasari wa Mapato</h3>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: collectRate >= 80 ? '#eaf3de' : collectRate >= 60 ? '#faeeda' : '#fcebeb',
              color:      collectRate >= 80 ? '#3b6d11' : collectRate >= 60 ? '#854f0b' : '#a32d2d',
            }}
          >
            {collectRate}% imekusanywa
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs" style={{ color: '#999992' }}>Jumla Inayostahili</p>
            <p className="text-lg font-bold" style={{ color: '#1a1a18' }}>{fmtAmt(summary.total_due)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#999992' }}>Jumla Iliyolipwa</p>
            <p className="text-lg font-bold" style={{ color: '#3b6d11' }}>{fmtAmt(summary.total_paid)}</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: '#f4f4f0' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(collectRate, 100)}%`,
              background: collectRate >= 80 ? '#3b6d11' : collectRate >= 60 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <p className="text-xs mt-1" style={{ color: '#999992' }}>
          Deni bado: {fmtAmt(summary.total_due - summary.total_paid)}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filterChips.map(chip => (
          <button key={chip.value} onClick={() => setStatusFilter(chip.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === chip.value ? 'bg-primary-500 text-white' : ''
            }`}
            style={statusFilter !== chip.value ? { background: '#f4f4f0', color: '#666660' } : {}}>
            {chip.label}
            <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 flex items-center justify-center ${
              statusFilter === chip.value ? 'bg-white/20 text-white' : ''
            }`}
            style={statusFilter !== chip.value ? { background: '#e5e5e0', color: '#666660' } : {}}>{chip.count}</span>
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <label className="text-xs" style={{ color: '#999992' }}>Kutoka:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
            style={{ border: '1px solid #e5e5e0' }} />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs" style={{ color: '#999992' }}>Hadi:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
            style={{ border: '1px solid #e5e5e0' }} />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo('') }}
            className="text-xs px-3 py-1.5 rounded-xl transition"
            style={{ border: '1px solid #e5e5e0', color: '#999992' }}>
            <i className="ti ti-x mr-1" aria-hidden="true" />Futa tarehe
          </button>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: '#f4f4f0' }} />)}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center" style={{ border: '1px dashed #e5e5e0' }}>
          <i className="ti ti-receipt text-5xl" style={{ color: '#e5e5e0' }} aria-hidden="true" />
          <p className="font-medium mt-3" style={{ color: '#666660' }}>Hakuna malipo yaliyopatikana</p>
          <p className="text-sm mt-1" style={{ color: '#999992' }}>Badilisha vichujio ili kupata matokeo.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e0' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider" style={{ borderBottom: '1px solid #e5e5e0', background: '#f8f8f5', color: '#999992' }}>
                  <th className="text-left px-4 py-3 font-semibold">Shirika / Mpangaji</th>
                  <th className="text-left px-4 py-3 font-semibold">Chumba</th>
                  <th className="text-left px-4 py-3 font-semibold">Tarehe ya Malipo</th>
                  <th className="text-right px-4 py-3 font-semibold">Inastahili</th>
                  <th className="text-right px-4 py-3 font-semibold">Ilipwa</th>
                  <th className="text-left px-4 py-3 font-semibold">Hali</th>
                  <th className="text-left px-4 py-3 font-semibold">Ushahidi</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const today = new Date().toISOString().split('T')[0]
                  const isOverdue = p.due_date && p.due_date < today && ['pending', 'partial', 'late'].includes(p.status)
                  const ss = STATUS_STYLE[p.status] ?? { bg: '#f4f4f0', color: '#666660', label: p.status }
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors" style={{
                      borderBottom: '1px solid #f4f4f0',
                      background: isOverdue ? 'rgba(252,235,235,0.3)' : undefined,
                    }}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm leading-tight" style={{ color: '#1a1a18' }}>{p.org_name ?? '—'}</p>
                        {p.tenant_name && (
                          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#999992' }}>
                            <i className="ti ti-user" aria-hidden="true" />
                            {p.tenant_name}
                            {p.tenant_phone && (
                              <a href={`tel:${p.tenant_phone}`} className="hover:text-primary-500">{p.tenant_phone}</a>
                            )}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#666660' }}>
                        {p.unit_number ? `Chumba ${p.unit_number}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#666660' }}>
                        <div>{fmtDate(p.due_date)}</div>
                        {isOverdue && <span className="text-[10px] font-medium text-red-500">Imechelewa</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums" style={{ color: '#1a1a18' }}>
                        {fmtAmt(p.amount_due)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums">
                        <span style={{ color: p.amount_paid && p.amount_paid > 0 ? '#3b6d11' : '#e5e5e0' }}>
                          {fmtAmt(p.amount_paid)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: ss.bg, color: ss.color }}>
                          {ss.label}
                        </span>
                        {p.paid_date && <p className="text-[10px] mt-0.5" style={{ color: '#999992' }}>{fmtDate(p.paid_date)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {p.proof_url ? (
                          <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs flex items-center gap-1 hover:underline" style={{ color: '#1D9E75' }}>
                            <i className="ti ti-file" aria-hidden="true" />Angalia
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: '#e5e5e0' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {total > payments.length && (
            <div className="px-4 py-3" style={{ borderTop: '1px solid #f4f4f0', background: '#f8f8f5' }}>
              <p className="text-xs" style={{ color: '#999992' }}>Inaonyesha {payments.length} ya {total} malipo</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
