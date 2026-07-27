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

const STATUS_META: Record<VStatus, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Inasubiri',      bg: '#faeeda', color: '#854f0b' },
  verified: { label: 'Imethibitishwa', bg: '#eaf3de', color: '#3b6d11' },
  rejected: { label: 'Ilikataliwa',    bg: '#fcebeb', color: '#a32d2d' },
}

export default function VendorsTab() {
  const [vendors,      setVendors]      = useState<AdminVendor[]>([])
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState<VStatus | 'all'>('pending')
  const [search,       setSearch]       = useState('')
  const [rejectModal,  setRejectModal]  = useState<AdminVendor | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actioning,    setActioning]    = useState<string | null>(null)
  const [err,          setErr]          = useState<string | null>(null)

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

  useEffect(() => { load() }, [statusFilter, search]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const counts = {
    all:      vendors.length,
    pending:  vendors.filter(v => v.verification_status === 'pending').length,
    verified: vendors.filter(v => v.verification_status === 'verified').length,
    rejected: vendors.filter(v => v.verification_status === 'rejected').length,
  }

  return (
    <div className="space-y-4">
      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-1" style={{ color: '#1a1a18' }}>Kataa Fundi</h2>
            <p className="text-sm mb-4" style={{ color: '#666660' }}>{rejectModal.name} — {rejectModal.organization?.name}</p>
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1" style={{ color: '#666660' }}>Sababu ya Kukataa (hiari)</label>
              <textarea
                rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Maelezo ya nini kinakosekana..."
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                style={{ border: '1px solid #e5e5e0' }}
              />
            </div>
            {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={!!actioning}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition">
                {actioning ? 'Inakataa...' : 'Kataa'}
              </button>
              <button onClick={() => { setRejectModal(null); setRejectReason('') }}
                className="px-4 rounded-xl text-sm" style={{ border: '1px solid #e5e5e0', color: '#666660' }}>
                Ghairi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap">
        {([['all', 'Wote', counts.all], ['pending', 'Inasubiri', counts.pending], ['verified', 'Wamethibitishwa', counts.verified], ['rejected', 'Walikataliwa', counts.rejected]] as const).map(([val, label, count]) => (
          <button key={val} onClick={() => setStatusFilter(val as typeof statusFilter)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === val ? 'bg-primary-500 text-white' : ''
            }`}
            style={statusFilter !== val ? { background: '#f4f4f0', color: '#666660' } : {}}>
            {label}
            <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${
              statusFilter === val ? 'bg-white/20 text-white' : ''
            }`}
            style={statusFilter !== val ? { background: '#e5e5e0', color: '#666660' } : {}}>{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Tafuta jina la fundi..."
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        style={{ border: '1px solid #e5e5e0', color: '#1a1a18' }} />

      {err && !rejectModal && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: '#f4f4f0' }} />)}
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-white rounded-xl p-14 text-center" style={{ border: '1px dashed #e5e5e0' }}>
          <i className="ti ti-address-book text-5xl" style={{ color: '#e5e5e0' }} aria-hidden="true" />
          <p className="font-medium mt-3" style={{ color: '#666660' }}>Hakuna mafundi</p>
          <p className="text-sm mt-1" style={{ color: '#999992' }}>Hakuna mafundi wanaofanana na utafutaji huu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map(vendor => {
            const catLabel  = MAINTENANCE_CATEGORY_LABELS[vendor.category as keyof typeof MAINTENANCE_CATEGORY_LABELS] ?? vendor.category
            const catIcon   = MAINTENANCE_CATEGORY_ICONS[vendor.category as keyof typeof MAINTENANCE_CATEGORY_ICONS] ?? 'tool'
            const isLoading = actioning === vendor.id
            const meta      = STATUS_META[vendor.verification_status]

            return (
              <div key={vendor.id} className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className={`ti ti-${catIcon} text-primary-600 text-lg`} aria-hidden="true" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-sm" style={{ color: '#1a1a18' }}>{vendor.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">
                        {catLabel}
                      </span>
                    </div>

                    <p className="text-xs font-medium mb-0.5" style={{ color: '#185fa5' }}>
                      <i className="ti ti-building mr-1" aria-hidden="true" />
                      {vendor.organization?.name ?? 'Shirika lisilojulikana'}
                    </p>

                    {vendor.specialty && <p className="text-xs" style={{ color: '#666660' }}>{vendor.specialty}</p>}

                    <div className="flex flex-wrap gap-3 mt-1 text-xs" style={{ color: '#999992' }}>
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
                    </div>

                    {vendor.verification_status === 'rejected' && vendor.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">
                        <i className="ti ti-info-circle mr-1" aria-hidden="true" />
                        Sababu: {vendor.rejection_reason}
                      </p>
                    )}
                  </div>

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
                        className="text-xs px-3 py-1.5 rounded-xl font-medium disabled:opacity-40 transition flex items-center gap-1"
                        style={{ background: '#fcebeb', color: '#a32d2d' }}>
                        <i className="ti ti-x" aria-hidden="true" />
                        Kataa
                      </button>
                    )}
                    {vendor.phone && (
                      <a href={`https://wa.me/${vendor.phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1"
                        style={{ background: '#f4f4f0', color: '#666660' }}>
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
