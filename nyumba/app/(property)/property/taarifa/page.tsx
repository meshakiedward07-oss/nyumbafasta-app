'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const SWAHILI_MONTHS = [
  'Januari','Februari','Machi','Aprili','Mei','Juni',
  'Julai','Agosti','Septemba','Oktoba','Novemba','Desemba',
]

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('en-TZ')
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${SWAHILI_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

type IncomeData = { total_due: number; total_collected: number; total_pending: number; total_overdue: number; collection_rate: number }
type OccupancyData = { total_units: number; occupied: number; vacant: number; maintenance: number; rate: number; active_leases: number; monthly_income: number }
type MaintSummary = { open: number; in_progress: number; resolved_this_month: number; total_actual_cost: number }
type MonthlyBar = { month: string; due: number; collected: number }

interface ReportData {
  month:               string
  income:              IncomeData
  occupancy:           OccupancyData
  maintenance_summary: MaintSummary
  expenses:            { total: number; by_category: Record<string, number> }
  profit_loss:         { income: number; expenses: number; net: number }
  monthly_income:      MonthlyBar[]
  leases_ending_soon:  unknown[]
  overdue_payments:    unknown[]
}

export default function TaarifaPage() {
  const router  = useRouter()
  const now     = new Date()
  const [month, setMonth]   = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [orgId, setOrgId]   = useState<string | null>(null)
  const [data,  setData]    = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [locked,  setLocked]  = useState(false)
  const [listings, setListings] = useState<{ id: string; title: string; district: string }[]>([])
  const [listingId, setListingId] = useState('')

  async function loadReport(id: string, m: string, lid?: string) {
    setLoading(true); setError(null); setLocked(false)
    try {
      const params = new URLSearchParams({ month: m })
      if (lid) params.set('listing_id', lid)
      const res  = await fetch(`/api/v1/organizations/${id}/reports?${params}`)
      const json = await res.json()
      if (!res.ok) {
        if (json.upgrade_required) { setLocked(true); return }
        setError(json.error ?? 'Hitilafu'); return
      }
      setData(json)
    } catch { setError('Haikuweza kupakia taarifa.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    async function init() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) { router.push('/property/setup'); return }
        const id = primary.organization.id
        setOrgId(id)
        const lRes  = await fetch(`/api/v1/organizations/${id}/mali`)
        const lData = await lRes.json()
        setListings(lData.listings ?? [])
        await loadReport(id, month)
      } catch { setError('Hitilafu ya mtandao.') }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const m = e.target.value
    setMonth(m)
    if (orgId) loadReport(orgId, m, listingId || undefined)
  }

  function handleListingChange(lid: string) {
    setListingId(lid)
    if (orgId) loadReport(orgId, month, lid || undefined)
  }

  const monthLabel = (() => {
    const [y, mo] = month.split('-').map(Number)
    return `${SWAHILI_MONTHS[mo - 1]} ${y}`
  })()

  const chartMax = data
    ? Math.max(...data.monthly_income.map(b => b.due), 1)
    : 1

  async function handleDownload() {
    if (!orgId) return
    const url = `/api/v1/organizations/${orgId}/reports/download?month=${month}`
    const a = document.createElement('a')
    a.href = url
    a.download = `taarifa_${month}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Taarifa</h1>
            <p className="text-xs text-gray-400 mt-0.5">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {listings.length > 0 && (
              <select
                value={listingId}
                onChange={e => handleListingChange(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white max-w-[160px]"
              >
                <option value="">Mali Zote</option>
                {listings.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            )}
            <input
              type="month"
              value={month}
              onChange={handleMonthChange}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            />
            {data && (
              <button
                onClick={handleDownload}
                className="border border-gray-200 bg-white text-gray-600 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                title="Pakua Excel"
              >
                ⬇
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : locked ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 px-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
              <i className="ti ti-lock text-amber-500 text-3xl" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Ripoti Hazipo Kwenye Mpango Wako</h2>
            <p className="text-sm text-gray-500 max-w-xs">
              Kipengele cha Ripoti na Takwimu kinahitaji mpango wa juu. Panda mpango ili kupata uchanganuzi kamili wa biashara yako.
            </p>
            <a href="/property/usajili"
              className="mt-2 px-6 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              Angalia Mipango
            </a>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 font-medium">{error}</p>
            <button onClick={() => orgId && loadReport(orgId, month)}
              className="text-primary-600 text-sm mt-2 underline">Jaribu tena</button>
          </div>
        ) : data ? (
          <>
            {/* ── Income Summary ─────────────────────────────────────────── */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <i className="ti ti-cash text-primary-500 text-lg" aria-hidden="true" />
                <h2 className="font-semibold text-gray-900 text-sm">Mapato — {monthLabel}</h2>
              </div>

              {/* Collection rate bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-500">Ukusanyaji wa Kodi</span>
                  <span className={`text-sm font-bold ${data.income.collection_rate >= 80 ? 'text-green-600' : data.income.collection_rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {data.income.collection_rate}%
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${data.income.collection_rate >= 80 ? 'bg-green-400' : data.income.collection_rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${data.income.collection_rate}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Kodi Inayostahili',  value: data.income.total_due,       color: 'text-gray-800'  },
                  { label: 'Imekusanywa',         value: data.income.total_collected, color: 'text-green-600' },
                  { label: 'Inasubiri',           value: data.income.total_pending,   color: 'text-amber-600' },
                  { label: 'Imechelewa',          value: data.income.total_overdue,   color: 'text-red-600'   },
                ].map(card => (
                  <div key={card.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-medium">{card.label}</p>
                    <p className={`text-base font-bold mt-0.5 ${card.color}`}>
                      Tsh {fmtMoney(card.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Occupancy ──────────────────────────────────────────────── */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <i className="ti ti-building text-primary-500 text-lg" aria-hidden="true" />
                  <h2 className="font-semibold text-gray-900 text-sm">Matumizi ya Vitengo</h2>
                </div>
                <span className={`text-lg font-bold ${data.occupancy.rate >= 80 ? 'text-green-600' : data.occupancy.rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {data.occupancy.rate}%
                </span>
              </div>

              {/* Stacked bar */}
              {data.occupancy.total_units > 0 && (
                <div className="flex h-4 rounded-full overflow-hidden mb-3 gap-0.5">
                  <div className="bg-primary-400 transition-all" style={{ width: `${(data.occupancy.occupied / data.occupancy.total_units) * 100}%` }} />
                  <div className="bg-amber-300 transition-all" style={{ width: `${(data.occupancy.maintenance / data.occupancy.total_units) * 100}%` }} />
                  <div className="bg-gray-200 transition-all flex-1" />
                </div>
              )}

              <div className="flex gap-3 text-xs flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-400 inline-block" />{data.occupancy.occupied} Wamepangisha</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />{data.occupancy.vacant} Wazi</span>
                {data.occupancy.maintenance > 0 && (
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block" />{data.occupancy.maintenance} Matengenezo</span>
                )}
              </div>

              {data.occupancy.monthly_income > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400">Jumla ya kodi ya kila mwezi (mikataba hai)</p>
                  <p className="text-base font-bold text-primary-600 mt-0.5">Tsh {fmtMoney(data.occupancy.monthly_income)}</p>
                </div>
              )}
            </div>

            {/* ── Monthly Income Chart ─────────────────────────────────── */}
            {data.monthly_income.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <i className="ti ti-chart-bar text-primary-500 text-lg" aria-hidden="true" />
                  <h2 className="font-semibold text-gray-900 text-sm">Mwenendo wa Miezi 6</h2>
                </div>

                <div className="flex items-end gap-2 h-28">
                  {data.monthly_income.map(b => {
                    const dueH       = chartMax > 0 ? (b.due / chartMax) * 100 : 0
                    const colH       = chartMax > 0 ? (b.collected / chartMax) * 100 : 0
                    const [, mo]     = b.month.split('-').map(Number)
                    const isCurrentM = b.month === month
                    return (
                      <div key={b.month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end gap-0.5 h-20">
                          {/* Due bar */}
                          <div className="flex-1 rounded-t-sm bg-gray-200 transition-all" style={{ height: `${dueH}%`, minHeight: b.due > 0 ? '4px' : '0' }} />
                          {/* Collected bar */}
                          <div className={`flex-1 rounded-t-sm transition-all ${isCurrentM ? 'bg-primary-500' : 'bg-primary-300'}`} style={{ height: `${colH}%`, minHeight: b.collected > 0 ? '4px' : '0' }} />
                        </div>
                        <span className={`text-[9px] font-medium ${isCurrentM ? 'text-primary-600' : 'text-gray-400'}`}>
                          {SWAHILI_MONTHS[mo - 1].slice(0, 3)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-200 inline-block" />Inayostahili</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary-400 inline-block" />Imekusanywa</span>
                </div>
              </div>
            )}

            {/* ── Maintenance Summary ──────────────────────────────────── */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <i className="ti ti-tool text-primary-500 text-lg" aria-hidden="true" />
                <h2 className="font-semibold text-gray-900 text-sm">Matengenezo</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-blue-600">{data.maintenance_summary.open}</p>
                  <p className="text-[10px] text-blue-500 font-medium">Wazi</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-amber-600">{data.maintenance_summary.in_progress}</p>
                  <p className="text-[10px] text-amber-500 font-medium">Inaendelea</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{data.maintenance_summary.resolved_this_month}</p>
                  <p className="text-[10px] text-green-500 font-medium">Mwezi huu</p>
                </div>
              </div>
              {data.maintenance_summary.total_actual_cost > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400">Gharama za matengenezo mwezi huu</p>
                  <p className="text-base font-bold text-red-600 mt-0.5">Tsh {fmtMoney(data.maintenance_summary.total_actual_cost)}</p>
                </div>
              )}
            </div>

            {/* ── Expenses & P&L ──────────────────────────────────────── */}
            {data.expenses && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <i className="ti ti-receipt text-red-500 text-lg" aria-hidden="true" />
                    <h2 className="font-semibold text-gray-900 text-sm">Matumizi</h2>
                  </div>
                  <a href="/property/matumizi" className="text-xs text-primary-500 font-medium">Simamia →</a>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Jumla Matumizi</p>
                    <p className="text-base font-bold text-red-600">Tsh {fmtMoney(data.expenses.total)}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${data.profit_loss.net >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-xs text-gray-500 mb-1">{data.profit_loss.net >= 0 ? 'Faida' : 'Hasara'}</p>
                    <p className={`text-base font-bold ${data.profit_loss.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Tsh {fmtMoney(Math.abs(data.profit_loss.net))}
                    </p>
                  </div>
                </div>

                {Object.keys(data.expenses.by_category).length > 0 && (
                  <div className="space-y-1.5">
                    {Object.entries(data.expenses.by_category)
                      .sort(([,a],[,b]) => b - a)
                      .map(([cat, amt]) => {
                        const pct = data.expenses.total > 0 ? Math.round((amt / data.expenses.total) * 100) : 0
                        const CATS: Record<string,string> = {
                          maintenance:'Matengenezo', utilities:'Huduma', salaries:'Mishahara',
                          marketing:'Masoko', legal:'Kisheria', insurance:'Bima',
                          taxes:'Kodi', office:'Ofisi', other:'Mengine',
                        }
                        return (
                          <div key={cat} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 flex-shrink-0">{CATS[cat] ?? cat}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-16 text-right">{fmtMoney(amt)}</span>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )}

            {/* ── Leases ending soon ───────────────────────────────────── */}
            {(data.leases_ending_soon as unknown as Array<{
              id: string; end_date: string; monthly_rent: number
              tenant: { full_name: string | null; phone: string | null } | null
              unit: { unit_number: string } | null
            }>).length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <i className="ti ti-calendar-off text-orange-500 text-lg" aria-hidden="true" />
                  <h2 className="font-semibold text-gray-900 text-sm">Mikataba Inayokwisha Hivi Karibuni</h2>
                  <span className="ml-auto text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                    Siku 60
                  </span>
                </div>
                <div className="space-y-2">
                  {(data.leases_ending_soon as unknown as Array<{
                    id: string; end_date: string; monthly_rent: number
                    tenant: { full_name: string | null; phone: string | null } | null
                    unit: { unit_number: string } | null
                  }>).map(l => {
                    const days = daysUntil(l.end_date)
                    return (
                      <div key={l.id} className="flex items-center justify-between bg-orange-50/50 rounded-xl p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{l.tenant?.full_name ?? '—'}</p>
                          <p className="text-xs text-gray-400">
                            {l.unit?.unit_number ?? ''} · {fmtDate(l.end_date)}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full ml-2 ${
                          days <= 14 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          Siku {days}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Overdue payments ─────────────────────────────────────── */}
            {(data.overdue_payments as unknown as Array<{
              id: string; amount_due: number; due_date: string
              lease: {
                id: string; monthly_rent: number
                tenant: { full_name: string | null; phone: string | null } | null
                unit: { unit_number: string } | null
              } | null
            }>).length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <i className="ti ti-alert-circle text-red-500 text-lg" aria-hidden="true" />
                  <h2 className="font-semibold text-gray-900 text-sm">Malipo Yaliyochelewa</h2>
                  <span className="ml-auto text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                    {(data.overdue_payments as unknown[]).length}
                  </span>
                </div>
                <div className="space-y-2">
                  {(data.overdue_payments as unknown as Array<{
                    id: string; amount_due: number; due_date: string
                    lease: {
                      id: string; monthly_rent: number
                      tenant: { full_name: string | null; phone: string | null } | null
                      unit: { unit_number: string } | null
                    } | null
                  }>).map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-red-50/50 rounded-xl p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.lease?.tenant?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">
                          {p.lease?.unit?.unit_number ?? ''} · Ilipaswa {fmtDate(p.due_date)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right ml-2">
                        <p className="text-sm font-bold text-red-600">Tsh {fmtMoney(p.amount_due)}</p>
                        {p.lease?.tenant?.phone && (
                          <a href={`tel:${p.lease.tenant.phone}`} className="text-[10px] text-primary-600 font-medium">Piga simu</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {data.occupancy.total_units === 0 && (
              <div className="text-center py-12 px-6">
                <i className="ti ti-chart-bar text-5xl text-gray-200" aria-hidden="true" />
                <p className="text-gray-500 font-medium mt-3">Hakuna data ya kuonyesha</p>
                <p className="text-sm text-gray-400 mt-1">Ongeza vitengo na wapangaji ili kuona taarifa.</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
