'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'

const MONTHS = ['Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

function fmt(n: number) { return `TZS ${(n ?? 0).toLocaleString()}` }
function dateFmt(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:        { label: 'Inasubiri',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  proof_uploaded: { label: 'Ushahidi',       cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid:           { label: 'Imelipwa',       cls: 'bg-green-50 text-green-700 border-green-200' },
  partial:        { label: 'Sehemu',         cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  late:           { label: 'Imechelewa',     cls: 'bg-red-50 text-red-700 border-red-200' },
  void:           { label: 'Imebatilishwa',  cls: 'bg-gray-100 text-gray-400 border-gray-200' },
}

interface Payment {
  id: string; due_date: string; status: string
  amount_due: number; amount_paid: number | null; paid_date: string | null
  late_fee_amount: number | null; payment_method: string | null; reference: string | null
}

interface Lease {
  id: string; monthly_rent: number; start_date: string; end_date: string | null; status: string
  deposit_amount: number | null; deposit_paid: boolean | null
  tenant: { full_name: string | null; phone: string | null; email?: string | null } | null
  unit: { unit_number: string; floor_number?: number | null } | null
  organization: { name: string } | null
}

export default function TenantStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leaseId } = use(params)
  const [lease,     setLease]     = useState<Lease | null>(null)
  const [payments,  setPayments]  = useState<Payment[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) { setError('Shirika halipatikani'); setLoading(false); return }
        const id = primary.organization.id

        const [leaseRes, paymentsRes] = await Promise.all([
          fetch(`/api/v1/organizations/${id}/leases/${leaseId}`),
          fetch(`/api/v1/organizations/${id}/leases/${leaseId}/payments?limit=100`),
        ])

        if (!leaseRes.ok) { setError('Mkataba haukupatikana'); setLoading(false); return }

        const leaseJson    = await leaseRes.json()
        const paymentsJson = await paymentsRes.json()

        setLease(leaseJson.lease ?? leaseJson)
        setPayments(paymentsJson.payments ?? [])
      } catch {
        setError('Haikuweza kupakia taarifa.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [leaseId])

  const totalDue      = payments.filter(p => p.status !== 'void').reduce((s, p) => s + (p.amount_due ?? 0), 0)
  const totalPaid     = payments.filter(p => ['paid','partial'].includes(p.status)).reduce((s, p) => s + (p.amount_paid ?? 0), 0)
  const totalLateFees = payments.reduce((s, p) => s + (p.late_fee_amount ?? 0), 0)
  const balance       = totalDue - totalPaid
  const paidCount     = payments.filter(p => p.status === 'paid').length
  const overdueCount  = payments.filter(p => p.status === 'late').length

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-gray-100 bg-white flex-shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/property/wapangaji/${leaseId}`} className="text-gray-400 hover:text-gray-700">
            <i className="ti ti-arrow-left text-xl" aria-hidden="true" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Taarifa ya Malipo</h1>
            <p className="text-xs text-gray-400 mt-0.5">{lease?.tenant?.full_name ?? '...'}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 border border-gray-200 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
          >
            <i className="ti ti-printer text-base" aria-hidden="true" /> Chapisha
          </button>
        </div>
      </div>

      {/* Print header — only visible when printing */}
      <div className="hidden print:block p-6 border-b border-gray-200 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold text-gray-900">🏠 NyumbaFasta</p>
            <p className="text-sm text-gray-500 mt-1">nyumbafasta.co</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">Taarifa ya Malipo ya Kodi</p>
            <p className="text-sm text-gray-500">Ilizalishwa: {new Date().toLocaleDateString('sw-TZ')}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 print:p-0 print:space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : lease ? (
          <>
            {/* Tenant & Lease Info */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 print:border-gray-300">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Maelezo ya Mkataba</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Mpangaji</p>
                  <p className="font-medium text-gray-900">{lease.tenant?.full_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Simu</p>
                  <p className="font-medium text-gray-900">{lease.tenant?.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Kitengo</p>
                  <p className="font-medium text-gray-900">
                    {lease.unit?.unit_number ?? '—'}
                    {lease.unit?.floor_number != null ? ` · Ghorofa ${lease.unit.floor_number}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Kodi ya Kila Mwezi</p>
                  <p className="font-medium text-gray-900">{fmt(lease.monthly_rent)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Mkataba Ulianza</p>
                  <p className="font-medium text-gray-900">{dateFmt(lease.start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Mkataba Unaisha</p>
                  <p className="font-medium text-gray-900">{dateFmt(lease.end_date)}</p>
                </div>
                {lease.deposit_amount != null && (
                  <div>
                    <p className="text-xs text-gray-400">Amana</p>
                    <p className="font-medium text-gray-900">
                      {fmt(lease.deposit_amount)}
                      {' '}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${lease.deposit_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {lease.deposit_paid ? 'Imelipwa' : 'Haijalipiwa'}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
              <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
                <p className="text-[10px] text-gray-500 mb-1">Kimelipwa</p>
                <p className="text-base font-bold text-green-700">{fmt(totalPaid)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{paidCount} malipo</p>
              </div>
              <div className={`rounded-2xl p-3 text-center border ${balance > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                <p className="text-[10px] text-gray-500 mb-1">Salio</p>
                <p className={`text-base font-bold ${balance > 0 ? 'text-red-700' : 'text-gray-700'}`}>{fmt(balance)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{overdueCount} zilizochelewa</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
                <p className="text-[10px] text-gray-500 mb-1">Jumla Inayostahili</p>
                <p className="text-base font-bold text-gray-900">{fmt(totalDue)}</p>
                {totalLateFees > 0 && <p className="text-[10px] text-red-500 mt-0.5">+{fmt(totalLateFees)} adhabu</p>}
              </div>
            </div>

            {/* Payment history table */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden print:border-gray-300">
              <div className="p-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-900 text-sm">Historia ya Malipo ({payments.length})</h2>
              </div>

              {payments.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p>Hakuna historia ya malipo bado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">Mwezi</th>
                        <th className="px-4 py-3 text-right">Inayostahili</th>
                        <th className="px-4 py-3 text-right">Kimelipwa</th>
                        <th className="px-4 py-3 text-right">Adhabu</th>
                        <th className="px-4 py-3 text-center">Hali</th>
                        <th className="px-4 py-3 text-left print:hidden">Njia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {payments.map(p => {
                        const s = STATUS_MAP[p.status] ?? STATUS_MAP['pending']
                        return (
                          <tr key={p.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{dateFmt(p.due_date)}</p>
                              {p.paid_date && (
                                <p className="text-[11px] text-gray-400">Lilipwa: {dateFmt(p.paid_date)}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{fmt(p.amount_due)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-green-700 font-medium">
                              {p.amount_paid != null ? fmt(p.amount_paid) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-red-500 text-xs">
                              {p.late_fee_amount ? fmt(p.late_fee_amount) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.cls}`}>
                                {s.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 print:hidden">
                              {p.payment_method?.toUpperCase() ?? '—'}
                              {p.reference && <span className="ml-1 text-gray-300">· {p.reference}</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td className="px-4 py-3 text-sm">JUMLA</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(totalDue)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-700">{fmt(totalPaid)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-500 text-xs">{totalLateFees ? fmt(totalLateFees) : '—'}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Balance box */}
            {balance !== 0 && (
              <div className={`rounded-2xl p-4 border ${balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  {balance > 0 ? '⚠️ Bado inadaiwa:' : '✅ Hakuna deni:'}
                </p>
                <p className={`text-2xl font-bold ${balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {fmt(Math.abs(balance))}
                </p>
              </div>
            )}

            {/* Print footer */}
            <div className="hidden print:block pt-6 mt-6 border-t border-gray-200 text-center text-xs text-gray-400">
              <p>Taarifa hii imezalishwa na mfumo wa NyumbaFasta</p>
              <p>© {new Date().getFullYear()} NyumbaFasta Tanzania — nyumbafasta.co</p>
            </div>
          </>
        ) : null}
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:hidden { display: none !important; }
          .print\\:border-gray-300 { border-color: #d1d5db !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:space-y-4 > * + * { margin-top: 1rem !important; }
          .print\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          main, [data-nextjs-layout] { display: block !important; }
        }
      `}</style>
    </div>
  )
}
