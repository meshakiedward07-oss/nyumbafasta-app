'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'

interface Payment {
  id: string; lease_id: string; status: string
  amount_due: number; amount_paid: number | null
  due_date: string; paid_date: string | null
  proof_url: string | null; proof_note: string | null
  proof_uploaded_at: string | null; verified_at: string | null
}

interface LeaseInfo {
  id: string; monthly_rent: number; start_date: string; end_date: string | null; status: string
  unit: { unit_number: string; unit_type: string } | null
  listing: { title: string; district: string; region: string } | null
}

interface Banking {
  bank_name: string; account_name: string; account_number: string
  branch: string | null; mobile_money_number: string | null
  mobile_money_provider: string | null; additional_instructions: string | null
}

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    pending:        { label: 'Inasubiri Malipo',   cls: 'bg-amber-50 text-amber-700 border-amber-200',  icon: 'clock'        },
    partial:        { label: 'Ilipwa Kidogo',       cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'circle-half' },
    proof_uploaded: { label: 'Ushahidi Umepakiwa', cls: 'bg-blue-50 text-blue-700 border-blue-200',    icon: 'upload'       },
    paid:           { label: 'Imelipwa',            cls: 'bg-green-50 text-green-700 border-green-200', icon: 'circle-check' },
    void:           { label: 'Imebatilishwa',       cls: 'bg-gray-100 text-gray-400 border-gray-200',   icon: 'ban'          },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200', icon: 'help-circle' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${s.cls}`}>
      <i className={`ti ti-${s.icon}`} aria-hidden="true" />
      {s.label}
    </span>
  )
}

type Step = 'form' | 'done'

