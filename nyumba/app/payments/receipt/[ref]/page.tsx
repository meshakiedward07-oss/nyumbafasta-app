'use client'
import { use, useEffect, useState } from 'react'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

interface Receipt {
  receipt_number: string
  type: string
  status: string
  amount_tzs: number
  paid_at: string | null
  description: string
  paid_by: string | null
  platform: string
}

const TYPE_LABEL: Record<string, string> = {
  unlock:           'Ufunguzi wa Mawasiliano',
  subscription:     'Usajili wa Dalali',
  renewal:          'Upyaisho wa Usajili',
  boost:            'Boost ya Listing',
  extra_listing:    'Nafasi za Ziada za Listings',
  org_subscription: 'Usajili wa Shirika',
}

const STATUS_STYLE: Record<string, string> = {
  completed:  'bg-emerald-100 text-emerald-800',
  confirmed:  'bg-emerald-100 text-emerald-800',
  active:     'bg-emerald-100 text-emerald-800',
  pending:    'bg-amber-100 text-amber-800',
  failed:     'bg-red-100 text-red-800',
  void:       'bg-gray-100 text-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Imekamilika',
  confirmed: 'Imethibitishwa',
  active:    'Hai',
  pending:   'Inasubiri',
  failed:    'Imeshindwa',
  void:      'Imebatilishwa',
}

export default function ReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/payments/receipt/${encodeURIComponent(ref)}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.error ?? 'Hitilafu')))
      .then(setReceipt)
      .catch(e => setError(typeof e === 'string' ? e : 'Risiti haikupatikana'))
      .finally(() => setLoading(false))
  }, [ref])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Inapakia risiti...</div>
      </div>
    )
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-2">{error ?? 'Risiti haikupatikana'}</p>
          <a href="/dashboard" className="text-primary-600 text-sm underline">Rudi Dashboard</a>
        </div>
      </div>
    )
  }

  const fmtAmount = (n: number) => `Tsh ${n.toLocaleString('en-TZ')}`
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleString('sw-TZ', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : '—'

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 print:bg-white print:py-0">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg overflow-hidden print:shadow-none print:rounded-none">

        {/* Green header */}
        <div className="bg-primary-600 px-8 py-6 text-white print:bg-white print:text-black print:border-b-2 print:border-primary-600">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">NyumbaFasta</h1>
              <p className="text-primary-100 text-sm print:text-gray-500 mt-0.5">Risiti ya Malipo</p>
            </div>
            <i className="ti ti-receipt text-4xl opacity-60 print:hidden" />
          </div>
        </div>

        {/* Status banner */}
        <div className="px-8 pt-6 pb-2 flex items-center gap-3">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLE[receipt.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[receipt.status] ?? receipt.status}
          </span>
          <span className="text-xs text-gray-400">{TYPE_LABEL[receipt.type] ?? receipt.type}</span>
        </div>

        {/* Amount */}
        <div className="px-8 py-4 text-center border-b border-dashed border-gray-200">
          <p className="text-4xl font-bold text-gray-900 tabular-nums">{fmtAmount(receipt.amount_tzs)}</p>
          <p className="text-sm text-gray-400 mt-1">{receipt.description}</p>
        </div>

        {/* Details grid */}
        <div className="px-8 py-5 space-y-3">
          {[
            ['Nambari ya Risiti', receipt.receipt_number],
            ['Tarehe ya Malipo', fmtDate(receipt.paid_at)],
            ['Mtoaji Malipo',    receipt.paid_by ?? '—'],
            ['Jukwaa',          receipt.platform],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-start gap-4">
              <span className="text-sm text-gray-500 shrink-0">{label}</span>
              <span className="text-sm font-medium text-gray-800 text-right break-all">{value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-4 border-t border-gray-100 text-center space-y-4">
          <p className="text-xs text-gray-400">
            Risiti hii ni uthibitisho wa malipo kwenye mfumo wa NyumbaFasta.<br />
            Kwa maswali: support@nyumbafasta.co
          </p>
          <div className="flex gap-3 justify-center print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <i className="ti ti-printer text-base" />
              Chapisha
            </button>
            <a
              href="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Rudi Dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Print watermark */}
      <p className="hidden print:block text-center text-xs text-gray-400 mt-4">
        Imechapishwa kutoka {APP_URL} · {new Date().toLocaleDateString('sw-TZ')}
      </p>
    </div>
  )
}
