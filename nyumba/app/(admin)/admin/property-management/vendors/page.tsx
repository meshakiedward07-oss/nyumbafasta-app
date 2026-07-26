'use client'
import { useEffect, useState } from 'react'
import { MAINTENANCE_CATEGORY_LABELS, MAINTENANCE_CATEGORY_ICONS } from '@/lib/types/property'

type VStatus = 'pending' | 'verified' | 'rejected'

interface AdminVendor {
  id:                  string
  org_id:              string
  name:                string
  category:            string
  phone:               string | null
  email:               string | null
  specialty:           string | null
  location:            string | null
  notes:               string | null
  is_active:           boolean
  jobs_completed:      number
  verification_status: VStatus
  verified_at:         string | null
  rejection_reason:    string | null
  created_at:          string
  organization:        { id: string; name: string } | null
}

const STATUS_LABELS: Record<VStatus, string> = {
  pending:  'Inasubiri',
  verified: 'Imethibitishwa',
  rejected: 'Ilikataliwa',
}

const STATUS_COLORS: Record<VStatus, string> = {
  pending:  'bg-amber-50 text-amber-700',
  verified: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-600',
}

export default function AdminVendorsPage() {
  const [vendors,       setVendors]       = useState<AdminVendor[]>([])
  const [loading,       setLoading]       = useState(true)
  const [statusFilter,  setStatusFilter]  = useState<VStatus | 'all'>('pending')
  const [search,        setSearch]        = useState('')
  const [rejectModal,   setRejectModal]   = useState<AdminVendor | null>(null)
  const [rejectReason,  setRejectReason]  = useState('')
  const [actioning,     setActioning]     = useState<string | null>(null)
  const [err,           setErr]           = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      const res  = await fetch(`/api/v1/admin/vendors?${params}`)
      const data = await res.json()
      setVendors(data.vendors ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter, search])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify(vendor: AdminVendor) {
    setActioning(vendor.id); setErr(null)
    try {
      const res = await fetch(`/api/v1/admin/vendors/${vendor.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      })
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Kuna tatizo'); return }
      await load()
    } catch { setErr('Haikuweza. Jaribu tena.') }
    finally { setActioning(null) }
  }

  async function handleReject() {
    if (!rejectModal) return
    setActioning(rejectModal.id); setErr(null)
    try {
      const res = await fetch(`/api/v1/admin/vendors/${rejectModal.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejection_reason: rejectReason }),
      })
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Kuna tatizo'); return }
      setRejectModal(null); setRejectReason('')
      await load()
    } catch { setErr('Haikuweza. Jaribu tena.') }
    finally { setActioning(null) }
  }

  const pendingCount   = vendors.filter(v => v.verification_status === 'pending').length
  const verifiedCount  = vendors.filter(v => v.verification_status === 'verified').length
  const rejectedCount  = vendors.filter(v => v.verification_status === 'rejected').length

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Kataa Fundi</h2>
            <p className="text-sm text-gray-500 mb-4">{rejectModal.name} — {rejectModal.organization?.name}</p>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 block mb-1">Sababu ya Kukataa (hiari)</label>
              <textarea
                rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Maelezo ya nini kinakosekana au sababu ya kukataa..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>
            {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={!!actioning}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition">
                {actioning ? 'Inakataa...' : 'Kataa'}
              </button>
              <button onClick={() => { setRejectModal(null); setRejectReason('') }}
                className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Ghairi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Uthibitisho wa Mafundi</h1>
        <p className="text-sm text-gray-500">Kagua na thibitisha mafundi walioomba kujiunga</p>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([['all', 'Wote', vendors.length], ['pending', 'Inasubiri', pendingCount], ['verified', 'Wamethibitishwa', verifiedCount], ['rejected', 'Walikataliwa', rejectedCount]] as const).map(([val, label, count]) => (
          <button key={val} onClick={() => setStatusFilter(val as typeof statusFilter)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === val ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {label}
            <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
              statusFilter === val ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Tafuta jina la fundi..."
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-300" />

      {err && !rejectModal && <p className="text-sm text-red-600 mb-3">{err}</p>}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-14 text-center">
          <i className="ti ti-address-book text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna mafundi</p>
          <p className="text-sm text-gray-400 mt-1">Hakuna mafundi wanaofanana na utafutaji huu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map(vendor => {
            const catLabel = MAINTENANCE_CATEGORY_LABELS[vendor.category as keyof typeof MAINTENANCE_CATEGORY_LABELS] ?? vendor.category
            const catIcon  = MAINTENANCE_CATEGORY_ICONS[vendor.category as keyof typeof MAINTENANCE_CATEGORY_ICONS] ?? 'tool'
            const isLoading = actioning === vendor.id
            return (
              <div key={vendor.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {/* Category icon */}
                  <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className={`ti ti-${catIcon} text-primary-600 text-lg`} aria-hidden="true" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-gray-900 text-sm">{vendor.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[vendor.verification_status]}`}>
                        {STATUS_LABELS[vendor.verification_status]}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">
                        {catLabel}
                      </span>
                    </div>

                    {/* Org name */}
                    <p className="text-xs text-blue-600 font-medium mb-0.5">
                      <i className="ti ti-building mr-1" aria-hidden="true" />
                      {vendor.organization?.name ?? 'Shirika lisilojulikana'}
                    </p>

                    {vendor.specialty && <p className="text-xs text-gray-500">{vendor.specialty}</p>}

                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                      {vendor.phone && (
                        <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 hover:text-primary-600">
                          <i className="ti ti-phone" aria-hidden="true" /> {vendor.phone}
                        </a>
                      )}
                      {vendor.location && (
                        <span className="flex items-center gap-1">
                          <i className="ti ti-map-pin" aria-hidden="true" /> {vendor.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-300">
                        <i className="ti ti-calendar" aria-hidden="true" />
                        {new Date(vendor.created_at).toLocaleDateString('sw-TZ')}
                      </span>
                    </div>

                    {vendor.notes && (
                      <p className="text-[11px] text-gray-400 mt-1">{vendor.notes}</p>
                    )}

                    {vendor.verification_status === 'rejected' && vendor.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">
                        <i className="ti ti-info-circle mr-1" aria-hidden="true" />
                        Sababu: {vendor.rejection_reason}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {vendor.verification_status !== 'verified' && (
                      <button onClick={() => handleVerify(vendor)} disabled={isLoading}
                        className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-40 transition flex items-center gap-1">
                        <i className="ti ti-check" aria-hidden="true" />
                        {isLoading ? '...' : 'Thibitisha'}
                      </button>
                    )}
                    {vendor.verification_status !== 'rejected' && (
                      <button onClick={() => { setRejectModal(vendor); setRejectReason(''); setErr(null) }}
                        disabled={isLoading}
                        className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 disabled:opacity-40 transition flex items-center gap-1">
                        <i className="ti ti-x" aria-hidden="true" />
                        Kataa
                      </button>
                    )}
                    {vendor.phone && (
                      <a href={`https://wa.me/${vendor.phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition flex items-center gap-1">
                        <i className="ti ti-brand-whatsapp text-green-500" aria-hidden="true" />
                        WA
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