export default function TenantProofPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = use(params)

  const [payment, setPayment] = useState<Payment | null>(null)
  const [lease,   setLease]   = useState<LeaseInfo | null>(null)
  const [banking, setBanking] = useState<Banking | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authErr, setAuthErr] = useState<string | null>(null)

  const [step,      setStep]      = useState<Step>('form')
  const [proofUrl,  setProofUrl]  = useState('')
  const [proofNote, setProofNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitErr,  setSubmitErr]  = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/v1/payments/rent/${paymentId}`)
        if (res.status === 401) { setAuthErr('login'); return }
        if (res.status === 403) { setAuthErr('forbidden'); return }
        if (!res.ok)            { setAuthErr('notfound'); return }
        const data = await res.json()
        setPayment(data.payment)
        setLease(data.lease)
        setBanking(data.banking)
        setOrgName(data.org_name)
        // Pre-fill if there's existing proof
        if (data.payment?.proof_url)  setProofUrl(data.payment.proof_url)
        if (data.payment?.proof_note) setProofNote(data.payment.proof_note)
      } catch { setAuthErr('error') }
      finally  { setLoading(false) }
    }
    load()
  }, [paymentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!proofUrl.trim()) { setSubmitErr('Tafadhali weka kiungo cha ushahidi wako.'); return }
    setSubmitting(true)
    setSubmitErr(null)
    try {
      const res = await fetch(`/api/v1/payments/rent/${paymentId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ proof_url: proofUrl, proof_note: proofNote }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitErr(data.error ?? 'Imeshindwa kupakia. Jaribu tena.'); return }
      setPayment(data.payment)
      setStep('done')
    } catch { setSubmitErr('Imeshindwa kupakia. Angalia muunganiko wako wa intaneti.') }
    finally  { setSubmitting(false) }
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  // ── Auth / error states ──────────────────────────────────────────────────────
  if (authErr) {
    const msgs: Record<string, { icon: string; title: string; body: string }> = {
      login:     { icon: 'lock',         title: 'Ingia kwanza',              body: 'Unahitaji kuingia katika akaunti yako ili kuona ukurasa huu.' },
      forbidden: { icon: 'shield-off',   title: 'Huna ruhusa',               body: 'Huna ruhusa ya kuona malipo haya.' },
      notfound:  { icon: 'file-unknown', title: 'Malipo hayapatikani',        body: 'Ukurasa huu unaonekana kuwa na tatizo. Wasiliana na mmiliki wako.' },
      error:     { icon: 'wifi-off',     title: 'Hitilafu ya muunganiko',     body: 'Imeshindwa kupakia. Tafadhali jaribu tena.' },
    }
    const m = msgs[authErr] ?? msgs.error
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className={`ti ti-${m.icon} text-3xl text-red-400`} aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900 text-lg mb-2">{m.title}</h2>
          <p className="text-sm text-gray-500 mb-6">{m.body}</p>
          {authErr === 'login' && (
            <Link href={`/login?redirect=/rent/proof/${paymentId}`}>
              <button className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold">
                Ingia Sasa
              </button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!payment || !lease) return null

  const unit    = lease.unit    as unknown as { unit_number: string; unit_type: string } | null
  const listing = lease.listing as unknown as { title: string; district: string; region: string } | null

  const canUpload = !['paid', 'void'].includes(payment.status)
  const isAlreadyVerified = payment.status === 'paid'

  // ── Success screen ────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-circle-check text-4xl text-green-500" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900 text-xl mb-2">Ushahidi Umepakiwa!</h2>
          <p className="text-sm text-gray-500 mb-1">
            Mmiliki ataangalia ushahidi wako na atathibitisha malipo.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Utapata arifa ukisha thibitishwa.
          </p>
          <div className="bg-primary-50 rounded-2xl p-4 text-left mb-4">
            <p className="text-xs text-primary-600 font-medium mb-0.5">Kiungo ulichotuma</p>
            <a href={proofUrl} target="_blank" rel="noopener noreferrer"
               className="text-xs text-primary-700 underline break-all">{proofUrl}</a>
          </div>
          <Link href="/">
            <button className="w-full border border-gray-200 text-gray-700 py-3 rounded-xl font-medium text-sm">
              Rudi Mwanzo
            </button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Main page ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ti ti-home text-primary-600 text-base" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 leading-none">
              {orgName ?? 'NyumbaFasta'}
            </p>
            <p className="font-semibold text-gray-900 text-sm truncate">
              {listing?.title ?? 'Malipo ya Kodi'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">

        {/* Payment summary card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                TZS {payment.amount_due.toLocaleString()}
              </p>
              {unit && (
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                  <i className="ti ti-door" aria-hidden="true" />
                  {unit.unit_number}
                  {listing && ` · ${listing.district}`}
                </p>
              )}
            </div>
            <StatusBadge status={payment.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Tarehe ya Malipo</p>
              <p className="font-medium text-gray-700">{dateFmt(payment.due_date)}</p>
            </div>
            {payment.paid_date && (
              <div>
                <p className="text-xs text-gray-400">Ilipwa</p>
                <p className="font-medium text-green-600">{dateFmt(payment.paid_date)}</p>
              </div>
            )}
            {payment.verified_at && (
              <div className="col-span-2">
                <p className="text-xs text-green-400">
                  <i className="ti ti-shield-check" aria-hidden="true" /> Imethibitishwa {dateFmt(payment.verified_at)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Already paid confirmation */}
        {isAlreadyVerified && (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
            <i className="ti ti-circle-check text-4xl text-green-500" aria-hidden="true" />
            <p className="font-semibold text-green-800 mt-2">Malipo yamethibitishwa</p>
            <p className="text-sm text-green-600 mt-1">
              Rekodi hii imekamilika. Hakuna hatua zaidi.
            </p>
            <Link href={`/rent/receipt/${paymentId}`}
              className="mt-4 inline-flex items-center gap-2 bg-white border border-green-200 text-green-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-50 transition">
              <i className="ti ti-file-download" aria-hidden="true" />
              Pakua Risiti
            </Link>
          </div>
        )}

        {/* Awaiting verification notice */}
        {payment.status === 'proof_uploaded' && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
            <i className="ti ti-clock-hour-4 text-xl text-blue-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-blue-800 text-sm">Inasubiri uthibitisho</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Ushahidi wako umepakiwa. Mmiliki ataona na atathibitisha hivi karibuni.
              </p>
            </div>
          </div>
        )}

        {/* Banking details (show when payment is not yet fully paid) */}
        {!isAlreadyVerified && banking && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <i className="ti ti-building-bank" aria-hidden="true" />
              Maelezo ya Malipo
            </p>
            <div className="space-y-2.5">
              <Row label="Benki"        value={banking.bank_name} />
              <Row label="Jina la Akaunti" value={banking.account_name} />
              <Row label="Nambari ya Akaunti" value={banking.account_number} bold />
              {banking.branch && <Row label="Tawi" value={banking.branch} />}
              {banking.mobile_money_number && (
                <Row label={`Nambari ya ${banking.mobile_money_provider ?? 'Simu'}`} value={banking.mobile_money_number} bold />
              )}
              {banking.additional_instructions && (
                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-400 mb-0.5">Maelezo ya Ziada</p>
                  <p className="text-sm text-gray-700">{banking.additional_instructions}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No banking set */}
        {!isAlreadyVerified && !banking && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
            <i className="ti ti-alert-triangle text-amber-500 text-xl mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-700">
              Mmiliki hajaweka maelezo ya akaunti ya benki bado.
              Wasiliana naye moja kwa moja kupata maelekezo ya malipo.
            </p>
          </div>
        )}

        {/* Proof upload form */}
        {canUpload && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <i className="ti ti-upload" aria-hidden="true" />
              Pakia Ushahidi wa Malipo
            </p>

            {payment.status === 'proof_uploaded' && payment.proof_url && (
              <div className="mb-4 bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-medium mb-1">Ushahidi uliopo</p>
                <a href={payment.proof_url} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-blue-700 underline break-all">{payment.proof_url}</a>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kiungo cha Ushahidi <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                  placeholder="https://drive.google.com/... au kiungo kingine"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Pakia picha ya risiti au taarifa ya benki kwenye Google Drive / Dropbox kisha weka kiungo hapa.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nambari ya Muamala / Maelezo
                </label>
                <input
                  type="text"
                  value={proofNote}
                  onChange={e => setProofNote(e.target.value)}
                  placeholder="Mfano: Nambari ya muamala 123456..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              {submitErr && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                  <i className="ti ti-alert-circle flex-shrink-0" aria-hidden="true" />
                  {submitErr}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !proofUrl.trim()}
                className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary-600 transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                    Inapakia...
                  </>
                ) : (
                  <>
                    <i className="ti ti-upload" aria-hidden="true" />
                    {payment.status === 'proof_uploaded' ? 'Sasisha Ushahidi' : 'Tuma Ushahidi'}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 pb-4">
          NyumbaFasta · Usimamizi wa Malipo ya Kodi
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <p className="text-xs text-gray-400 flex-shrink-0">{label}</p>
      <p className={`text-sm text-right ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value}</p>
    </div>
  )
}
