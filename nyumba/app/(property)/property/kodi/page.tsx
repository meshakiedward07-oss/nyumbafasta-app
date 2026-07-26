'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedPayment {
  id: string; lease_id: string; status: string
  amount_due: number; amount_paid: number | null
  due_date: string; paid_date: string | null
  invoice_sent_at: string | null; verified_at: string | null
  proof_url: string | null; proof_note: string | null
  payment_method: string | null; reference: string | null
  tenant_name: string | null; tenant_phone: string | null; unit_number: string | null
}

interface MonthBar { month: string; collected: number; invoiced: number }

interface Analytics {
  summary: {
    total_invoices_sent: number; total_cleared: number; total_pending: number
    total_proof_up: number; total_overdue: number
    amount_collected: number; amount_outstanding: number; collection_rate: number
  }
  monthly_trend:         MonthBar[]
  awaiting_verification: EnrichedPayment[]
  overdue_list:          EnrichedPayment[]
}

type Tab = 'overview' | 'pending' | 'proof' | 'paid' | 'overdue' | 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysOverdue(iso: string) {
  return Math.ceil((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function isLate(p: EnrichedPayment) {
  return ['pending', 'partial'].includes(p.status) && new Date(p.due_date) < new Date()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <i className={`ti ti-${icon} text-lg`} aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function CollectionBar({ trend }: { trend: MonthBar[] }) {
  const max = Math.max(...trend.map(t => t.invoiced), 1)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm font-semibold text-gray-700 mb-4">Mwenendo wa Makusanyo (miezi 6)</p>
      <div className="flex items-end gap-2 h-28">
        {trend.map(t => {
          const invoicedH  = Math.round((t.invoiced  / max) * 100)
          const collectedH = invoicedH > 0 ? Math.round((t.collected / t.invoiced) * 100) : 0
          return (
            <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5 h-24">
                <div className="flex-1 bg-gray-100 rounded-t-lg relative" style={{ height: `${invoicedH}%` }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-primary-400 rounded-t-lg"
                    style={{ height: `${collectedH}%` }}
                  />
                </div>
              </div>
              <p className="text-[9px] text-gray-400 text-center leading-tight">{t.month}</p>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100 inline-block" />Iliyotumwa</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary-400 inline-block" />Iliyokusanywa</span>
      </div>
    </div>
  )
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── PaymentRow ───────────────────────────────────────────────────────────────

function PaymentRow({
  p, orgId, isOwner, onVerified, onReminded, onMarkedPaid, onInvoiceSent,
}: {
  p: EnrichedPayment; orgId: string; isOwner: boolean
  onVerified:     (id: string) => void
  onReminded:     (id: string) => void
  onMarkedPaid:   (id: string) => void
  onInvoiceSent:  (id: string) => void
}) {
  const [verifying,      setVerifying]      = useState(false)
  const [reminding,      setReminding]      = useState(false)
  const [marking,        setMarking]        = useState(false)
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [markModal,      setMarkModal]      = useState(false)
  const [markForm,   setMarkForm]   = useState({ paid_date: new Date().toISOString().split('T')[0], payment_method: 'bank', reference: '', notes: '' })
  const [markErr,    setMarkErr]    = useState<string | null>(null)

  const overdueFlag = isLate(p)

  async function handleVerify(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Thibitisha malipo haya kama yaliyolipwa?')) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/leases/${p.lease_id}/payments/${p.id}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      if (res.ok) onVerified(p.id)
    } finally { setVerifying(false) }
  }

  async function handleRemind(e: React.MouseEvent) {
    e.preventDefault()
    setReminding(true)
    try {
      await fetch(`/api/v1/organizations/${orgId}/leases/${p.lease_id}/payments/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remind' }),
      })
      onReminded(p.id)
    } finally { setReminding(false) }
  }

  async function handleSendInvoice(e: React.MouseEvent) {
    e.preventDefault()
    setSendingInvoice(true)
    try {
      await fetch(`/api/v1/organizations/${orgId}/leases/${p.lease_id}/payments/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_invoice' }),
      })
      onInvoiceSent(p.id)
    } finally { setSendingInvoice(false) }
  }

  async function handleMarkPaid(e: React.FormEvent) {
    e.preventDefault()
    setMarking(true); setMarkErr(null)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/leases/${p.lease_id}/payments/${p.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid', ...markForm }),
      })
      const data = await res.json()
      if (!res.ok) { setMarkErr(data.error ?? 'Kuna tatizo'); return }
      setMarkModal(false)
      onMarkedPaid(p.id)
    } finally { setMarking(false) }
  }

  const overdueDays = daysOverdue(p.due_date)

  return (
    <>
      {/* Mark-paid inline modal */}
      {markModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setMarkModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">Rekodi Malipo ya Fedha Taslimu</h3>
            <p className="text-sm text-gray-500 mb-4">
              {p.tenant_name} · TZS {p.amount_due.toLocaleString()} · {dateFmt(p.due_date)}
            </p>
            <form onSubmit={handleMarkPaid} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Tarehe ya Malipo</label>
                <input type="date" value={markForm.paid_date}
                  onChange={e => setMarkForm(f => ({ ...f, paid_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Njia ya Malipo</label>
                <select value={markForm.payment_method}
                  onChange={e => setMarkForm(f => ({ ...f, payment_method: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="bank">Benki</option>
                  <option value="cash">Fedha Taslimu</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="airtel">Airtel Money</option>
                  <option value="tigo">Tigo Pesa</option>
                  <option value="halopesa">HaloPesa</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Namba ya Muamala (hiari)</label>
                <input type="text" value={markForm.reference}
                  onChange={e => setMarkForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="Namba ya risiti / muamala"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Maelezo (hiari)</label>
                <input type="text" value={markForm.notes}
                  onChange={e => setMarkForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Maelezo ya ziada..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              {markErr && <p className="text-sm text-red-600">{markErr}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={marking}
                  className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600 disabled:opacity-50 transition">
                  {marking ? 'Inarekodi...' : '✓ Rekodi Malipo'}
                </button>
                <button type="button" onClick={() => setMarkModal(false)}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Ghairi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Link href={`/property/wapangaji/${p.lease_id}`} className="block">
        <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition group">
          <div className="w-9 h-9 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0 text-primary-600 font-bold text-sm">
            {p.tenant_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-gray-900 truncate">{p.tenant_name ?? 'Mpangaji'}</p>
              {p.unit_number && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{p.unit_number}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
              <span>TZS {p.amount_due.toLocaleString()}</span>
              <span>·</span>
              <span className={overdueFlag && p.status !== 'paid' ? 'text-red-400 font-medium' : ''}>
                {dateFmt(p.due_date)}
                {overdueFlag && p.status !== 'paid' && ` (siku ${overdueDays})`}
              </span>
              {p.status === 'paid' && (
                <span className="text-green-500 font-medium flex items-center gap-0.5">
                  <i className="ti ti-circle-check text-xs" />Imelipwa
                </span>
              )}
              {p.status === 'proof_uploaded' && (
                <span className="text-blue-500 font-medium flex items-center gap-0.5">
                  <i className="ti ti-upload text-xs" />Ushahidi umepakiwa
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {isOwner && (
            <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.preventDefault()}>
              {p.status === 'proof_uploaded' && (
                <button onClick={handleVerify} disabled={verifying}
                  className="bg-green-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-60 transition whitespace-nowrap">
                  {verifying ? '...' : 'Thibitisha'}
                </button>
              )}
              {['pending', 'partial', 'late'].includes(p.status) && (
                <>
                  {!p.invoice_sent_at && (
                    <button onClick={handleSendInvoice} disabled={sendingInvoice}
                      className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-60 transition whitespace-nowrap">
                      {sendingInvoice ? '...' : 'Tuma Ankara'}
                    </button>
                  )}
                  <button onClick={(e) => { e.preventDefault(); setMarkModal(true) }}
                    className="bg-primary-50 text-primary-700 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-primary-100 transition whitespace-nowrap">
                    Imelipwa
                  </button>
                  {(overdueFlag || p.status === 'late') && (
                    <button onClick={handleRemind} disabled={reminding}
                      className="bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-60 transition whitespace-nowrap">
                      {reminding ? '...' : 'Kumbusha'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Link>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: Tab[] = ['overview', 'pending', 'proof', 'overdue', 'paid', 'all']
const TAB_LABEL: Record<Tab, string> = {
  overview: 'Muhtasari',
  pending:  'Zinasubiri',
  proof:    'Ushahidi',
  paid:     'Zilizolipwa',
  overdue:  'Zimechelewa',
  all:      'Zote',
}
const TAB_STATUS: Partial<Record<Tab, string>> = {
  pending: 'pending',
  proof:   'proof',
  paid:    'paid',
  overdue: 'overdue',
  all:     'all',
}

export default function KodiPage() {
  const [orgId,       setOrgId]       = useState<string | null>(null)
  const [isOwner,     setIsOwner]     = useState(false)
  const [analytics,   setAnalytics]   = useState<Analytics | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<Tab>('overview')
  const [payments,    setPayments]    = useState<EnrichedPayment[]>([])
  const [payLoading,  setPayLoading]  = useState(false)
  const [payTotal,    setPayTotal]    = useState(0)
  const [payOffset,   setPayOffset]   = useState(0)

  // Load org + analytics once
  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) return
        const id   = primary.organization.id as string
        const role = primary.role as string
        setOrgId(id)
        setIsOwner(['owner', 'branch_manager', 'accountant'].includes(role))

        const res = await fetch(`/api/v1/organizations/${id}/rent-analytics`)
        if (res.ok) setAnalytics(await res.json())
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Load payments when tab changes (not for overview)
  const loadPayments = useCallback(async (t: Tab, id: string, off = 0) => {
    if (t === 'overview') return
    const status = TAB_STATUS[t] ?? 'all'
    setPayLoading(true)
    try {
      const res  = await fetch(`/api/v1/organizations/${id}/lease-payments?status=${status}&offset=${off}`)
      if (!res.ok) return
      const data = await res.json()
      if (off === 0) {
        setPayments(data.payments ?? [])
      } else {
        setPayments(prev => [...prev, ...(data.payments ?? [])])
      }
      setPayTotal(data.total ?? 0)
      setPayOffset(off)
    } catch { /* silent */ }
    finally { setPayLoading(false) }
  }, [])

  useEffect(() => {
    if (!orgId || tab === 'overview') return
    loadPayments(tab, orgId, 0)
  }, [tab, orgId, loadPayments])

  // Optimistic updates for overview tab
  function handleVerified(paymentId: string) {
    setAnalytics(prev => {
      if (!prev) return prev
      return {
        ...prev,
        awaiting_verification: prev.awaiting_verification.filter(p => p.id !== paymentId),
        summary: {
          ...prev.summary,
          total_proof_up: Math.max(0, prev.summary.total_proof_up - 1),
          total_cleared:  prev.summary.total_cleared + 1,
        },
      }
    })
    setPayments(prev => prev.filter(p => p.id !== paymentId))
  }

  function handleReminded(_paymentId: string) {
    // no-op state change needed; just a fire-and-forget notification
  }

  function handleMarkedPaid(paymentId: string) {
    setPayments(prev => prev.filter(p => p.id !== paymentId))
    setAnalytics(prev => {
      if (!prev) return prev
      return {
        ...prev,
        overdue_list: prev.overdue_list.filter(p => p.id !== paymentId),
        summary: {
          ...prev.summary,
          total_pending: Math.max(0, prev.summary.total_pending - 1),
          total_overdue: Math.max(0, prev.summary.total_overdue - 1),
          total_cleared: prev.summary.total_cleared + 1,
        },
      }
    })
  }

  function handleInvoiceSent(paymentId: string) {
    // Mark invoice_sent_at on the in-memory payment rows so button disappears
    setPayments(prev => prev.map(p =>
      p.id === paymentId ? { ...p, invoice_sent_at: new Date().toISOString() } : p
    ))
    setAnalytics(prev => {
      if (!prev) return prev
      return {
        ...prev,
        awaiting_verification: prev.awaiting_verification.map(p =>
          p.id === paymentId ? { ...p, invoice_sent_at: new Date().toISOString() } : p
        ),
        overdue_list: prev.overdue_list.map(p =>
          p.id === paymentId ? { ...p, invoice_sent_at: new Date().toISOString() } : p
        ),
      }
    })
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 space-y-3 max-w-3xl mx-auto">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  const s = analytics?.summary
  const allAwaiting = analytics?.awaiting_verification ?? []
  const allOverdue  = analytics?.overdue_list ?? []

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto overflow-y-auto">

      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Malipo ya Kodi</h1>
            <p className="text-xs text-gray-400 mt-0.5">Usimamizi wa malipo ya wapangaji wako</p>
          </div>
          {orgId && (
            <a
              href={`/api/v1/organizations/${orgId}/lease-payments?status=${tab === 'overview' ? 'all' : tab}&format=csv`}
              download
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-2 rounded-xl hover:bg-gray-50 transition flex-shrink-0"
            >
              <i className="ti ti-file-export text-sm" aria-hidden="true" />
              Pakua CSV
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* KPI cards — always visible */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon="circle-check" color="bg-green-50 text-green-600"
            label="Zilizolipwa" value={s?.total_cleared ?? 0}
            sub={`${s?.collection_rate ?? 0}% ya makusanyo`} />
          <StatCard icon="clock" color="bg-amber-50 text-amber-600"
            label="Zinasubiri" value={s?.total_pending ?? 0}
            sub={s?.amount_outstanding ? `TZS ${fmtMoney(s.amount_outstanding)}` : undefined} />
          <StatCard icon="upload" color="bg-blue-50 text-blue-600"
            label="Ushahidi Umepakiwa" value={s?.total_proof_up ?? 0}
            sub="Inahitaji uthibitisho" />
          <StatCard icon="alert-triangle" color="bg-red-50 text-red-500"
            label="Zimechelewa" value={s?.total_overdue ?? 0} />
        </div>

        {/* Amount summary */}
        {s && (s.amount_collected > 0 || s.amount_outstanding > 0) && (
          <div className="bg-primary-50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-600 font-medium">Jumla Iliyokusanywa</p>
              <p className="text-2xl font-bold text-primary-700 tabular-nums">TZS {fmtMoney(s.amount_collected)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Inayosubiri</p>
              <p className="text-lg font-bold text-amber-600 tabular-nums">TZS {fmtMoney(s.amount_outstanding)}</p>
            </div>
          </div>
        )}

        {/* 6-month chart */}
        {analytics && analytics.monthly_trend.length > 0 && (
          <CollectionBar trend={analytics.monthly_trend} />
        )}

        {/* Tab switcher */}
        <div className="flex overflow-x-auto gap-1 -mx-1 px-1 pb-0.5">
          {TABS.map(t => {
            const count =
              t === 'pending' ? (s?.total_pending ?? 0) :
              t === 'proof'   ? (s?.total_proof_up ?? 0) :
              t === 'overdue' ? (s?.total_overdue ?? 0) : null
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                  tab === t
                    ? 'bg-primary-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {TAB_LABEL[t]}
                {count !== null && count > 0 && (
                  <span className={`text-[10px] min-w-[16px] h-4 rounded-full px-1 flex items-center justify-center leading-none font-bold ${
                    tab === t ? 'bg-white/30 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── OVERVIEW tab ──────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            {/* Awaiting verification */}
            {allAwaiting.length > 0 && orgId && (
              <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden">
                <div className="flex items-center px-5 py-3 border-b border-blue-50">
                  <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <i className="ti ti-upload text-blue-500" aria-hidden="true" />
                    Inahitaji Uthibitisho ({allAwaiting.length})
                  </p>
                </div>
                <div className="p-2">
                  {allAwaiting.map(p => (
                    <PaymentRow key={p.id} p={p} orgId={orgId} isOwner={isOwner}
                      onVerified={handleVerified} onReminded={handleReminded} onMarkedPaid={handleMarkedPaid} onInvoiceSent={handleInvoiceSent} />
                  ))}
                </div>
              </div>
            )}

            {/* Overdue */}
            {allOverdue.length > 0 && orgId && (
              <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
                <div className="flex items-center px-5 py-3 border-b border-red-50">
                  <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                    <i className="ti ti-alert-triangle text-red-400" aria-hidden="true" />
                    Zimechelewa ({allOverdue.length})
                  </p>
                </div>
                <div className="p-2">
                  {allOverdue.map(p => (
                    <PaymentRow key={p.id} p={p} orgId={orgId} isOwner={isOwner}
                      onVerified={handleVerified} onReminded={handleReminded} onMarkedPaid={handleMarkedPaid} onInvoiceSent={handleInvoiceSent} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {allAwaiting.length === 0 && allOverdue.length === 0 && (s?.total_cleared ?? 0) === 0 && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <i className="ti ti-building-bank text-5xl text-gray-200" aria-hidden="true" />
                <p className="text-gray-500 font-medium mt-3">Hakuna malipo bado</p>
                <p className="text-sm text-gray-400 mt-1">
                  Weka taarifa za benki kwenye KYC, kisha malipo ya wapangaji wataonekana hapa.
                </p>
                <div className="flex gap-3 justify-center mt-4">
                  <Link href="/property/kyc">
                    <button className="bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
                      Weka Taarifa za Benki
                    </button>
                  </Link>
                  <Link href="/property/wapangaji">
                    <button className="border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                      Angalia Wapangaji
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {/* Summary bar */}
            {(s?.total_cleared ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Hali ya Jumla</p>
                <div className="space-y-2.5">
                  <ProgressRow label="Kiwango cha Makusanyo" value={s?.collection_rate ?? 0} color="bg-green-400" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                  {[
                    { label: 'Invoisi Zote',  value: s?.total_invoices_sent ?? 0, cls: 'text-gray-800' },
                    { label: 'Zilizolipwa',   value: s?.total_cleared ?? 0,       cls: 'text-green-600' },
                    { label: 'Zinasubiri',    value: s?.total_pending ?? 0,        cls: 'text-amber-500' },
                  ].map(({ label, value, cls }) => (
                    <div key={label}>
                      <p className="text-gray-400">{label}</p>
                      <p className={`font-bold ${cls}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/property/wapangaji" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-primary-200 transition">
                <i className="ti ti-users text-primary-500 text-xl" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Wapangaji</p>
                  <p className="text-[10px] text-gray-400">Angalia mikataba</p>
                </div>
              </Link>
              <Link href="/property/kyc" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-primary-200 transition">
                <i className="ti ti-building-bank text-amber-500 text-xl" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Taarifa za Benki</p>
                  <p className="text-[10px] text-gray-400">Sasisha akaunti yako</p>
                </div>
              </Link>
            </div>
          </>
        )}

        {/* ── FILTERED PAYMENT TABS ─────────────────────────────────────────────── */}
        {tab !== 'overview' && orgId && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-700">
                {TAB_LABEL[tab]}
                {payTotal > 0 && <span className="text-gray-400 font-normal ml-1.5">({payTotal})</span>}
              </p>
            </div>

            {payLoading && payments.length === 0 ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-xl" />)}
              </div>
            ) : payments.length === 0 ? (
              <div className="p-10 text-center">
                <i className="ti ti-receipt-off text-4xl text-gray-200" aria-hidden="true" />
                <p className="text-gray-400 text-sm mt-2">Hakuna malipo</p>
              </div>
            ) : (
              <>
                <div className="p-2">
                  {payments.map(p => (
                    <PaymentRow key={p.id} p={p} orgId={orgId} isOwner={isOwner}
                      onVerified={handleVerified} onReminded={handleReminded} onMarkedPaid={handleMarkedPaid} onInvoiceSent={handleInvoiceSent} />
                  ))}
                </div>
                {payments.length < payTotal && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => loadPayments(tab, orgId, payOffset + 30)}
                      disabled={payLoading}
                      className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                      {payLoading ? 'Inapakia...' : `Onyesha zaidi (${payTotal - payments.length} zimebaki)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
