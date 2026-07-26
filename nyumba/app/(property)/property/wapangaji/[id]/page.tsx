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
  pending:        { label: 'Inasubiri Malipo',     cls: 'bg-amber-50 text-amber-700',   icon: 'clock'          },
  proof_uploaded: { label: 'Ushahidi Umepakiwa',   cls: 'bg-blue-50 text-blue-700',     icon: 'upload'         },
  paid:           { label: 'Imelipwa',              cls: 'bg-green-50 text-green-700',   icon: 'circle-check'   },
  partial:        { label: 'Ilipwa Kidogo',         cls: 'bg-orange-50 text-orange-700', icon: 'circle-half'    },
  late:           { label: 'Imechelewa',            cls: 'bg-red-50 text-red-600',       icon: 'alert-circle'   },
  void:           { label: 'Imebatilishwa',         cls: 'bg-gray-100 text-gray-400',    icon: 'ban'            },
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

  // Proof upload modal state
  const [proofFor,  setProofFor]  = useState<Payment | null>(null)
  const [proofUrl,  setProofUrl]  = useState('')
  const [proofNote, setProofNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [proofErr,  setProofErr]  = useState<string | null>(null)

  // Verify modal state
  const [verifyFor, setVerifyFor]  = useState<Payment | null>(null)
  const [verifyNote, setVerifyNote] = useState('')
  const [verifying, setVerifying]  = useState(false)
  const [verifyErr, setVerifyErr]  = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) return
        const id  = primary.organization.id as string
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
      {/* Proof upload modal */}
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

      {/* Verify modal */}
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
            lease.status === 'active' ? 'bg-green-50 text-green-700' :
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
        <h2 className="text-sm font-bold text-gray-900 mb-3">Historia ya Malipo ({payments.length})</h2>

        {payments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <i className="ti ti-receipt text-4xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-400 text-sm mt-2">Hakuna rekodi za malipo bado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map(payment => {
              const st      = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.pending
              const overdue = isOverdue(payment)
              return (
                <div key={payment.id} className={`bg-white rounded-2xl border p-4 shadow-sm transition ${overdue ? 'border-red-100' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${overdue ? 'bg-red-50 text-red-600' : st.cls}`}>
                          <i className={`ti ti-${overdue ? 'alert-circle' : st.icon} mr-1`} />
                          {overdue ? 'Imechelewa' : st.label}
                        </span>
                        {payment.invoice_sent_at && (
                          <span className="text-[10px] text-gray-400">Ankara ilitumwa</span>
                        )}
                      </div>
                      <p className="text-lg font-bold text-gray-900">{fmt(payment.amount_due)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Inastahili: {dateFmt(payment.due_date)}
                        {payment.paid_date && ` · Ilipwa: ${dateFmt(payment.paid_date)}`}
                        {payment.verified_at && ` · Ilithibitishwa: ${dateFmt(payment.verified_at)}`}
                      </p>
                      {payment.proof_url && (
                        <a href={payment.proof_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 flex items-center gap-1">
                          <i className="ti ti-file" /> Angalia Ushahidi
                          {payment.proof_note && ` — ${payment.proof_note}`}
                        </a>
                      )}
                      {payment.status === 'paid' && payment.verified_at && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <i className="ti ti-circle-check" /> Imethibitishwa
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {/* Org side: verify proof */}
                      {isOwner && payment.status === 'proof_uploaded' && (
                        <button onClick={() => { setVerifyFor(payment); setVerifyNote('') }}
                          className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition">
                          Thibitisha
                        </button>
                      )}
                      {/* Org side: upload proof on behalf of tenant */}
                      {isOwner && ['pending', 'partial'].includes(payment.status) && (
                        <button onClick={() => { setProofFor(payment); setProofUrl(''); setProofNote('') }}
                          className="text-xs px-3 py-1.5 bg-primary-50 text-primary-700 rounded-xl font-medium hover:bg-primary-100 transition">
                          {payment.proof_url ? 'Sasisha Ushahidi' : 'Pakia Ushahidi'}
                        </button>
                      )}
                    </div>
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
