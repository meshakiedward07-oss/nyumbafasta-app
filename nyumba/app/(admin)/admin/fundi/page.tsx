'use client'
import { useEffect, useState } from 'react'
import { MAINTENANCE_CATEGORY_LABELS } from '@/lib/types/property'
import type { MaintenanceCategory } from '@/lib/types/property'

interface KycDoc {
  id: string; document_type: string; document_url: string; document_name: string | null
  status: 'pending' | 'approved' | 'rejected'; rejection_reason: string | null; submitted_at: string
}
interface AdminFundi {
  id: string; user_id: string; business_name: string | null; category: string
  kyc_status: string; is_available: boolean; specialty: string | null
  location: string | null; experience_years: number | null; jobs_completed: number
  kyc_documents: KycDoc[]
  user: { id: string; full_name: string | null; phone: string | null; created_at: string } | null
}

const KYC_FILTER = ['all', 'none', 'pending', 'approved', 'rejected'] as const
type KF = (typeof KYC_FILTER)[number]

const KYC_STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  none:     { cls: 'bg-gray-100 text-gray-500',    label: 'Hujatuma'        },
  pending:  { cls: 'bg-amber-50 text-amber-700',   label: 'Inakaguliwa'     },
  approved: { cls: 'bg-green-50 text-green-700',   label: 'Imeidhinishwa'   },
  rejected: { cls: 'bg-red-50 text-red-600',       label: 'Ilikataliwa'     },
}

const DOC_LABELS: Record<string, string> = {
  business_licence:          'Leseni ya Biashara',
  qualification_certificate: 'Cheti cha Utaalamu',
  national_id:               'Kitambulisho',
  other:                     'Nyingine',
}

export default function AdminFundiPage() {
  const [fundi,        setFundi]        = useState<AdminFundi[]>([])
  const [loading,      setLoading]      = useState(true)
  const [kycFilter,    setKycFilter]    = useState<KF>('pending')
  const [search,       setSearch]       = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [actioning,    setActioning]    = useState<string | null>(null)
  const [rejectModal,  setRejectModal]  = useState<{ fundiId: string; kycId: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [err,          setErr]          = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (kycFilter !== 'all') params.set('kyc_status', kycFilter)
      if (search.trim()) params.set('search', search.trim())
      const res  = await fetch(`/api/v1/admin/fundi?${params}`)
      const data = await res.json()
      setFundi(data.fundi ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [kycFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleKyc(fundiId: string, kycId: string, action: 'approve' | 'reject', reason?: string) {
    setActioning(kycId); setErr(null)
    try {
      const res = await fetch(`/api/v1/admin/fundi/${fundiId}/kyc/${kycId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, rejection_reason: reason }),
      })
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Kuna tatizo'); return }
      setRejectModal(null); setRejectReason('')
      await load()
    } catch { setErr('Haikuweza. Jaribu tena.') }
    finally { setActioning(null) }
  }

  const filteredFundi = fundi.filter(f => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return f.user?.full_name?.toLowerCase().includes(q) || f.user?.phone?.includes(q) || f.business_name?.toLowerCase().includes(q)
  })

  const pendingCount  = fundi.filter(f => f.kyc_status === 'pending').length

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Kataa Hati ya KYC</h2>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 block mb-1">Sababu ya Kukataa (hiari)</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Maelezo ya kwa nini hati haikukubaliwa..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
            </div>
            {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
            <div className="flex gap-2">
              <button onClick={() => handleKyc(rejectModal.fundiId, rejectModal.kycId, 'reject', rejectReason)}
                disabled={!!actioning}
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
        <h1 className="text-2xl font-bold text-gray-900">Mafundi</h1>
        <p className="text-sm text-gray-500">Simamia akaunti za mafundi na hati zao za KYC</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        {KYC_FILTER.map(f => (
          <button key={f} onClick={() => setKycFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              kycFilter === f ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f === 'all' ? 'Wote' : KYC_STATUS_STYLE[f]?.label ?? f}
            {f === 'pending' && pendingCount > 0 && (
              <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${kycFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-700'}`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Tafuta jina, simu, biashara..."
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-300" />

      {err && !rejectModal && <p className="text-sm text-red-600 mb-3">{err}</p>}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
      ) : filteredFundi.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-tools text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna mafundi wanaolingana na utafutaji huu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFundi.map(f => {
            const s     = KYC_STATUS_STYLE[f.kyc_status] ?? KYC_STATUS_STYLE.none
            const isExp = expanded === f.user_id
            const pendingDocs = f.kyc_documents.filter(d => d.status === 'pending')
            return (
              <div key={f.user_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Fundi header row */}
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-user-circle text-primary-600 text-lg" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{f.user?.full_name ?? '—'}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                      {f.is_available && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Anapatikana</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {f.business_name && <span>{f.business_name} · </span>}
                      {MAINTENANCE_CATEGORY_LABELS[f.category as MaintenanceCategory] ?? f.category}
                      {f.location && <span> · {f.location}</span>}
                    </p>
                    {f.user?.phone && (
                      <div className="flex items-center gap-2 mt-1">
                        <a href={`tel:${f.user.phone}`} className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1">
                          <i className="ti ti-phone" aria-hidden="true" /> {f.user.phone}
                        </a>
                        <a href={`https://wa.me/${f.user.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:underline flex items-center gap-1">
                          <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WA
                        </a>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setExpanded(isExp ? null : f.user_id)}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-xl font-medium transition ${pendingDocs.length > 0 ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {pendingDocs.length > 0 ? `Kagua (${pendingDocs.length})` : 'Hati'}
                  </button>
                </div>

                {/* Expanded KYC documents */}
                {isExp && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hati za KYC ({f.kyc_documents.length})</p>
                    {f.kyc_documents.length === 0 ? (
                      <p className="text-xs text-gray-400">Hajatuma hati yoyote.</p>
                    ) : f.kyc_documents.map(doc => {
                      const ds = doc.status === 'pending' ? 'bg-amber-50 text-amber-700' : doc.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      return (
                        <div key={doc.id} className="bg-gray-50 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{DOC_LABELS[doc.document_type] ?? doc.document_type}</p>
                              {doc.document_name && <p className="text-xs text-gray-400">{doc.document_name}</p>}
                              <p className="text-[10px] text-gray-400">{new Date(doc.submitted_at).toLocaleDateString('sw-TZ')}</p>
                              {doc.status === 'rejected' && doc.rejection_reason && (
                                <p className="text-xs text-red-500 mt-0.5">Sababu: {doc.rejection_reason}</p>
                              )}
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${ds}`}>
                              {doc.status === 'pending' ? 'Inasubiri' : doc.status === 'approved' ? 'Imeidhinishwa' : 'Ilikataliwa'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                              <i className="ti ti-external-link text-xs" aria-hidden="true" /> Angalia Hati
                            </a>
                            {doc.status !== 'approved' && (
                              <button onClick={() => handleKyc(f.user_id, doc.id, 'approve')} disabled={!!actioning}
                                className="text-xs px-3 py-1 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-40 transition flex items-center gap-1">
                                <i className="ti ti-check text-xs" aria-hidden="true" />
                                {actioning === doc.id ? '...' : 'Idhinisha'}
                              </button>
                            )}
                            {doc.status !== 'rejected' && (
                              <button onClick={() => { setRejectModal({ fundiId: f.user_id, kycId: doc.id }); setRejectReason(''); setErr(null) }}
                                disabled={!!actioning}
                                className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 disabled:opacity-40 transition flex items-center gap-1">
                                <i className="ti ti-x text-xs" aria-hidden="true" /> Kataa
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
