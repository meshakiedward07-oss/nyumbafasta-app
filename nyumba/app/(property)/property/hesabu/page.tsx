'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

const SWAHILI_MONTHS = [
  'Jan','Feb','Mac','Apr','Mei','Jun',
  'Jul','Ago','Sep','Okt','Nov','Des',
]

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return Math.abs(n).toLocaleString('en-TZ')
}

function fmtMoneyFull(n: number) {
  return `TZS ${Math.abs(n).toLocaleString('en-TZ')}`
}

type TrendRow = { month: string; revenue: number; expenses: number; net: number }
type TxRow    = { id: string; date: string; description: string; amount: number; type: 'income'|'expense'; category: string }

interface AccountingData {
  year:          number
  ytd:           { revenue: number; expenses: number; net: number }
  current_month: { revenue: number; expenses: number; net: number }
  prior_month:   { revenue: number; expenses: number; net: number }
  growth:        { revenue_pct: number|null; expenses_pct: number|null; net_pct: number|null }
  trend:         TrendRow[]
  transactions:  TxRow[]
}

interface PendingProof {
  id: string; lease_id: string; amount_due: number; due_date: string
  proof_url: string | null; proof_uploaded_at: string | null
  ai_extracted: { amount: number|null; date: string|null; reference: string|null; method: string|null; confidence: string } | null
  lease: {
    id: string; monthly_rent: number
    tenant: { full_name: string|null; phone: string|null } | null
    unit: { unit_number: string } | null
  } | null
}

interface IncomeEntry {
  id: string; submitted_by_role: string; amount_tzs: number; payment_date: string
  payment_method: string; reference_number: string|null; description: string
  receipt_url: string|null; status: string; rejection_reason: string|null
  ai_extracted: { amount: number|null; date: string|null; reference: string|null } | null
  submitter: { full_name: string|null } | null
  lease: { tenant: { full_name: string|null } | null; unit: { unit_number: string } | null } | null
}

const METHOD_LABELS: Record<string, string> = {
  mpesa: 'M-Pesa', airtel: 'Airtel Money', tigopesa: 'Tigo Pesa',
  halopesa: 'HaloPesa', cash: 'Pesa Taslimu', bank_transfer: 'Benki', other: 'Nyingine',
}

function GrowthChip({ pct, inverse }: { pct: number|null; inverse?: boolean }) {
  if (pct === null) return null
  const isGood = inverse ? pct < 0 : pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      <i className={`ti ti-trending-${pct >= 0 ? 'up' : 'down'} text-[9px]`} aria-hidden="true" />
      {pct >= 0 ? '+' : ''}{pct}%
    </span>
  )
}

