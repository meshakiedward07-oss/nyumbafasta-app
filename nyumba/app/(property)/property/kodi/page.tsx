'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedPayment {
  id: string; lease_id: string; status: string
  amount_due: number; amount_paid: number | null
  due_date: string; paid_date: string | null
  invoice_sent_at: string | null; verified_at: string | null
  proof_url: string | null; proof_note: string | null
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
          const collectedH = Math.round((t.collected / max) * 100)
          return (
            <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5 h-24">
                {/* Invoiced bar (background) */}
                <div className="flex-1 bg-gray-100 rounded-t-lg relative" style={{ height: `${invoicedH}%` }}>
                  {/* Collected bar (overlay) */}
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-primary-400 rounded-t-lg"
                    style={{ height: `${invoicedH > 0 ? Math.round((t.collected / t.invoiced) * 100) : 0}%` }}
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

function PaymentRow({
  p, orgId, isOwner, onVerified,
}: {
  p: EnrichedPayment; orgId: string; isOwner: boolean; onVerified: (id: string) => void
}) {
  const [verifying, setVerifying] = useState(false)

  async function handleVerify(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Thibitisha malipo haya kama yaliyolipwa?')) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/leases/${p.lease_id}/payments/${p.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) onVerified(p.id)
    } finally { setVerifying(false) }
  }

  const overdueDays = daysOverdue(p.due_date)

  return (
    <Link href={`/property/wapangaji/${p.lease_id}`} className="block">
      <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition group">
        {/* Avatar */}
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
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span>TZS {p.amount_due.toLocaleString()}</span>
            <span>·</span>
            <span className={overdueDays > 0 && p.status !== 'paid' ? 'text-red-400 font-medium' : ''}>
              {dateFmt(p.due_date)}
              {overdueDays > 0 && p.status !== 'paid' && ` (siku ${overdueDays} zimepita)`}
            </span>
          </div>
          {p.status === 'proof_uploaded' && p.proof_note && (
            <p className="text-[10px] text-gray-400 mt-0.5 truncate">Kumb: {p.proof_note}</p>
          )}
        </div>

        {/* Action */}
        {isOwner && p.status === 'proof_uploaded' ? (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex-shrink-0 bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-60 transition"
          >
            {verifying ? '...' : 'Thibitisha'}
          </button>
        ) : (
          <i className="ti ti-chevron-right text-gray-300 text-base flex-shrink-0 opacity-0 group-hover:opacity-100 transition" aria-hidden="true" />
        )}
      </div>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'pending' | 'proof' | 'paid' | 'overdue' | 'all'

export default function KodiPage() {
  const [orgId,    setOrgId]    = useState<string | null>(null)
  const [isOwner,  setIsOwner]  = useState(false)
  const [data,     setData]     = useState<Analytics | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<Tab>('pending')

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
        if (res.ok) setData(await res.json())
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function handleVerified(paymentId: string) {
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        awaiting_verification: prev.awaiting_verification.filter(p => p.id !== paymentId),
        summary: {
          ...prev.summary,
          total_proof_up: Math.max(0, prev.summary.total_proof_up - 1),
          total_cleared:  prev.summary.total_cleared + 1,
          collection_rate: prev.summary.total_invoices_sent > 0
            ? Math.round(((prev.summary.total_cleared + 1) / prev.summary.total_invoices_sent) * 100)
            : 0,
        },
      }
    })
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3 max-w-3xl mx-auto">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  const s = data?.summary

  // Determine which payments to show in the list tab
  const allAwaiting = data?.awaiting_verification ?? []
  const allOverdue  = data?.overdue_list ?? []

  const tabLabel: Record<Tab, string> = {
    pending:  `Inasubiri (${s?.total_pending ?? 0})`,
    proof:    `Ushahidi (${s?.total_proof_up ?? 0})`,
    paid:     `Zilizolipwa`,
    overdue:  `Zimechelewa (${s?.total_overdue ?? 0})`,
    all:      'Zote',
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto overflow-y-auto">

      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-gray-100 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Malipo ya Kodi</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Usimamizi wa malipo ya wapangaji wako
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon="circle-check" color="bg-green-50 text-green-600"
            label="Zilizolipwa" value={s?.total_cleared ?? 0}
            sub={`${s?.collection_rate ?? 0}% ya makusanyo`}
          />
          <StatCard
            icon="clock" color="bg-amber-50 text-amber-600"
            label="Zinasubiri Malipo" value={s?.total_pending ?? 0}
            sub={s?.amount_outstanding ? `TZS ${fmtMoney(s.amount_outstanding)}` : undefined}
          />
          <StatCard
            icon="upload" color="bg-blue-50 text-blue-600"
            label="Ushahidi Umepakiwa" value={s?.total_proof_up ?? 0}
            sub="Inahitaji uthibitisho"
          />
          <StatCard
            icon="alert-triangle" color="bg-red-50 text-red-500"
            label="Zimechelewa" value={s?.total_overdue ?? 0}
            sub={s?.amount_outstanding ? undefined : undefined}
          />
        </div>

        {/* Collection amount summary */}
        {s && (s.amount_collected > 0 || s.amount_outstanding > 0) && (
          <div className="bg-primary-50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-600 font-medium">Jumla Iliyokusanywa</p>
              <p className="text-2xl font-bold text-primary-700 tabular-nums">
                TZS {fmtMoney(s.amount_collected)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Inayosubiri</p>
              <p className="text-lg font-bold text-amber-600 tabular-nums">
                TZS {fmtMoney(s.amount_outstanding)}
              </p>
            </div>
          </div>
        )}

        {/* 6-month chart */}
        {data && data.monthly_trend.length > 0 && (
          <CollectionBar trend={data.monthly_trend} />
        )}

        {/* Awaiting verification */}
        {allAwaiting.length > 0 && (
          <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-blue-50">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <i className="ti ti-upload text-blue-500" aria-hidden="true" />
                Inahitaji Uthibitisho ({allAwaiting.length})
              </p>
            </div>
            <div className="p-2">
              {allAwaiting.map(p => (
                <PaymentRow key={p.id} p={p} orgId={orgId!} isOwner={isOwner} onVerified={handleVerified} />
              ))}
            </div>
          </div>
        )}

        {/* Overdue payments */}
        {allOverdue.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-red-50">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <i className="ti ti-alert-triangle text-red-400" aria-hidden="true" />
                Zimechelewa ({allOverdue.length})
              </p>
            </div>
            <div className="p-2">
              {allOverdue.map(p => (
                <PaymentRow key={p.id} p={p} orgId={orgId!} isOwner={isOwner} onVerified={handleVerified} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && allAwaiting.length === 0 && allOverdue.length === 0 && (s?.total_cleared ?? 0) === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
            <i className="ti ti-building-bank text-5xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-500 font-medium mt-3">Hakuna malipo bado</p>
            <p className="text-sm text-gray-400 mt-1">
              Weka taarifa za benki yako kwenye KYC, kisha malipo ya wapangaji watakapotumwa hapa yataonekana.
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

        {/* Recent paid payments summary */}
        {(s?.total_cleared ?? 0) > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Hali ya Jumla</p>
            </div>
            <div className="space-y-2.5">
              <ProgressRow
                label="Kiwango cha Makusanyo"
                value={s?.collection_rate ?? 0}
                color="bg-green-400"
              />
              {(s?.total_invoices_sent ?? 0) > 0 && (
                <ProgressRow
                  label="Zilizotumwa Invoisi"
                  value={Math.round(((s?.total_invoices_sent ?? 0) / Math.max(s?.total_cleared ?? 1, 1)) * 100)}
                  color="bg-blue-400"
                />
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <p className="text-gray-400">Invoisi Zote</p>
                <p className="font-bold text-gray-800">{s?.total_invoices_sent ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-400">Zilizolipwa</p>
                <p className="font-bold text-green-600">{s?.total_cleared ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-400">Zinasubiri</p>
                <p className="font-bold text-amber-500">{s?.total_pending ?? 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/property/wapangaji" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-primary-200 transition group">
            <i className="ti ti-users text-primary-500 text-xl" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-800">Wapangaji</p>
              <p className="text-[10px] text-gray-400">Angalia mikataba</p>
            </div>
          </Link>
          <Link href="/property/kyc" className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-primary-200 transition group">
            <i className="ti ti-building-bank text-amber-500 text-xl" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-800">Taarifa za Benki</p>
              <p className="text-[10px] text-gray-400">Sasisha akaunti yako</p>
            </div>
          </Link>
        </div>

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
