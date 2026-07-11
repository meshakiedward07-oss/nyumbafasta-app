'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

const IncomeForm     = dynamic(() => import('./components/IncomeForm'),     { ssr: false })
const ExpenseForm    = dynamic(() => import('./components/ExpenseForm'),    { ssr: false })
const CommissionForm = dynamic(() => import('./components/CommissionForm'), { ssr: false })
const GoalForm       = dynamic(() => import('./components/GoalForm'),       { ssr: false })

// ─── Types ───────────────────────────────────────────────────────────────────

interface FinanceSummary {
  today: number; week: number
  monthIncome: number; monthExpenses: number; monthProfit: number
  yearIncome: number; yearExpenses: number
}
interface Commission {
  id: string; client_name: string; property_title: string
  expected_amount: number; paid_amount: number; status: string
  due_date: string | null; notes: string | null
}
interface Goal { title: string; target_amount: number; current_amount: number; month: number; year: number }
interface IncomeRow    { id: string; date: string; category: string; amount: number; description: string | null; client_name: string | null; listing_title: string | null; payment_method: string }
interface ExpenseRow   { id: string; date: string; category: string; amount: number; description: string | null; vendor: string | null; payment_method: string }
interface StatsData {
  summary: FinanceSummary
  commissions: { pending: number; paid: number; overdue: number; list: Commission[] }
  goal: Goal | null
  recentIncome: IncomeRow[]
  recentExpenses: ExpenseRow[]
  incomeByCategory: Record<string, number>
  expenseByCategory: Record<string, number>
  period: { month: number; year: number }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`
  return String(n)
}
function fmtFull(n: number) { return `TSh ${n.toLocaleString()}` }

const CATEGORY_LABELS: Record<string, string> = {
  commission: 'Kamisheni', viewing_fee: 'Viewing', consultation: 'Ushauri',
  service: 'Huduma', transport: 'Usafiri', marketing: 'Matangazo',
  phone: 'Simu/Data', office: 'Ofisi', other: 'Nyingine',
}
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  paid:    { label: 'Imelipwa',   cls: 'bg-green-100  text-green-700'  },
  partial: { label: 'Sehemu',     cls: 'bg-blue-100   text-blue-700'   },
  pending: { label: 'Inasubiri',  cls: 'bg-amber-100  text-amber-700'  },
  overdue: { label: 'Imechelewa', cls: 'bg-red-100    text-red-700'    },
}
const MONTHS = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Category Bar ─────────────────────────────────────────────────────────────
function CategoryBar({ data, color }: { data: Record<string, number>; color: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = entries[0]?.[1] ?? 1
  return (
    <div className="space-y-2">
      {entries.map(([cat, val]) => (
        <div key={cat}>
          <div className="flex justify-between text-xs text-gray-600 mb-0.5">
            <span>{CATEGORY_LABELS[cat] ?? cat}</span>
            <span className="font-medium">TSh {fmt(val)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(val / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HesabuPage() {
  const [tab,     setTab]     = useState<'muhtasari' | 'mapato' | 'matumizi' | 'commission' | 'ripoti'>('muhtasari')
  const [stats,   setStats]   = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [advice,  setAdvice]  = useState('')
  const [advLoading, setAdvLoading] = useState(false)
  const [modal, setModal] = useState<null | 'income' | 'expense' | 'commission' | 'goal'>()
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'income' | 'expense' | 'commission'; label: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [commPaying, setCommPaying] = useState<string | null>(null)
  const [commPayAmount, setCommPayAmount] = useState('')

  const now = new Date()
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/dalali/finance/stats?month=${period.month}&year=${period.year}`)
      const data = await res.json()
      if (data.stats) setStats(data.stats)
    } finally { setLoading(false) }
  }, [period.month, period.year])

  useEffect(() => { loadStats() }, [loadStats])

  async function fetchAdvice() {
    if (!stats || advLoading) return
    setAdvLoading(true)
    try {
      const res = await fetch('/api/v1/dalali/finance/ai-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      })
      const data = await res.json()
      if (data.advice) setAdvice(data.advice)
    } finally { setAdvLoading(false) }
  }

  async function deleteIncome(id: string) {
    setDeleting(id)
    await fetch(`/api/v1/dalali/finance/income?id=${id}`, { method: 'DELETE' })
    setDeleting(null)
    setDeleteConfirm(null)
    loadStats()
  }

  async function deleteExpense(id: string) {
    setDeleting(id)
    await fetch(`/api/v1/dalali/finance/expenses?id=${id}`, { method: 'DELETE' })
    setDeleting(null)
    setDeleteConfirm(null)
    loadStats()
  }

  async function payCommission(id: string) {
    const amt = parseInt(commPayAmount)
    if (!amt || amt <= 0) return
    await fetch('/api/v1/dalali/finance/commissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, paid_amount: amt }),
    })
    setCommPaying(null)
    setCommPayAmount('')
    loadStats()
  }

  async function deleteCommission(id: string) {
    setDeleting(id)
    await fetch(`/api/v1/dalali/finance/commissions?id=${id}`, { method: 'DELETE' })
    setDeleting(null)
    setDeleteConfirm(null)
    loadStats()
  }

  function openReport() {
    window.open(`/api/v1/dalali/finance/report?month=${period.month}&year=${period.year}`, '_blank')
  }

  const profitColor = stats && stats.summary.monthProfit >= 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <i className="ti ti-coins text-primary-500" aria-hidden="true" /> Hesabu Zangu
              </h1>
              <p className="text-[11px] text-gray-400">{MONTHS[period.month]} {period.year}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Month picker */}
              <select
                value={`${period.year}-${period.month}`}
                onChange={e => {
                  const [y, m] = e.target.value.split('-').map(Number)
                  setPeriod({ month: m, year: y })
                }}
                className="text-xs border border-gray-200 rounded-xl px-2 py-1.5 text-gray-600 bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                  return { m: d.getMonth() + 1, y: d.getFullYear() }
                }).map(({ m, y }) => (
                  <option key={`${y}-${m}`} value={`${y}-${m}`}>
                    {MONTHS[m]} {y}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setModal('income')}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary-500 text-white shadow-sm"
                title="Ongeza mapato"
              >
                <i className="ti ti-plus text-sm" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {([ ['muhtasari','Muhtasari'], ['mapato','Mapato'], ['matumizi','Matumizi'], ['commission','Kamisheni'], ['ripoti','Ripoti'] ] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  tab === id ? 'bg-primary-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ─── MUHTASARI TAB ──────────────────────────────────────────────── */}
        {tab === 'muhtasari' && (
          <>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : stats ? (
              <>
                {/* Hero stats */}
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Mapato leo"    value={`TSh ${fmt(stats.summary.today)}`}        color="text-green-600" />
                  <StatTile label="Wiki hii"      value={`TSh ${fmt(stats.summary.week)}`}         color="text-blue-600" />
                  <StatTile label="Mwezi huu"     value={`TSh ${fmt(stats.summary.monthIncome)}`}  color="text-gray-900" />
                  <StatTile label="Faida halisi"  value={`TSh ${fmt(stats.summary.monthProfit)}`}  color={profitColor} />
                </div>

                {/* Goal progress */}
                {stats.goal ? (
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{stats.goal.title}</p>
                        <p className="text-[11px] text-gray-400">{fmtFull(stats.goal.current_amount)} / {fmtFull(stats.goal.target_amount)}</p>
                      </div>
                      <span className="text-sm font-bold text-primary-600">
                        {Math.min(100, Math.round(stats.goal.current_amount / stats.goal.target_amount * 100))}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, stats.goal.current_amount / stats.goal.target_amount * 100)}%` }}
                      />
                    </div>
                    <button onClick={() => setModal('goal')} className="mt-2 text-[11px] text-primary-600 font-medium">Badilisha lengo →</button>
                  </div>
                ) : (
                  <button onClick={() => setModal('goal')}
                    className="w-full bg-white border-2 border-dashed border-primary-200 rounded-2xl p-4 text-sm text-primary-600 font-medium text-center">
                    + Weka lengo la mapato mwezi huu
                  </button>
                )}

                {/* Commissions summary */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <p className="text-xs font-semibold text-gray-700 mb-3">Kamisheni</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-base font-bold text-amber-600">{fmtFull(stats.commissions.pending).replace('TSh ', 'TSh\n')}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Inasubiri</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-red-600">{fmtFull(stats.commissions.overdue).replace('TSh ', 'TSh\n')}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Imechelewa</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-green-600">{fmtFull(stats.commissions.paid).replace('TSh ', 'TSh\n')}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Imelipwa</p>
                    </div>
                  </div>
                </div>

                {/* Income breakdown */}
                {Object.keys(stats.incomeByCategory).length > 0 && (
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-xs font-semibold text-gray-700 mb-3">Mapato kwa aina</p>
                    <CategoryBar data={stats.incomeByCategory} color="bg-green-400" />
                  </div>
                )}

                {/* Expense breakdown */}
                {Object.keys(stats.expenseByCategory).length > 0 && (
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-xs font-semibold text-gray-700 mb-3">Matumizi kwa aina</p>
                    <CategoryBar data={stats.expenseByCategory} color="bg-red-400" />
                  </div>
                )}

                {/* Amina AI advice */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-4 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold">A</div>
                    <p className="text-sm font-semibold">Amina AI — Ushauri</p>
                  </div>
                  {advice ? (
                    <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">{advice}</p>
                  ) : (
                    <button onClick={fetchAdvice} disabled={advLoading}
                      className="w-full bg-white/10 hover:bg-white/20 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-50">
                      {advLoading ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Amina anafikiri...</span> : <span className="flex items-center justify-center gap-1.5"><i className="ti ti-message-chatbot text-sm" aria-hidden="true" />Pata ushauri wa biashara</span>}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <i className="ti ti-coins text-4xl" aria-hidden="true" />
                <p className="mt-2 text-sm">Hakuna takwimu</p>
              </div>
            )}
          </>
        )}

        {/* ─── MAPATO TAB ─────────────────────────────────────────────────── */}
        {tab === 'mapato' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Mapato yote</p>
                <p className="text-xl font-bold text-green-600">TSh {fmt(stats?.summary.monthIncome ?? 0)}</p>
              </div>
              <button onClick={() => setModal('income')}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <i className="ti ti-plus" aria-hidden="true" /> Ongeza
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}
              </div>
            ) : (stats?.recentIncome?.length ?? 0) === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <i className="ti ti-trending-up text-4xl" aria-hidden="true" />
                <p className="mt-2 text-sm">Hakuna mapato bado</p>
                <button onClick={() => setModal('income')} className="mt-3 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold">
                  Ongeza mapato ya kwanza
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {stats!.recentIncome.map(row => (
                  <div key={row.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                      <i className="ti ti-trending-up text-green-500" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {CATEGORY_LABELS[row.category] ?? row.category}
                        </p>
                        <p className="text-sm font-bold text-green-600 shrink-0">+TSh {fmt(row.amount)}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {row.date} · {row.client_name ?? ''}{row.listing_title ? ` · ${row.listing_title}` : ''}
                      </p>
                      {row.description && <p className="text-xs text-gray-400 truncate">{row.description}</p>}
                    </div>
                    <button
                      onClick={() => setDeleteConfirm({ id: row.id, type: 'income', label: CATEGORY_LABELS[row.category] ?? row.category })}
                      disabled={deleting === row.id}
                      className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-red-50 shrink-0">
                      <i className={`ti ${deleting === row.id ? 'ti-loader animate-spin' : 'ti-trash'} text-red-400 text-xs`} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── MATUMIZI TAB ───────────────────────────────────────────────── */}
        {tab === 'matumizi' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Matumizi yote</p>
                <p className="text-xl font-bold text-red-600">TSh {fmt(stats?.summary.monthExpenses ?? 0)}</p>
              </div>
              <button onClick={() => setModal('expense')}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <i className="ti ti-plus" aria-hidden="true" /> Ongeza
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}
              </div>
            ) : (stats?.recentExpenses?.length ?? 0) === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <i className="ti ti-trending-down text-4xl" aria-hidden="true" />
                <p className="mt-2 text-sm">Hakuna matumizi bado</p>
                <button onClick={() => setModal('expense')} className="mt-3 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold">
                  Rekodi matumizi ya kwanza
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {stats!.recentExpenses.map(row => (
                  <div key={row.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <i className="ti ti-trending-down text-red-400" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {CATEGORY_LABELS[row.category] ?? row.category}
                        </p>
                        <p className="text-sm font-bold text-red-500 shrink-0">−TSh {fmt(row.amount)}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {row.date}{row.vendor ? ` · ${row.vendor}` : ''}
                      </p>
                      {row.description && <p className="text-xs text-gray-400 truncate">{row.description}</p>}
                    </div>
                    <button
                      onClick={() => setDeleteConfirm({ id: row.id, type: 'expense', label: CATEGORY_LABELS[row.category] ?? row.category })}
                      disabled={deleting === row.id}
                      className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-red-50 shrink-0">
                      <i className={`ti ${deleting === row.id ? 'ti-loader animate-spin' : 'ti-trash'} text-red-400 text-xs`} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── COMMISSION TAB ─────────────────────────────────────────────── */}
        {tab === 'commission' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Zinazosumbua ({stats?.commissions.list.filter(c => c.status !== 'paid').length ?? 0})</p>
              </div>
              <button onClick={() => setModal('commission')}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <i className="ti ti-plus" aria-hidden="true" /> Ongeza
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
              </div>
            ) : (stats?.commissions.list?.length ?? 0) === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <i className="ti ti-receipt text-4xl" aria-hidden="true" />
                <p className="mt-2 text-sm">Hakuna commission bado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats!.commissions.list.map(c => {
                  const st = STATUS_LABELS[c.status] ?? STATUS_LABELS.pending
                  const isPaying = commPaying === c.id
                  return (
                    <div key={c.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{c.client_name}</p>
                          <p className="text-xs text-gray-400 truncate">{c.property_title}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs mb-3">
                        <div>
                          <p className="text-gray-400">Inayotarajiwa</p>
                          <p className="font-bold text-gray-800">TSh {fmt(c.expected_amount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Imelipwa</p>
                          <p className="font-bold text-green-600">TSh {fmt(c.paid_amount)}</p>
                        </div>
                        {c.expected_amount > c.paid_amount && (
                          <div>
                            <p className="text-gray-400">Baki</p>
                            <p className="font-bold text-red-500">TSh {fmt(c.expected_amount - c.paid_amount)}</p>
                          </div>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                        <div className="h-full bg-green-400 rounded-full"
                          style={{ width: `${Math.min(100, c.paid_amount / c.expected_amount * 100)}%` }} />
                      </div>

                      {/* Pay inline */}
                      {isPaying ? (
                        <div className="flex gap-2">
                          <input type="number" inputMode="numeric" placeholder="Kiasi kilicholipwa"
                            value={commPayAmount} onChange={e => setCommPayAmount(e.target.value)}
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                          <button onClick={() => payCommission(c.id)}
                            className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold">✓</button>
                          <button onClick={() => { setCommPaying(null); setCommPayAmount('') }}
                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs">✕</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {c.status !== 'paid' && (
                            <button onClick={() => { setCommPaying(c.id); setCommPayAmount('') }}
                              className="flex-1 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-semibold border border-amber-200">
                              Rekodi malipo
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteConfirm({ id: c.id, type: 'commission', label: c.client_name })}
                            disabled={deleting === c.id}
                            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 border border-gray-100">
                            <i className={`ti ${deleting === c.id ? 'ti-loader animate-spin' : 'ti-trash'} text-red-400 text-sm`} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ─── RIPOTI TAB ─────────────────────────────────────────────────── */}
        {tab === 'ripoti' && (
          <div className="space-y-4">
            {/* Summary recap */}
            {stats && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
                <p className="text-sm font-semibold text-gray-800">Muhtasari — {MONTHS[period.month]} {period.year}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-green-50 rounded-xl py-3">
                    <p className="text-base font-bold text-green-700">TSh {fmt(stats.summary.monthIncome)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Mapato</p>
                  </div>
                  <div className="text-center bg-red-50 rounded-xl py-3">
                    <p className="text-base font-bold text-red-600">TSh {fmt(stats.summary.monthExpenses)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Matumizi</p>
                  </div>
                  <div className={`text-center rounded-xl py-3 ${stats.summary.monthProfit >= 0 ? 'bg-primary-50' : 'bg-red-50'}`}>
                    <p className={`text-base font-bold ${stats.summary.monthProfit >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
                      TSh {fmt(stats.summary.monthProfit)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Faida</p>
                  </div>
                </div>
              </div>
            )}

            {/* Print report */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <i className="ti ti-printer text-gray-600 text-lg" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Ripoti ya PDF</p>
                  <p className="text-xs text-gray-400">Chapisha au save kama PDF</p>
                </div>
              </div>
              <button onClick={openReport}
                className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <i className="ti ti-download" aria-hidden="true" />
                Pakua Ripoti — {MONTHS[period.month]} {period.year}
              </button>
            </div>

            {/* Amina advice card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-xs font-bold">A</div>
                <p className="text-sm font-semibold">Amina — Ushauri wa AI</p>
              </div>
              {advice ? (
                <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">{advice}</p>
              ) : (
                <button onClick={fetchAdvice} disabled={advLoading}
                  className="w-full bg-white/10 hover:bg-white/20 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-50">
                  {advLoading ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Amina anafikiri...</span> : <span className="flex items-center justify-center gap-1.5"><i className="ti ti-message-chatbot text-sm" aria-hidden="true" />Pata ushauri wa biashara</span>}
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────────── */}
      {modal === 'income'     && <IncomeForm     onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadStats() }} />}
      {modal === 'expense'    && <ExpenseForm    onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadStats() }} />}
      {modal === 'commission' && <CommissionForm onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadStats() }} />}
      {modal === 'goal'       && (
        <GoalForm
          currentGoal={stats?.goal}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); loadStats() }}
        />
      )}

      {/* ─── Delete confirmation dialog ──────────────────────────────── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-3 flex justify-center">
              <i className="ti ti-trash text-red-400" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Futa rekodi?</h3>
            <p className="text-sm text-gray-500 mb-5 truncate">{deleteConfirm.label}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold"
              >
                Hapana
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'income') deleteIncome(deleteConfirm.id)
                  else if (deleteConfirm.type === 'expense') deleteExpense(deleteConfirm.id)
                  else deleteCommission(deleteConfirm.id)
                }}
                disabled={!!deleting}
                className="py-3 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? 'Inafuta...' : 'Ndiyo, futa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
