'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface BrokerageRequest {
  id: string
  title: string
  listing_type: string
  price_monthly: number
  region: string
  district: string
  status: string
  commission_status: string
  commission_amount: number
  created_at: string
  deal_closed_at: string | null
  rejection_reason: string | null
  images: string[]
  listing_id: string | null
  listing: { id: string; title: string; status: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:     { label: 'Inasubiriwa',  color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: 'clock' },
  approved:    { label: 'Imeidhinishwa', color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: 'circle-check' },
  rejected:    { label: 'Imekataliwa',   color: 'bg-red-50 text-red-700 border-red-200',        icon: 'circle-x' },
  listed:      { label: 'Imetangazwa',   color: 'bg-green-50 text-green-700 border-green-200',  icon: 'speakerphone' },
  deal_closed: { label: 'Deal Imefungwa', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'confetti' },
  cancelled:   { label: 'Imefutwa',      color: 'bg-gray-50 text-gray-500 border-gray-200',     icon: 'ban' },
}

const COMMISSION_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Bado Haijaingia', color: 'text-amber-600' },
  invoiced: { label: 'Ankara Imetumwa', color: 'text-blue-600' },
  received: { label: 'Imepokelewa ✓',   color: 'text-green-600' },
  waived:   { label: 'Imesamehewa',     color: 'text-gray-400' },
}

function fmt(n: number) { return `TZS ${n.toLocaleString()}` }

export default function BrokeragePage() {
  const [requests,   setRequests]   = useState<BrokerageRequest[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function loadRequests() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/org/brokerage-requests')
      const d   = await res.json()
      setRequests(d.requests ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadRequests() }, [])

  async function handleCancel(id: string) {
    if (!confirm('Una uhakika wa kufuta ombi hili?')) return
    setCancelling(id)
    try {
      const res = await fetch(`/api/v1/org/brokerage-requests/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'cancel' }),
      })
      if (res.ok) await loadRequests()
    } catch { /* silent */ }
    finally { setCancelling(null) }
  }

  const filtered = filter
    ? requests.filter(r => r.status === filter)
    : requests

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Brokerage ya NyumbaFasta</h1>
          <p className="text-xs text-gray-400 mt-0.5">Ombi la kutafuta mpangaji kwa ajili yako</p>
        </div>
        <Link
          href="/property/brokerage/new"
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
        >
          <i className="ti ti-plus" aria-hidden="true" />
          Ombi Jipya
        </Link>
      </div>

      {/* Info banner */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-5 flex gap-3">
        <i className="ti ti-info-circle text-primary-500 text-xl flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm text-primary-800">
          <p className="font-semibold mb-0.5">Jinsi inavyofanya kazi</p>
          <ol className="text-xs text-primary-700 space-y-0.5 list-decimal list-inside">
            <li>Wasilisha ombi na taarifa za nyumba yako</li>
            <li>Staff wa NyumbaFasta watatangaza kwa niaba yako</li>
            <li>Mpangaji ataposalimu, staff atakuwasilisha</li>
            <li>Deal ikifungwa, lipa kamisheni ya mwezi 1 wa kodi</li>
          </ol>
        </div>
      </div>

      {/* Status filter */}
      {requests.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {['', 'pending', 'approved', 'listed', 'deal_closed', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex-shrink-0 text-xs px-3 py-2 rounded-full border font-medium transition ${
                filter === s ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {s === '' ? 'Yote' : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-gray-200">
          <i className="ti ti-building-store text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-semibold mt-3">Hakuna maombi bado</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
            Una nyumba/kitengo wazi? Tuomba kutangaza kwa niaba yako na tupate mpangaji haraka.
          </p>
          <Link
            href="/property/brokerage/new"
            className="inline-flex items-center gap-2 mt-4 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            Wasilisha Ombi la Kwanza
          </Link>
        </div>
      )}

      {/* Request list */}
      <div className="space-y-3">
        {filtered.map(req => {
          const sc = STATUS_CONFIG[req.status]
          const cc = COMMISSION_CONFIG[req.commission_status]
          return (
            <div key={req.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                    {req.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={req.images[0]} alt={req.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ti ti-building text-2xl text-gray-300" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm leading-snug truncate">{req.title}</p>
                      <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${sc.color}`}>
                        <i className={`ti ti-${sc.icon} mr-0.5`} aria-hidden="true" />
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{req.district}, {req.region}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-bold text-primary-600">{fmt(req.price_monthly)}/mwezi</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-400">Kamisheni: {fmt(req.commission_amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Rejection reason */}
                {req.status === 'rejected' && req.rejection_reason && (
                  <div className="mt-3 bg-red-50 rounded-xl p-3 text-xs text-red-700">
                    <i className="ti ti-alert-circle mr-1" aria-hidden="true" />
                    <span className="font-semibold">Sababu ya kukataliwa: </span>{req.rejection_reason}
                  </div>
                )}

                {/* Listed: link to public listing */}
                {(req.status === 'listed' || req.status === 'deal_closed') && req.listing_id && (
                  <div className="mt-3 flex items-center gap-2 bg-green-50 rounded-xl p-3">
                    <i className="ti ti-speakerphone text-green-600" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-green-700 font-medium">Imetangazwa na NyumbaFasta</p>
                      <p className="text-[10px] text-green-600">Wapangaji wanaona tangazo lako sasa hivi</p>
                    </div>
                    <a
                      href={`/listing/${req.listing_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg font-medium hover:bg-green-700 transition"
                    >
                      Tazama
                    </a>
                  </div>
                )}

                {/* Deal closed: commission tracking */}
                {req.status === 'deal_closed' && (
                  <div className="mt-3 bg-purple-50 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-purple-800">Hali ya Kamisheni</p>
                      <p className={`text-xs font-medium mt-0.5 ${cc.color}`}>{cc.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-purple-600">Kiasi</p>
                      <p className="text-sm font-bold text-purple-800">{fmt(req.commission_amount)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  Imewasilishwa: {new Date(req.created_at).toLocaleDateString('sw-TZ')}
                </span>
                {req.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={cancelling === req.id}
                    className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40 transition"
                  >
                    <i className="ti ti-x" aria-hidden="true" />
                    {cancelling === req.id ? 'Inafuta...' : 'Futa Ombi'}
                  </button>
                )}
                {req.status === 'deal_closed' && req.deal_closed_at && (
                  <span className="text-[10px] text-purple-500">
                    Imefungwa: {new Date(req.deal_closed_at).toLocaleDateString('sw-TZ')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
