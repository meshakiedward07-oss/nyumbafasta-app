'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import type { Lease } from '@/lib/types/property'

interface Payment {
  id: string; lease_id: string; amount_due: number; amount_paid: number | null
  due_date: string; paid_date: string | null; status: string
  payment_method: string | null; reference: string | null; notes: string | null
  invoice_sent_at: string | null; proof_url: string | null; proof_note: string | null
  proof_uploaded_at: string | null; verified_by: string | null; verified_at: string | null
}

interface Banking {
  bank_name: string; account_name: string; account_number: string
  branch: string | null; mobile_money_number: string | null
  mobile_money_provider: string | null; additional_instructions: string | null
}

const PAYMENT_STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  pending:        { label: 'Inasubiri Malipo',     cls: 'bg-amber-50 text-amber-700',   icon: 'clock'        },
  proof_uploaded: { label: 'Ushahidi Umepakiwa',   cls: 'bg-blue-50 text-blue-700',     icon: 'upload'       },
  paid:           { label: 'Imelipwa',              cls: 'bg-green-50 text-green-700',   icon: 'circle-check' },
  partial:        { label: 'Ilipwa Kidogo',         cls: 'bg-orange-50 text-orange-700', icon: 'circle-half'  },
  late:           { label: 'Imechelewa',            cls: 'bg-red-50 text-red-600',       icon: 'alert-circle' },
  void:           { label: 'Imebatilishwa',         cls: 'bg-gray-100 text-gray-400',    icon: 'ban'          },
}

function fmt(n: number) { return `TZS ${n.toLocaleString()}` }
function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
}
function isOverdue(payment: Payment) {
  return ['pending', 'partial'].includes(payment.status) && new Date(payment.due_date) < new Date()
}