export default function HesabuPage() {
  const { t } = useLanguage()
  const router  = useRouter()
  const [orgId, setOrgId]   = useState<string | null>(null)
  const [data,  setData]    = useState<AccountingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Pending proofs (lease_payments with proof_uploaded status)
  const [pendingProofs,   setPendingProofs]   = useState<PendingProof[]>([])
  // Pending income entries (tenant-submitted, awaiting org review)
  const [pendingIncome,   setPendingIncome]   = useState<IncomeEntry[]>([])
  const [verifying,       setVerifying]       = useState<string | null>(null)
  const [reviewingEntry,  setReviewingEntry]  = useState<string | null>(null)

  // "Ingiza Mapato" form state
  const [showForm,  setShowForm]  = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formErr, setFormErr] = useState<string|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    amount_tzs:      '',
    payment_date:    new Date().toISOString().split('T')[0],
    payment_method:  'cash',
    reference_number: '',
    description:     '',
    receipt_url:     '',
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [parsing, setParsing] = useState(false)

  const loadPending = useCallback(async (id: string) => {
    try {
      const [proofRes, incomeRes] = await Promise.all([
        fetch(`/api/v1/organizations/${id}/lease-payments?status=proof&limit=10`),
        fetch(`/api/v1/organizations/${id}/income?status=pending_review&limit=20`),
      ])
      const [proofData, incomeData] = await Promise.all([proofRes.json(), incomeRes.json()])
      setPendingProofs(proofData.payments ?? [])
      setPendingIncome(incomeData.entries ?? [])
    } catch { /* silent */ }
  }, [])

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
        const [accRes] = await Promise.all([
          fetch(`/api/v1/organizations/${id}/accounting`),
          loadPending(id),
        ])
        const json = await accRes.json()
        if (!accRes.ok) { setError(json.error ?? 'Hitilafu'); return }
        setData(json)
      } catch { setError('Hitilafu ya mtandao.') }
      finally { setLoading(false) }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleVerifyProof(paymentId: string, leaseId: string) {
    if (!orgId) return
    setVerifying(paymentId)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/leases/${leaseId}/payments/${paymentId}/verify`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Imethibitishwa kutoka hesabu' }),
      })
      if (res.ok) {
        setPendingProofs(prev => prev.filter(p => p.id !== paymentId))
      }
    } catch { /* silent */ }
    finally { setVerifying(null) }
  }

  async function handleIncomeReview(entryId: string, action: 'approve'|'reject', reason?: string) {
    if (!orgId) return
    setReviewingEntry(entryId)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/income/${entryId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejection_reason: reason }),
      })
      if (res.ok) {
        setPendingIncome(prev => prev.filter(e => e.id !== entryId))
      }
    } catch { /* silent */ }
    finally { setReviewingEntry(null) }
  }

  async function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setReceiptFile(f)
    setReceiptPreview(URL.createObjectURL(f))
    setFormErr(null)

    try {
      // 1. OCR in the browser (Tesseract.js — free, on-device)
      setParsing(true)
      const { ocrAndParse } = await import('@/lib/ocr/parseReceipt')
      const parsed = await ocrAndParse(f)
      setParsing(false)
      if (parsed.amount)    setForm(prev => ({ ...prev, amount_tzs:      String(parsed.amount) }))
      if (parsed.date)      setForm(prev => ({ ...prev, payment_date:    parsed.date! }))
      if (parsed.reference) setForm(prev => ({ ...prev, reference_number: parsed.reference! }))
      if (parsed.method)    setForm(prev => ({ ...prev, payment_method:  parsed.method! }))

      // 2. Upload to Cloudinary
      setUploadingReceipt(true)
      const fd = new FormData()
      fd.append('file', f)
      const uploadRes = await fetch('/api/v1/upload/listing', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      setUploadingReceipt(false)
      if (!uploadRes.ok || !uploadData.url) {
        setFormErr(uploadData.error ?? 'Imeshindwa kupakia picha.'); return
      }
      setForm(prev => ({ ...prev, receipt_url: uploadData.url }))
    } catch {
      setFormErr('Imeshindwa kusoma risiti.')
      setParsing(false)
      setUploadingReceipt(false)
    }
  }

  async function handleSubmitIncome(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    if (!form.amount_tzs || Number(form.amount_tzs) <= 0) { setFormErr(t('pr_hesabu_err_amount')); return }
    setFormLoading(true)
    setFormErr(null)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/income`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_tzs:      Number(form.amount_tzs),
          payment_date:    form.payment_date,
          payment_method:  form.payment_method,
          reference_number: form.reference_number || null,
          description:     form.description || 'Mapato ya mkono',
          receipt_url:     form.receipt_url || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setFormErr(json.error ?? 'Imeshindwa.'); return }
      setShowForm(false)
      setReceiptFile(null)
      setReceiptPreview(null)
      setForm({ amount_tzs: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', reference_number: '', description: '', receipt_url: '' })
      // Reload accounting data
      const accRes = await fetch(`/api/v1/organizations/${orgId}/accounting`)
      if (accRes.ok) setData(await accRes.json())
    } catch { setFormErr('Hitilafu ya mtandao.') }
    finally { setFormLoading(false) }
  }

  const chartMax = data ? Math.max(...data.trend.map(t => Math.max(t.revenue, t.expenses)), 1) : 1

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <i className="ti ti-alert-circle text-4xl text-red-400" aria-hidden="true" />
        <p className="text-red-500 font-medium">{error}</p>
        <button onClick={() => window.location.reload()} className="text-primary-600 text-sm underline">{t('pr_try_again')}</button>
      </div>
    )
  }
  if (!data) return null

  const { ytd, current_month: cur, prior_month: prev, growth, trend, transactions, year } = data
  const totalPending = pendingProofs.length + pendingIncome.length

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('pr_hesabu_title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{t('pr_hesabu_subtitle')} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          {totalPending > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded-full">
              {totalPending} {t('pr_hesabu_zinasubiri')}
            </span>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-primary-500 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-primary-600 transition"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            {t('pr_hesabu_ingiza')}
          </button>
        </div>
      </div>

      {/* ── Pending Proof Verifications ─────────────────────────────────── */}
      {pendingProofs.length > 0 && (
        <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 flex items-center gap-2">
            <i className="ti ti-upload text-amber-600 text-lg" aria-hidden="true" />
            <h2 className="font-semibold text-amber-800 text-sm">{t('pr_hesabu_pending_proofs')}</h2>
            <span className="ml-auto text-[10px] bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-full">
              {pendingProofs.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingProofs.map(p => {
              const ai = p.ai_extracted
              const tenantName = p.lease?.tenant?.full_name ?? 'Mpangaji'
              const unitNo     = p.lease?.unit?.unit_number ?? ''
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start gap-3">
                    {p.proof_url ? (
                      <a href={p.proof_url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.proof_url} alt="Risiti" className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center">
                        <i className="ti ti-file text-amber-400 text-xl" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{tenantName}</p>
                      <p className="text-xs text-gray-400">{unitNo} · Due {new Date(p.due_date).toLocaleDateString('sw-TZ')}</p>
                      {ai && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {ai.amount && (
                            <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              TZS {ai.amount.toLocaleString()}
                            </span>
                          )}
                          {ai.method && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {METHOD_LABELS[ai.method] ?? ai.method}
                            </span>
                          )}
                          {ai.reference && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                              {ai.reference}
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            ai.confidence === 'high' ? 'bg-primary-50 text-primary-600' :
                            ai.confidence === 'medium' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-100 text-gray-400'
                          }`}>
                            AI: {ai.confidence}
                          </span>
                        </div>
                      )}
                      {!ai && (
                        <p className="text-xs text-gray-400 mt-1">
                          Imelipwa ~TZS {p.amount_due.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleVerifyProof(p.id, p.lease_id)}
                      disabled={verifying === p.id}
                      className="flex-1 bg-green-500 text-white text-xs font-semibold py-2 rounded-xl hover:bg-green-600 disabled:opacity-50 transition flex items-center justify-center gap-1"
                    >
                      <i className="ti ti-check" aria-hidden="true" />
                      {verifying === p.id ? t('pr_kodi_verifying') : t('pr_hesabu_verify_proof')}
                    </button>
                    <a href={p.proof_url ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition flex items-center gap-1">
                      <i className="ti ti-eye" aria-hidden="true" />{t('pr_btn_view')}
                    </a>
                    <Link href={`/property/wapangaji/${p.lease_id}`}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition flex items-center gap-1">
                      <i className="ti ti-user" aria-hidden="true" />{t('pr_hesabu_view_record')}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Pending Income Claims (submitted by tenants) ─────────────────── */}
      {pendingIncome.length > 0 && (
        <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 flex items-center gap-2">
            <i className="ti ti-cash text-blue-600 text-lg" aria-hidden="true" />
            <h2 className="font-semibold text-blue-800 text-sm">{t('pr_hesabu_income_claims')}</h2>
            <span className="ml-auto text-[10px] bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded-full">
              {pendingIncome.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingIncome.map(e => {
              const tenantName = e.lease?.tenant?.full_name ?? e.submitter?.full_name ?? 'Mpangaji'
              const unitNo     = e.lease?.unit?.unit_number ?? ''
              return (
                <div key={e.id} className="p-4">
                  <div className="flex items-start gap-3">
                    {e.receipt_url ? (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.receipt_url} alt="Risiti" className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center">
                        <i className="ti ti-cash text-blue-400 text-xl" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{tenantName}</p>
                      <p className="text-xs text-gray-400">{unitNo} · {new Date(e.payment_date).toLocaleDateString('sw-TZ')}</p>
                      <p className="text-sm font-bold text-primary-600 mt-0.5">
                        TZS {Number(e.amount_tzs).toLocaleString()}
                      </p>
                      {e.reference_number && (
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{e.reference_number}</p>
                      )}
                      {e.description && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{e.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleIncomeReview(e.id, 'approve')}
                      disabled={reviewingEntry === e.id}
                      className="flex-1 bg-green-500 text-white text-xs font-semibold py-2 rounded-xl hover:bg-green-600 disabled:opacity-50 transition flex items-center justify-center gap-1"
                    >
                      <i className="ti ti-check" aria-hidden="true" />
                      {reviewingEntry === e.id ? t('pr_hesabu_approve_loading') : t('pr_hesabu_verify_proof')}
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Sababu ya kukataa:')
                        if (reason) handleIncomeReview(e.id, 'reject', reason)
                      }}
                      disabled={reviewingEntry === e.id}
                      className="px-3 py-2 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      {t('pr_hesabu_reject_label')}
                    </button>
                    {e.receipt_url && (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition flex items-center gap-1">
                        <i className="ti ti-eye" aria-hidden="true" />{t('pr_hesabu_receipt_label2')}
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── YTD Summary Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-gray-100 rounded-2xl p-3">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{t('pr_hesabu_ytd_revenue')}</p>
          <p className="text-lg font-bold text-gray-900 mt-1">Tsh {fmtMoney(ytd.revenue)}</p>
          <GrowthChip pct={growth.revenue_pct} />
          <p className="text-[9px] text-gray-400 mt-0.5">{t('pr_hesabu_prior_month')}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-3">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{t('pr_hesabu_ytd_expenses')}</p>
          <p className="text-lg font-bold text-gray-900 mt-1">Tsh {fmtMoney(ytd.expenses)}</p>
          <GrowthChip pct={growth.expenses_pct} inverse />
          <p className="text-[9px] text-gray-400 mt-0.5">{t('pr_hesabu_prior_month')}</p>
        </div>
        <div className={`border rounded-2xl p-3 ${ytd.net >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{t('pr_hesabu_ytd_net')}</p>
          <p className={`text-lg font-bold mt-1 ${ytd.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {ytd.net < 0 ? '-' : ''}Tsh {fmtMoney(ytd.net)}
          </p>
          <GrowthChip pct={growth.net_pct} />
          <p className="text-[9px] text-gray-400 mt-0.5">{t('pr_hesabu_prior_month')}</p>
        </div>
      </div>

      {/* ── Current vs Prior Month ──────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <i className="ti ti-calendar-stats text-primary-500 text-lg" aria-hidden="true" />
          <h2 className="font-semibold text-gray-900 text-sm">{t('pr_hesabu_compare_heading')}</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: t('pr_hesabu_row_revenue'), cur: cur.revenue, prev: prev.revenue, pct: growth.revenue_pct, color: 'bg-primary-400', inverse: false },
            { label: t('pr_hesabu_row_expenses'), cur: cur.expenses, prev: prev.expenses, pct: growth.expenses_pct, color: 'bg-red-400', inverse: true },
            { label: t('pr_hesabu_row_net'), cur: cur.net, prev: prev.net, pct: growth.net_pct, color: cur.net >= 0 ? 'bg-green-400' : 'bg-red-500', inverse: false },
          ].map(row => {
            const maxVal = Math.max(Math.abs(row.cur), Math.abs(row.prev), 1)
            const curW   = (Math.abs(row.cur) / maxVal) * 100
            const prevW  = (Math.abs(row.prev) / maxVal) * 100
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-800">{row.cur < 0 ? '-' : ''}Tsh {fmtMoney(row.cur)}</span>
                    <GrowthChip pct={row.pct} inverse={row.inverse} />
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 w-12 text-right">{t('pr_hesabu_chart_this')}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${curW}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 w-12 text-right">{t('pr_hesabu_chart_prev')}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gray-300" style={{ width: `${prevW}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 12-month Chart ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <i className="ti ti-chart-bar text-primary-500 text-lg" aria-hidden="true" />
          <h2 className="font-semibold text-gray-900 text-sm">{t('pr_hesabu_trend_heading')}</h2>
        </div>
        <div className="flex items-end gap-1 h-32">
          {trend.map(row => {
            const revH = chartMax > 0 ? (row.revenue / chartMax) * 100 : 0
            const expH = chartMax > 0 ? (row.expenses / chartMax) * 100 : 0
            const [, mo] = row.month.split('-').map(Number)
            const isNow  = row.month === `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
            return (
              <div key={row.month} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end justify-center gap-0.5 h-24">
                  <div className={`flex-1 rounded-t transition-all ${isNow ? 'bg-primary-500' : 'bg-primary-200'}`}
                    style={{ height: `${revH}%`, minHeight: row.revenue > 0 ? '3px' : '0' }} />
                  <div className={`flex-1 rounded-t transition-all ${isNow ? 'bg-red-400' : 'bg-red-200'}`}
                    style={{ height: `${expH}%`, minHeight: row.expenses > 0 ? '3px' : '0' }} />
                </div>
                <span className={`text-[8px] font-medium ${isNow ? 'text-primary-600' : 'text-gray-400'}`}>
                  {SWAHILI_MONTHS[mo-1]}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-1 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary-400 inline-block" />{t('pr_hesabu_row_revenue')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-300 inline-block" />{t('pr_hesabu_row_expenses')}</span>
        </div>
      </div>

      {/* ── P&L Table ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <i className="ti ti-trending-up text-primary-500 text-lg" aria-hidden="true" />
          <h2 className="font-semibold text-gray-900 text-sm">{t('pr_hesabu_pl_heading')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-400 font-medium">
                <th className="text-left px-4 py-2">{t('pr_hesabu_pl_month_col')}</th>
                <th className="text-right px-3 py-2">{t('pr_hesabu_row_revenue')}</th>
                <th className="text-right px-3 py-2">{t('pr_hesabu_row_expenses')}</th>
                <th className="text-right px-4 py-2">{t('pr_hesabu_pl_profit_col')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...trend].reverse().map(row => {
                const [yr, mo] = row.month.split('-').map(Number)
                const isNow = row.month === `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
                return (
                  <tr key={row.month} className={isNow ? 'bg-primary-50/40' : ''}>
                    <td className="px-4 py-2.5 font-medium text-gray-700">
                      {SWAHILI_MONTHS[mo-1]} {yr}
                      {isNow && <span className="ml-1 text-[9px] bg-primary-100 text-primary-600 px-1 rounded-full">{t('pr_hesabu_now')}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-800 font-medium tabular-nums">
                      {row.revenue > 0 ? `Tsh ${fmtMoney(row.revenue)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.expenses > 0 ? <span className="text-red-500">Tsh {fmtMoney(row.expenses)}</span> : '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${row.net > 0 ? 'text-green-600' : row.net < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {row.net !== 0 ? `${row.net < 0 ? '-' : ''}Tsh ${fmtMoney(row.net)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Transaction Ledger ──────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="ti ti-list-details text-primary-500 text-lg" aria-hidden="true" />
            <h2 className="font-semibold text-gray-900 text-sm">{t('pr_hesabu_ledger_heading')}</h2>
          </div>
          <div className="flex gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-400 inline-block" />{t('pr_hesabu_row_revenue')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{t('pr_hesabu_row_expenses')}</span>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div className="py-12 text-center">
            <i className="ti ti-receipt-off text-3xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-400 text-sm mt-2">{t('pr_hesabu_no_txns')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map(tx => {
              const date = new Date(tx.date)
              const dateStr = `${date.getDate()} ${SWAHILI_MONTHS[date.getMonth()]}`
              const isIncome = tx.type === 'income'
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-primary-50' : 'bg-red-50'}`}>
                    <i className={`ti ${isIncome ? 'ti-arrow-down-left text-primary-500' : 'ti-arrow-up-right text-red-500'} text-sm`} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                    <p className="text-[10px] text-gray-400">{tx.category} · {dateStr}</p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums flex-shrink-0 ${isIncome ? 'text-primary-600' : 'text-red-500'}`}>
                    {isIncome ? '+' : '-'}{fmtMoneyFull(tx.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
        {transactions.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50 flex justify-between items-center">
            <span className="text-[10px] text-gray-400">{transactions.length} {t('pr_hesabu_recent_txns')}</span>
            <div className="flex gap-2">
              <Link href="/property/kodi" className="text-xs text-primary-600 font-medium hover:underline">{t('pr_nav_kodi')} →</Link>
              <Link href="/property/matumizi" className="text-xs text-primary-600 font-medium hover:underline">{t('pr_nav_matumizi')} →</Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 pb-4">
        <Link href="/property/matumizi"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3.5 hover:shadow-sm transition">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ti ti-receipt text-red-500" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">{t('pr_nav_matumizi')}</p>
            <p className="text-[10px] text-gray-400">{t('pr_hesabu_expenses_link_desc')}</p>
          </div>
          <i className="ti ti-chevron-right text-gray-300 ml-auto flex-shrink-0" aria-hidden="true" />
        </Link>
        <Link href="/property/taarifa"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3.5 hover:shadow-sm transition">
          <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ti ti-file-analytics text-primary-500" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">{t('pr_nav_taarifa')}</p>
            <p className="text-[10px] text-gray-400">{t('pr_taarifa_subtitle')}</p>
          </div>
          <i className="ti ti-chevron-right text-gray-300 ml-auto flex-shrink-0" aria-hidden="true" />
        </Link>
      </div>

      {/* ── Manual Income Entry Drawer ──────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl">
              <h2 className="font-bold text-gray-900">{t('pr_hesabu_ingiza_mkono')}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <i className="ti ti-x text-lg" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmitIncome} className="p-5 space-y-4">
              {/* Receipt upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('pr_hesabu_receipt_label')}
                </label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptSelect} className="hidden" />
                {receiptPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={receiptPreview} alt="Risiti" className="w-full h-40 object-contain bg-gray-50 rounded-xl" />
                    {(parsing || uploadingReceipt) && (
                      <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-xl gap-2">
                        <i className="ti ti-loader-2 animate-spin text-primary-500 text-2xl" aria-hidden="true" />
                        <span className="text-xs text-gray-500">{parsing ? t('pr_hesabu_scanning') : t('pr_hesabu_uploading')}</span>
                      </div>
                    )}
                    {!parsing && !uploadingReceipt && receiptPreview && (
                      <div className="absolute top-2 right-2 bg-green-50 rounded-lg px-2 py-1 flex items-center gap-1">
                        <i className="ti ti-scan text-green-600 text-xs" aria-hidden="true" />
                        <span className="text-[10px] text-green-600 font-medium">{t('pr_hesabu_scan_done')}</span>
                      </div>
                    )}
                    <button type="button" onClick={() => { setReceiptFile(null); setReceiptPreview(null); setForm(prev => ({ ...prev, receipt_url: '' })) }}
                      className="absolute top-2 left-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center shadow text-gray-500 hover:text-red-500">
                      <i className="ti ti-x text-xs" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-6 text-gray-400 hover:border-primary-300 hover:text-primary-500 transition text-sm">
                    <i className="ti ti-camera text-xl" aria-hidden="true" />
                    {t('pr_hesabu_photo_btn')}
                  </button>
                )}
                {!receiptFile && (
                  <p className="text-[10px] text-gray-400 mt-1">{t('pr_hesabu_receipt_hint')}</p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pr_hesabu_amount_label')} <span className="text-red-400">*</span>
                </label>
                <input type="number" value={form.amount_tzs} onChange={e => setForm(prev => ({ ...prev, amount_tzs: e.target.value }))}
                  placeholder="500000" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('pr_hesabu_date_label')} <span className="text-red-400">*</span></label>
                  <input type="date" value={form.payment_date} onChange={e => setForm(prev => ({ ...prev, payment_date: e.target.value }))} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                {/* Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('pr_hesabu_method_label')}</label>
                  <select value={form.payment_method} onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    {Object.entries(METHOD_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('pr_hesabu_ref_label')}</label>
                <input type="text" value={form.reference_number} onChange={e => setForm(prev => ({ ...prev, reference_number: e.target.value }))}
                  placeholder="MPZ123456..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('pr_hesabu_desc_label')}</label>
                <input type="text" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mfano: Kodi ya Agosti — Chumba 3"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              {formErr && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                  <i className="ti ti-alert-circle flex-shrink-0" aria-hidden="true" />{formErr}
                </div>
              )}

              <button type="submit" disabled={formLoading || uploadingReceipt || parsing}
                className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-600 transition flex items-center justify-center gap-2">
                {formLoading ? (
                  <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" />{t('pr_hesabu_saving')}</>
                ) : (
                  <><i className="ti ti-check" aria-hidden="true" />{t('pr_hesabu_record_btn')}</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
