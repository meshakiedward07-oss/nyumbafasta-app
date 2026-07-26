'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'

interface Payment {
  id: string; lease_id: string; status: string
  amount_due: number; amount_paid: number | null
  due_date: string; paid_date: string | null
  proof_url: string | null; verified_at: string | null
  payment_method: string | null; reference: string | null
}

interface LeaseInfo {
  id: string; monthly_rent: number; start_date: string
  unit: { unit_number: string; unit_type: string } | null
  listing: { title: string; district: string; region: string } | null
}

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

function methodLabel(method: string | null) {
  const map: Record<string, string> = {
    bank: 'Benki', cash: 'Fedha Taslimu', mpesa: 'M-Pesa',
    airtel: 'Airtel Money', tigo: 'Tigo Pesa', halopesa: 'HaloPesa',
  }
  return method ? (map[method] ?? method) : '—'
}

export default function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = use(params)

  const [payment,     setPayment]     = useState<Payment | null>(null)
  const [lease,       setLease]       = useState<LeaseInfo | null>(null)
  const [orgName,     setOrgName]     = useState<string | null>(null)
  const [tenantName,  setTenantName]  = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [authErr,     setAuthErr]     = useState<string | null>(null)

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
        setOrgName(data.org_name)
        setTenantName(data.tenant_name)
      } catch { setAuthErr('error') }
      finally  { setLoading(false) }
    }
    load()
  }, [paymentId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (authErr) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <i className="ti ti-lock text-4xl text-gray-300" aria-hidden="true" />
          <p className="text-gray-600 mt-3 font-medium">
            {authErr === 'login' ? 'Ingia kwanza' : authErr === 'forbidden' ? 'Huna ruhusa' : 'Risiti haipatikani'}
          </p>
          {authErr === 'login' && (
            <Link href={`/login?redirect=/rent/receipt/${paymentId}`}>
              <button className="mt-4 w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm">
                Ingia Sasa
              </button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!payment || payment.status !== 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <i className="ti ti-receipt-off text-4xl text-amber-300" aria-hidden="true" />
          <p className="text-gray-700 font-semibold mt-3">Risiti Haipatikani</p>
          <p className="text-sm text-gray-400 mt-1">
            Risiti inapatikana tu baada ya malipo kuthibitishwa na mmiliki.
          </p>
          <Link href={`/rent/proof/${paymentId}`}>
            <button className="mt-4 border border-gray-200 text-gray-600 py-2.5 px-5 rounded-xl text-sm hover:bg-gray-50">
              Rudi kwenye Malipo
            </button>
          </Link>
        </div>
      </div>
    )
  }

  const unit    = lease?.unit    as unknown as { unit_number: string; unit_type: string } | null
  const listing = lease?.listing as unknown as { title: string; district: string; region: string } | null

  const receiptNo = `NF-${paymentId.slice(0, 8).toUpperCase()}`
  const amountPaid = payment.amount_paid ?? payment.amount_due

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Print controls — hidden when printing */}
      <div className="print:hidden bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <Link href={`/rent/proof/${paymentId}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Rudi
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-600 transition"
          >
            <i className="ti ti-printer" aria-hidden="true" />
            Chapisha / Hifadhi PDF
          </button>
        </div>
      </div>

      {/* Receipt card */}
      <div className="flex-1 flex items-start justify-center p-4 pt-6 print:p-0 print:bg-white print:items-start">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg print:shadow-none print:rounded-none print:max-w-none overflow-hidden">

          {/* Header stripe */}
          <div className="bg-primary-500 px-8 py-7 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-primary-100 text-xs font-medium tracking-wider uppercase mb-1">
                  {orgName ?? 'NyumbaFasta'}
                </p>
                <h1 className="text-2xl font-bold">Risiti ya Malipo</h1>
                <p className="text-primary-200 text-sm mt-0.5">Rent Payment Receipt</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <i className="ti ti-receipt text-2xl text-white" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 flex-wrap text-xs text-primary-100">
              <span className="flex items-center gap-1">
                <i className="ti ti-hash" />
                {receiptNo}
              </span>
              {payment.paid_date && (
                <span className="flex items-center gap-1">
                  <i className="ti ti-calendar" />
                  {dateFmt(payment.paid_date)}
                </span>
              )}
              <span className="bg-white/20 text-white px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
                ✓ IMELIPWA
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6 space-y-5">

            {/* Amount */}
            <div className="text-center bg-green-50 rounded-2xl py-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Kiasi Kilicholipwa</p>
              <p className="text-4xl font-bold text-gray-900 tabular-nums">
                TZS {amountPaid.toLocaleString()}
              </p>
              {payment.amount_due !== amountPaid && (
                <p className="text-xs text-gray-400 mt-1">
                  Kiasi cha ankara: TZS {payment.amount_due.toLocaleString()}
                </p>
              )}
            </div>

            {/* Details grid */}
            <div className="divide-y divide-gray-50">
              <ReceiptRow label="Mpangaji" value={tenantName ?? '—'} />
              {unit && <ReceiptRow label="Kitengo" value={unit.unit_number} />}
              {listing && (
                <ReceiptRow label="Nyumba" value={`${listing.title} · ${listing.district}`} />
              )}
              <ReceiptRow label="Mwezi wa Ankara" value={dateFmt(payment.due_date)} />
              {payment.paid_date && (
                <ReceiptRow label="Tarehe ya Malipo" value={dateFmt(payment.paid_date)} />
              )}
              {payment.payment_method && (
                <ReceiptRow label="Njia ya Malipo" value={methodLabel(payment.payment_method)} />
              )}
              {payment.reference && (
                <ReceiptRow label="Namba ya Muamala" value={payment.reference} mono />
              )}
              {payment.verified_at && (
                <ReceiptRow label="Ilithibitishwa" value={dateFmt(payment.verified_at)} />
              )}
            </div>

            {/* Org / issuer */}
            <div className="bg-gray-50 rounded-2xl px-5 py-4 text-xs text-gray-500">
              <p className="font-semibold text-gray-700 mb-1">{orgName ?? 'NyumbaFasta'}</p>
              <p>Hati hii ni uthibitisho wa malipo ya kodi yaliyopokelewa na mfumo wa NyumbaFasta.</p>
            </div>

          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-3 text-[10px] text-gray-300">
            <span>NyumbaFasta · nyumbafasta.co</span>
            <span>{receiptNo}</span>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}

function ReceiptRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start py-3 gap-6">
      <p className="text-xs text-gray-400 flex-shrink-0">{label}</p>
      <p className={`text-sm text-right text-gray-800 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  )
}