export default function LeaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leaseId } = use(params)

  const [orgId,    setOrgId]    = useState<string | null>(null)
  const [lease,    setLease]    = useState<Lease | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [banking,  setBanking]  = useState<Banking | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [isOwner,  setIsOwner]  = useState(false)

  // Proof upload modal
  const [proofFor,   setProofFor]   = useState<Payment | null>(null)
  const [proofUrl,   setProofUrl]   = useState('')
  const [proofNote,  setProofNote]  = useState('')
  const [uploading,  setUploading]  = useState(false)
  const [proofErr,   setProofErr]   = useState<string | null>(null)

  // Verify modal
  const [verifyFor,  setVerifyFor]  = useState<Payment | null>(null)
  const [verifyNote, setVerifyNote] = useState('')
  const [verifying,  setVerifying]  = useState(false)
  const [verifyErr,  setVerifyErr]  = useState<string | null>(null)

  // Record cash payment modal
  const [recordFor,  setRecordFor]  = useState<Payment | null>(null)
  const [recordNew,  setRecordNew]  = useState(false) // true when creating a brand-new payment row
  const [recordForm, setRecordForm] = useState({
    amount_due: '', due_date: new Date().toISOString().split('T')[0],
    paid_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank', reference: '', notes: '',
  })
  const [recording,  setRecording]  = useState(false)
  const [recordErr,  setRecordErr]  = useState<string | null>(null)

  // Remind / void / send-invoice loading states (per payment id)
  const [reminding,      setReminding]      = useState<string | null>(null)
  const [voiding,        setVoiding]        = useState<string | null>(null)
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null)

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

        const res  = await fetch(`/api/v1/organizations/${id}/leases/${leaseId}`)
        const data = await res.json()
        setLease(data.lease ?? null)
        setPayments(data.payments ?? [])
        setBanking(data.banking ?? null)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [leaseId])

  async function submitProof() {
    if (!proofFor || !orgId) return
    if (!proofUrl.trim()) { setProofErr('Weka kiungo cha ushahidi'); return }
    setUploading(true); setProofErr(null)
    const res = await fetch(
      `/api/v1/organizations/${orgId}/leases/${leaseId}/payments/${proofFor.id}/proof`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_url: proofUrl.trim(), proof_note: proofNote.trim() }) }
    )
    const data = await res.json()
    if (!res.ok) { setProofErr(data.error ?? 'Kuna tatizo'); setUploading(false); return }
    setPayments(prev => prev.map(p => p.id === proofFor.id ? data.payment : p))
    setProofFor(null); setProofUrl(''); setProofNote(''); setUploading(false)
  }

  async function submitVerify() {
    if (!verifyFor || !orgId) return
    setVerifying(true); setVerifyErr(null)
    const res = await fetch(
      `/api/v1/organizations/${orgId}/leases/${leaseId}/payments/${verifyFor.id}/verify`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: verifyNote.trim() }) }
    )
    const data = await res.json()
    if (!res.ok) { setVerifyErr(data.error ?? 'Kuna tatizo'); setVerifying(false); return }
    setPayments(prev => prev.map(p => p.id === verifyFor.id ? data.payment : p))
    setVerifyFor(null); setVerifyNote(''); setVerifying(false)
  }

  async function submitRecord(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setRecording(true); setRecordErr(null)

    if (recordNew) {
      // Create a brand-new payment record (e.g., cash not yet in system)
      const body = {
        amount_due:     parseFloat(recordForm.amount_due) || (lease as unknown as { monthly_rent: number })?.monthly_rent,
        amount_paid:    parseFloat(recordForm.amount_due) || (lease as unknown as { monthly_rent: number })?.monthly_rent,
        due_date:       recordForm.due_date,
        paid_date:      recordForm.paid_date,
        payment_method: recordForm.payment_method,
        reference:      recordForm.reference.trim() || null,
        notes:          recordForm.notes.trim() || null,
        status:         'paid',
      }
      const res  = await fetch(`/api/v1/organizations/${orgId}/leases/${leaseId}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setRecordErr(data.error ?? 'Kuna tatizo'); setRecording(false); return }
      setPayments(prev => [data.payment, ...prev])
    } else if (recordFor) {
      // Mark an existing payment as paid
      const res = await fetch(`/api/v1/organizations/${orgId}/leases/${leaseId}/payments/${recordFor.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         'mark_paid',
          paid_date:      recordForm.paid_date,
          payment_method: recordForm.payment_method,
          reference:      recordForm.reference.trim() || null,
          notes:          recordForm.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setRecordErr(data.error ?? 'Kuna tatizo'); setRecording(false); return }
      setPayments(prev => prev.map(p => p.id === recordFor!.id ? data.payment : p))
    }

    setRecordFor(null); setRecordNew(false)
    setRecordForm({ amount_due: '', due_date: new Date().toISOString().split('T')[0],
      paid_date: new Date().toISOString().split('T')[0], payment_method: 'bank', reference: '', notes: '' })
    setRecording(false)
  }

  async function handleRemind(payment: Payment) {
    if (!orgId) return
    setReminding(payment.id)
    await fetch(`/api/v1/organizations/${orgId}/leases/${leaseId}/payments/${payment.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remind' }),
    }).catch(() => {})
    setReminding(null)
  }

  async function handleSendInvoice(payment: Payment) {
    if (!orgId) return
    setSendingInvoice(payment.id)
    const res  = await fetch(`/api/v1/organizations/${orgId}/leases/${leaseId}/payments/${payment.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_invoice' }),
    })
    const data = await res.json()
    if (res.ok) setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, invoice_sent_at: data.payment?.invoice_sent_at ?? new Date().toISOString() } : p))
    setSendingInvoice(null)
  }

  async function handleVoid(payment: Payment) {
    if (!orgId) return
    if (!confirm(`Batilisha malipo haya ya ${fmt(payment.amount_due)}? Hatua hii haiwezi kurudishwa.`)) return
    setVoiding(payment.id)
    const res  = await fetch(`/api/v1/organizations/${orgId}/leases/${leaseId}/payments/${payment.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'void' }),
    })
    const data = await res.json()
    if (res.ok) setPayments(prev => prev.map(p => p.id === payment.id ? data.payment : p))
    setVoiding(null)
  }

  if (loading) return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}
    </div>
  )

  if (!lease) return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto text-center py-16">
      <i className="ti ti-file-off text-5xl text-gray-200" aria-hidden="true" />
      <p className="text-gray-500 mt-3 font-medium">Mkataba haupatikani</p>
      <Link href="/property/wapangaji" className="mt-4 inline-block text-sm text-primary-600 hover:underline">Rudi</Link>
    </div>
  )

  const tenant  = lease.tenant  as unknown as { full_name: string | null; phone: string | null; avatar_url?: string | null } | null
  const unit    = lease.unit    as unknown as { unit_number: string; unit_type: string; monthly_rent: number } | null
  const listing = lease.listing as unknown as { title: string; district: string; region: string } | null

  const paid    = payments.filter(p => p.status === 'paid').length
  const pending = payments.filter(p => ['pending', 'partial', 'proof_uploaded'].includes(p.status)).length
  const overdue = payments.filter(isOverdue).length

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">

      {/* ── Proof upload modal ─────────────────────────────────────────────────── */}
      {proofFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Pakia Ushahidi wa Malipo</h2>
            <p className="text-sm text-gray-500 mb-4">Malipo ya <strong>{fmt(proofFor.amount_due)}</strong> — {dateFmt(proofFor.due_date)}</p>
            <div className="space-y-3">
              {banking && (
                <div className="bg-primary-50 rounded-xl p-3 text-xs space-y-1">
                  <p className="font-semibold text-primary-700">Ulituma wapi:</p>
                  <p className="text-primary-600">{banking.bank_name} — {banking.account_name} — {banking.account_number}</p>
                  {banking.mobile_money_number && <p className="text-primary-600">Mobile Money: {banking.mobile_money_number}</p>}
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Kiungo cha Picha ya Risiti / Bank Statement *</label>
                <input type="url" value={proofUrl} onChange={e => setProofUrl(e.target.value)}
                  placeholder="https://drive.google.com/... au https://cloudinary.com/..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                <p className="text-[10px] text-gray-400 mt-1">Pakia picha au PDF kwenye Google Drive/Cloudinary, kisha bandika kiungo.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Namba ya Muamala (hiari)</label>
                <input value={proofNote} onChange={e => setProofNote(e.target.value)} placeholder="mfano: QJT123456"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              {proofErr && <p className="text-sm text-red-600">{proofErr}</p>}
              <div className="flex gap-2">
                <button onClick={submitProof} disabled={uploading || !proofUrl.trim()}
                  className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                  {uploading ? 'Inapakia...' : 'Tuma Ushahidi'}
                </button>
                <button onClick={() => { setProofFor(null); setProofErr(null) }}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Ghairi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Verify modal ──────────────────────────────────────────────────────── */}
      {verifyFor && isOwner && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Thibitisha Malipo</h2>
            <p className="text-sm text-gray-500 mb-4">Malipo ya <strong>{fmt(verifyFor.amount_due)}</strong></p>
            {verifyFor.proof_url && (
              <a href={verifyFor.proof_url} target="_blank" rel="noopener noreferrer"
                className="block mb-4 text-sm text-primary-600 hover:underline flex items-center gap-1">
                <i className="ti ti-external-link" /> Angalia Ushahidi
              </a>
            )}
            {verifyFor.proof_note && (
              <p className="text-xs text-gray-500 mb-3">Namba ya muamala: <strong>{verifyFor.proof_note}</strong></p>
            )}
            <textarea value={verifyNote} onChange={e => setVerifyNote(e.target.value)} rows={2}
              placeholder="Maelezo ya ziada (hiari)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
            {verifyErr && <p className="text-sm text-red-600 mb-2">{verifyErr}</p>}
            <div className="flex gap-2">
              <button onClick={submitVerify} disabled={verifying}
                className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-600 disabled:opacity-40 transition">
                {verifying ? 'Inathibitisha...' : '✓ Thibitisha Malipo'}
              </button>
              <button onClick={() => { setVerifyFor(null); setVerifyErr(null) }}
                className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Ghairi</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record/Mark-paid modal ─────────────────────────────────────────────── */}
      {(recordFor || recordNew) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {recordNew ? 'Ongeza Rekodi ya Malipo' : 'Rekodi Malipo ya Fedha Taslimu'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {recordFor
                ? `${fmt(recordFor.amount_due)} — ${dateFmt(recordFor.due_date)}`
                : `${tenant?.full_name ?? 'Mpangaji'} · ${unit?.unit_number ?? ''}`}
            </p>
            <form onSubmit={submitRecord} className="space-y-3">
              {recordNew && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Kiasi (TZS) *</label>
                    <input type="number" value={recordForm.amount_due}
                      onChange={e => setRecordForm(f => ({ ...f, amount_due: e.target.value }))}
                      placeholder={String(unit?.monthly_rent ?? '')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Tarehe ya Ankara</label>
                    <input type="date" value={recordForm.due_date}
                      onChange={e => setRecordForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Tarehe ya Malipo *</label>
                <input type="date" value={recordForm.paid_date}
                  onChange={e => setRecordForm(f => ({ ...f, paid_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Njia ya Malipo</label>
                <select value={recordForm.payment_method}
                  onChange={e => setRecordForm(f => ({ ...f, payment_method: e.target.value }))}
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
                <label className="text-xs font-medium text-gray-600 block mb-1">Namba ya Muamala / Risiti</label>
                <input type="text" value={recordForm.reference}
                  onChange={e => setRecordForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="Namba ya risiti au muamala"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Maelezo</label>
                <input type="text" value={recordForm.notes}
                  onChange={e => setRecordForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Maelezo ya ziada..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              {recordErr && <p className="text-sm text-red-600">{recordErr}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={recording}
                  className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-600 disabled:opacity-50 transition">
                  {recording ? 'Inarekodi...' : '✓ Rekodi Malipo'}
                </button>
                <button type="button" onClick={() => { setRecordFor(null); setRecordNew(false); setRecordErr(null) }}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Ghairi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Back + header */}
      <div>
        <Link href="/property/wapangaji"
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3">
          <i className="ti ti-arrow-left text-sm" /> Rudi Wapangaji
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{tenant?.full_name ?? 'Mpangaji'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {unit?.unit_number ?? ''} · {listing?.title ?? ''} · {listing?.district}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${
            lease.status === 'active'     ? 'bg-green-50 text-green-700' :
            lease.status === 'terminated' ? 'bg-red-50 text-red-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            {lease.status === 'active' ? 'Inaendelea' : lease.status === 'terminated' ? 'Imesimamishwa' : lease.status}
          </span>
        </div>
      </div>

      {/* Lease details */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-3 font-medium">Maelezo ya Mkataba</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Kodi ya Kila Mwezi</span>
              <span className="font-bold text-primary-600">{fmt(lease.monthly_rent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Deposit</span>
              <span className="font-medium">{lease.deposit_amount ? fmt(lease.deposit_amount) : '—'}
                {lease.deposit_paid && <span className="ml-1 text-xs text-green-600">(Imelipwa)</span>}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ilianza</span>
              <span className="font-medium">{dateFmt(lease.start_date)}</span>
            </div>
            {lease.end_date && (
              <div className="flex justify-between">
                <span className="text-gray-500">Inaisha</span>
                <span className="font-medium">{dateFmt(lease.end_date)}</span>
              </div>
            )}
            {tenant?.phone && (
              <div className="flex justify-between">
                <span className="text-gray-500">Simu</span>
                <a href={`tel:${tenant.phone}`} className="font-medium text-primary-600 hover:underline">{tenant.phone}</a>
              </div>
            )}
          </div>
        </div>

        {/* Payment summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-3 font-medium">Muhtasari wa Malipo</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Zililipwa',    value: paid,    cls: 'text-green-600' },
              { label: 'Zinasubiri',   value: pending, cls: 'text-amber-600' },
              { label: 'Zimechelewa', value: overdue, cls: 'text-red-600'   },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {banking && (
            <div className="mt-3 pt-3 border-t border-gray-50 text-xs">
              <p className="text-gray-400 mb-1 font-medium">Benki ya Malipo</p>
              <p className="font-semibold text-gray-800">{banking.bank_name}</p>
              <p className="text-gray-600">{banking.account_name} · {banking.account_number}</p>
              {banking.mobile_money_number && (
                <p className="text-gray-600">{banking.mobile_money_number} ({banking.mobile_money_provider})</p>
              )}
            </div>
          )}
          {!banking && isOwner && (
            <Link href="/property/kyc" className="mt-3 block text-xs text-amber-600 hover:underline">
              <i className="ti ti-alert-circle" /> Weka maelezo ya benki kwenye KYC
            </Link>
          )}
        </div>
      </div>

      {/* Payment records */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">Historia ya Malipo ({payments.length})</h2>
          {isOwner && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRecordNew(true); setRecordFor(null)
                  setRecordForm(f => ({ ...f, amount_due: String(lease.monthly_rent ?? '') }))
                }}
                className="flex items-center gap-1.5 bg-primary-500 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-primary-600 transition"
              >
                <i className="ti ti-plus text-sm" />
                Ongeza Rekodi
              </button>
            </div>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <i className="ti ti-receipt text-4xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-400 text-sm mt-2">Hakuna rekodi za malipo bado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map(payment => {
              const st      = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.pending
              const late    = isOverdue(payment)
              return (
                <div key={payment.id} className={`bg-white rounded-2xl border p-4 shadow-sm transition ${late ? 'border-red-100' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${late ? 'bg-red-50 text-red-600' : st.cls}`}>
                          <i className={`ti ti-${late ? 'alert-circle' : st.icon} mr-1`} />
                          {late ? 'Imechelewa' : st.label}
                        </span>
                        {payment.invoice_sent_at && (
                          <span className="text-[10px] text-gray-400">Ankara ilitumwa</span>
                        )}
                        {payment.payment_method && payment.status === 'paid' && (
                          <span className="text-[10px] text-gray-400 capitalize">{payment.payment_method}</span>
                        )}
                      </div>
                      <p className="text-lg font-bold text-gray-900">{fmt(payment.amount_due)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Inastahili: {dateFmt(payment.due_date)}
                        {payment.paid_date && ` · Ilipwa: ${dateFmt(payment.paid_date)}`}
                        {payment.reference && ` · Ref: ${payment.reference}`}
                        {payment.verified_at && ` · Ilithibitishwa: ${dateFmt(payment.verified_at)}`}
                      </p>
                      {payment.proof_url && (
                        <a href={payment.proof_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1">
                          <i className="ti ti-file" /> Angalia Ushahidi
                          {payment.proof_note && ` — ${payment.proof_note}`}
                        </a>
                      )}
                    </div>

                    {/* Action buttons */}
                    {isOwner && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {payment.status === 'proof_uploaded' && (
                          <button onClick={() => { setVerifyFor(payment); setVerifyNote('') }}
                            className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition">
                            Thibitisha
                          </button>
                        )}
                        {payment.status === 'paid' && (
                          <a href={`/rent/receipt/${payment.id}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-xl font-medium hover:bg-green-100 transition flex items-center gap-1 whitespace-nowrap">
                            <i className="ti ti-receipt text-xs" />Risiti
                          </a>
                        )}
                        {['pending', 'partial', 'late'].includes(payment.status) && (
                          <>
                            {!payment.invoice_sent_at && (
                              <button onClick={() => handleSendInvoice(payment)} disabled={sendingInvoice === payment.id}
                                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl font-medium hover:bg-blue-100 disabled:opacity-60 transition whitespace-nowrap">
                                {sendingInvoice === payment.id ? '...' : 'Tuma Ankara'}
                              </button>
                            )}
                            <button onClick={() => { setRecordFor(payment); setRecordNew(false) }}
                              className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-xl font-medium hover:bg-green-100 transition whitespace-nowrap">
                              Imelipwa
                            </button>
                            <button onClick={() => { setProofFor(payment); setProofUrl(''); setProofNote('') }}
                              className="text-xs px-3 py-1.5 bg-primary-50 text-primary-700 rounded-xl font-medium hover:bg-primary-100 transition">
                              {payment.proof_url ? 'Sasisha' : 'Pakia'}
                            </button>
                            {(late || payment.status === 'late') && (
                              <button onClick={() => handleRemind(payment)} disabled={reminding === payment.id}
                                className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl font-medium hover:bg-amber-100 disabled:opacity-60 transition">
                                {reminding === payment.id ? '...' : 'Kumbusha'}
                              </button>
                            )}
                          </>
                        )}
                        {payment.status !== 'paid' && payment.status !== 'void' && (
                          <button onClick={() => handleVoid(payment)} disabled={voiding === payment.id}
                            className="text-xs px-3 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition disabled:opacity-60">
                            {voiding === payment.id ? '...' : 'Batilisha'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
