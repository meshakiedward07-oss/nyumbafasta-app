'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Advertiser = {
  id: string
  business_name: string
  business_category: string
  contact_phone: string
  whatsapp_number: string | null
  email: string
  city: string
  district: string | null
  description: string | null
  logo_url: string | null
  website_url: string | null
  status: 'pending_review' | 'active' | 'rejected' | 'suspended'
  rejection_reason: string | null
  created_at: string
  campaign_count: number
}

const STATUS_TABS = [
  { value: 'all',            label: 'Wote',         color: 'text-gray-600' },
  { value: 'pending_review', label: 'Wanasubiri',   color: 'text-amber-600' },
  { value: 'active',         label: 'Wanaofanya Kazi', color: 'text-green-600' },
  { value: 'rejected',       label: 'Walikataliwa', color: 'text-red-600' },
  { value: 'suspended',      label: 'Wamesimamishwa', color: 'text-orange-600' },
]

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-700 border-amber-200',
  active:         'bg-green-100 text-green-700 border-green-200',
  rejected:       'bg-red-100 text-red-700 border-red-200',
  suspended:      'bg-orange-100 text-orange-700 border-orange-200',
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Anasubiri',
  active:         'Ameidhinishwa',
  rejected:       'Amekataliwa',
  suspended:      'Amesimamishwa',
}

export default function AdminAdvertisersPage() {
  const [tab, setTab]                   = useState('all')
  const [advertisers, setAdvertisers]   = useState<Advertiser[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(false)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [acting, setActing]             = useState(false)
  const [toast, setToast]               = useState<string | null>(null)
  const [rejectId, setRejectId]         = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/admin/adverts/advertisers?status=${tab}`)
      const d = await r.json()
      setAdvertisers(d.advertisers ?? [])
      setTotal(d.total ?? 0)
    } finally { setLoading(false) }
  }, [tab])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function doAction(id: string, action: string, reason?: string) {
    setActing(true)
    try {
      const res = await fetch('/api/v1/admin/adverts/advertisers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast(action === 'approve' ? '✅ Mfanyabiashara ameidhinishwa!' : action === 'reject' ? '❌ Mfanyabiashara amekataliwa' : '⏸ Imesimamishwa')
        setRejectId(null)
        setRejectReason('')
        await load()
      } else {
        showToast(`Hitilafu: ${d.error}`)
      }
    } finally { setActing(false) }
  }

  return (
    <div className="p-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white bg-gray-900 animate-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/adverts" className="text-gray-400 hover:text-gray-600 text-sm">
              ← Kampeni
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-700">Wafanyabiashara</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            Wafanyabiashara
            {total > 0 && <span className="ml-2 text-base font-normal text-gray-400">({total})</span>}
          </h1>
        </div>
        <Link
          href="/admin/adverts/plans"
          className="text-sm text-primary-600 hover:underline"
        >
          Mipango ya Matangazo →
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              tab === t.value ? 'bg-white shadow text-gray-800' : `text-gray-500 hover:${t.color}`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : advertisers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🏪</div>
          <p>Hakuna wafanyabiashara {tab !== 'all' ? `wa "${STATUS_TABS.find(t => t.value === tab)?.label}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {advertisers.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">

              {/* Main row */}
              <div
                className="p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                {/* Logo / initials */}
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                  {a.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.logo_url} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className="text-primary-600 font-bold text-sm">
                      {a.business_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-gray-800 text-sm truncate">{a.business_name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${STATUS_BADGE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span>📂 {a.business_category}</span>
                    <span>📍 {a.city}{a.district ? `, ${a.district}` : ''}</span>
                    <span>📅 {new Date(a.created_at).toLocaleDateString('sw-TZ')}</span>
                    {a.campaign_count > 0 && (
                      <span className="text-primary-600 font-medium">🎯 Kampeni {a.campaign_count}</span>
                    )}
                  </div>
                </div>

                <i className={`ti ti-chevron-${expanded === a.id ? 'up' : 'down'} text-gray-400 flex-shrink-0`} />
              </div>

              {/* Expanded details */}
              {expanded === a.id && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
                    <Info label="Simu" value={a.contact_phone} />
                    <Info label="WhatsApp" value={a.whatsapp_number ?? '—'} />
                    <Info label="Barua Pepe" value={a.email} />
                    <Info label="Mji / Wilaya" value={`${a.city}${a.district ? ` / ${a.district}` : ''}`} />
                    {a.website_url && <Info label="Tovuti" value={a.website_url} />}
                    {a.description && (
                      <div className="md:col-span-2">
                        <span className="text-gray-400 text-xs">Maelezo</span>
                        <p className="text-gray-700 mt-0.5">{a.description}</p>
                      </div>
                    )}
                    {a.rejection_reason && (
                      <div className="md:col-span-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <span className="text-xs text-red-500 font-semibold">Sababu ya Kukataliwa:</span>
                        <p className="text-red-700 text-sm mt-0.5">{a.rejection_reason}</p>
                      </div>
                    )}
                  </div>

                  {/* Reject inline form */}
                  {rejectId === a.id && (
                    <div className="mb-3 flex gap-2">
                      <input
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Sababu ya kukataa (hiari)..."
                        className="flex-1 border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                      <button
                        onClick={() => doAction(a.id, 'reject', rejectReason)}
                        disabled={acting}
                        className="bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-700 disabled:opacity-50"
                      >
                        {acting ? '...' : 'Kataa'}
                      </button>
                      <button
                        onClick={() => setRejectId(null)}
                        className="border border-gray-200 text-gray-500 text-xs px-3 py-2 rounded-xl hover:bg-gray-50"
                      >
                        Ghairi
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {(a.status === 'pending_review' || a.status === 'suspended') && (
                      <button
                        onClick={() => doAction(a.id, 'approve')}
                        disabled={acting}
                        className="bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        ✅ Idhinisha
                      </button>
                    )}
                    {a.status === 'pending_review' && rejectId !== a.id && (
                      <button
                        onClick={() => { setRejectId(a.id); setRejectReason('') }}
                        className="bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-red-700 transition"
                      >
                        ❌ Kataa
                      </button>
                    )}
                    {a.status === 'active' && (
                      <button
                        onClick={() => doAction(a.id, 'suspend')}
                        disabled={acting}
                        className="bg-orange-500 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition"
                      >
                        ⏸ Simamisha
                      </button>
                    )}
                    {a.campaign_count > 0 && (
                      <Link
                        href={`/admin/adverts?advertiser=${a.id}`}
                        className="border border-primary-200 text-primary-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary-50 transition"
                      >
                        🎯 Angalia Kampeni ({a.campaign_count})
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 30 && (
        <p className="text-center text-xs text-gray-400 mt-4">
          Kuonyesha {advertisers.length} kati ya {total}
        </p>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400 text-xs">{label}</span>
      <p className="text-gray-800 font-medium text-sm mt-0.5 truncate">{value}</p>
    </div>
  )
}
