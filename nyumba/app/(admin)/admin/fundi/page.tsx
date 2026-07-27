'use client'
import { useEffect, useState } from 'react'
import { MAINTENANCE_CATEGORY_LABELS } from '@/lib/types/property'
import type { MaintenanceCategory } from '@/lib/types/property'

// ── KYC types ──────────────────────────────────────────────────────────────
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
  none:     { cls: 'bg-gray-100 text-gray-500',  label: 'Hujatuma'      },
  pending:  { cls: 'bg-amber-50 text-amber-700', label: 'Inakaguliwa'   },
  approved: { cls: 'bg-green-50 text-green-700', label: 'Imeidhinishwa' },
  rejected: { cls: 'bg-red-50 text-red-600',     label: 'Ilikataliwa'   },
}
const DOC_LABELS: Record<string, string> = {
  business_licence:          'Leseni ya Biashara',
  qualification_certificate: 'Cheti cha Utaalamu',
  national_id:               'Kitambulisho',
  other:                     'Nyingine',
}

// ── Plans types ────────────────────────────────────────────────────────────
interface FundiPlan {
  id: string; name: string; description: string | null
  price_tzs: number; billing_cycle: string; max_job_forms: number
  features: Record<string, unknown>; is_active: boolean; is_default: boolean
  display_order: number; created_at: string
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Kila mwezi', quarterly: 'Kila robo mwaka', annual: 'Kila mwaka',
}

const BLANK_PLAN = { name: '', description: '', price_tzs: '', billing_cycle: 'monthly', max_job_forms: '10', is_active: true, is_default: false, display_order: '0' }

export default function AdminFundiPage() {
  const [activeTab, setActiveTab] = useState<'kyc' | 'plans'>('kyc')

  // ── KYC state ─────────────────────────────────────────────────────────
  const [fundi,        setFundi]        = useState<AdminFundi[]>([])
  const [kycLoading,   setKycLoading]   = useState(true)
  const [kycFilter,    setKycFilter]    = useState<KF>('pending')
  const [search,       setSearch]       = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [actioning,    setActioning]    = useState<string | null>(null)
  const [rejectModal,  setRejectModal]  = useState<{ fundiId: string; kycId: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [kycErr,       setKycErr]       = useState<string | null>(null)

  // ── Plans state ───────────────────────────────────────────────────────
  const [plans,        setPlans]        = useState<FundiPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [planForm,     setPlanForm]     = useState(BLANK_PLAN)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [planSaving,   setPlanSaving]   = useState(false)
  const [planErr,      setPlanErr]      = useState<string | null>(null)
  const [showForm,     setShowForm]     = useState(false)

  // ── KYC load ──────────────────────────────────────────────────────────
  async function loadFundi() {
    setKycLoading(true)
    try {
      const params = new URLSearchParams()
      if (kycFilter !== 'all') params.set('kyc_status', kycFilter)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/v1/admin/fundi?${params}`)
      const d   = await res.json()
      setFundi(d.fundi ?? [])
    } catch { /* silent */ }
    finally { setKycLoading(false) }
  }
  useEffect(() => { loadFundi() }, [kycFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleKyc(fundiId: string, kycId: string, action: 'approve' | 'reject', reason?: string) {
    setActioning(kycId); setKycErr(null)
    try {
      const res = await fetch(`/api/v1/admin/fundi/${fundiId}/kyc/${kycId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ action, rejection_reason: reason }),
      })
      if (!res.ok) { const d = await res.json(); setKycErr(d.error ?? 'Kuna tatizo'); return }
      setRejectModal(null); setRejectReason('')
      await loadFundi()
    } catch { setKycErr('Haikuweza. Jaribu tena.') }
    finally { setActioning(null) }
  }

  // ── Plans load ────────────────────────────────────────────────────────
  async function loadPlans() {
    setPlansLoading(true)
    try {
      const res = await fetch('/api/v1/admin/fundi-subscription-plans')
      const d   = await res.json()
      setPlans(d.plans ?? [])
    } catch { /* silent */ }
    finally { setPlansLoading(false) }
  }
  useEffect(() => { if (activeTab === 'plans') loadPlans() }, [activeTab])

  function openNewForm() {
    setEditingId(null); setPlanForm(BLANK_PLAN); setPlanErr(null); setShowForm(true)
  }
  function openEditForm(p: FundiPlan) {
    setEditingId(p.id)
    setPlanForm({
      name: p.name, description: p.description ?? '', price_tzs: String(p.price_tzs),
      billing_cycle: p.billing_cycle, max_job_forms: String(p.max_job_forms),
      is_active: p.is_active, is_default: p.is_default, display_order: String(p.display_order),
    })
    setPlanErr(null); setShowForm(true)
  }
  function cancelForm() { setShowForm(false); setEditingId(null); setPlanForm(BLANK_PLAN); setPlanErr(null) }

  async function savePlan() {
    if (!planForm.name.trim()) { setPlanErr('Jina la mpango linahitajika'); return }
    if (!planForm.price_tzs || isNaN(Number(planForm.price_tzs))) { setPlanErr('Bei sahihi inahitajika'); return }
    setPlanSaving(true); setPlanErr(null)
    try {
      const body = {
        name:          planForm.name.trim(),
        description:   planForm.description.trim() || null,
        price_tzs:     Number(planForm.price_tzs),
        billing_cycle: planForm.billing_cycle,
        max_job_forms: Number(planForm.max_job_forms),
        is_active:     planForm.is_active,
        is_default:    planForm.is_default,
        display_order: Number(planForm.display_order),
      }
      const url    = editingId ? `/api/v1/admin/fundi-subscription-plans/${editingId}` : '/api/v1/admin/fundi-subscription-plans'
      const method = editingId ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d      = await res.json()
      if (!res.ok) { setPlanErr(d.error ?? 'Kuna tatizo'); return }
      cancelForm()
      await loadPlans()
    } catch { setPlanErr('Haikuweza. Jaribu tena.') }
    finally { setPlanSaving(false) }
  }

  async function toggleActive(plan: FundiPlan) {
    await fetch(`/api/v1/admin/fundi-subscription-plans/${plan.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ is_active: !plan.is_active }),
    })
    await loadPlans()
  }

  async function deletePlan(planId: string) {
    if (!confirm('Una uhakika unataka kufuta mpango huu?')) return
    await fetch(`/api/v1/admin/fundi-subscription-plans/${planId}`, { method: 'DELETE' })
    await loadPlans()
  }

  const filteredFundi   = fundi.filter(f => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return f.user?.full_name?.toLowerCase().includes(q) || f.user?.phone?.includes(q) || f.business_name?.toLowerCase().includes(q)
  })
  const pendingKycCount = fundi.filter(f => f.kyc_status === 'pending').length

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
            {kycErr && <p className="text-sm text-red-600 mb-3">{kycErr}</p>}
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

      {/* Plan form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Hariri Mpango' : 'Mpango Mpya wa Usajili'}
              </h2>
              <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600">
                <i className="ti ti-x text-lg" aria-hidden="true" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Jina la Mpango *</label>
                <input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Mfano: Basic, Pro, Premium"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Maelezo (hiari)</label>
                <textarea rows={2} value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Eleza mpango huu kwa mafundi..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Bei (TZS) *</label>
                  <input type="number" min="0" value={planForm.price_tzs} onChange={e => setPlanForm(p => ({ ...p, price_tzs: e.target.value }))}
                    placeholder="5000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Mzunguko wa Malipo</label>
                  <select value={planForm.billing_cycle} onChange={e => setPlanForm(p => ({ ...p, billing_cycle: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    <option value="monthly">Kila mwezi</option>
                    <option value="quarterly">Kila robo mwaka</option>
                    <option value="annual">Kila mwaka</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Fomu za Kazi (kwa mwezi)</label>
                  <input type="number" min="1" value={planForm.max_job_forms} onChange={e => setPlanForm(p => ({ ...p, max_job_forms: e.target.value }))}
                    placeholder="10"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Mpangilio</label>
                  <input type="number" min="0" value={planForm.display_order} onChange={e => setPlanForm(p => ({ ...p, display_order: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={planForm.is_active} onChange={e => setPlanForm(p => ({ ...p, is_active: e.target.checked }))}
                    className="rounded accent-primary-500" />
                  <span className="text-sm text-gray-700">Umewashwa</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={planForm.is_default} onChange={e => setPlanForm(p => ({ ...p, is_default: e.target.checked }))}
                    className="rounded accent-primary-500" />
                  <span className="text-sm text-gray-700">Chaguo-msingi</span>
                </label>
              </div>
              {planErr && <p className="text-sm text-red-600">{planErr}</p>}
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={savePlan} disabled={planSaving}
                className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                {planSaving ? 'Inahifadhi...' : editingId ? 'Hifadhi Mabadiliko' : 'Unda Mpango'}
              </button>
              <button onClick={cancelForm} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Ghairi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Mafundi</h1>
        <p className="text-sm text-gray-500">KYC ya mafundi na mipango ya usajili wa platform</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => setActiveTab('kyc')}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'kyc' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <i className="ti ti-id-badge" aria-hidden="true" /> KYC Mafundi
          {pendingKycCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingKycCount}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('plans')}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'plans' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          <i className="ti ti-currency-dollar" aria-hidden="true" /> Mipango ya Usajili
        </button>
      </div>

      {/* ── KYC Tab ── */}
      {activeTab === 'kyc' && (
        <>
          <div className="flex gap-2 flex-wrap mb-4">
            {KYC_FILTER.map(f => (
              <button key={f} onClick={() => setKycFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
                  kycFilter === f ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {f === 'all' ? 'Wote' : KYC_STATUS_STYLE[f]?.label ?? f}
                {f === 'pending' && pendingKycCount > 0 && (
                  <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${kycFilter === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-700'}`}>
                    {pendingKycCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta jina, simu, biashara..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-300" />
          {kycErr && !rejectModal && <p className="text-sm text-red-600 mb-3">{kycErr}</p>}
          {kycLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
          ) : filteredFundi.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <i className="ti ti-tools text-5xl text-gray-200" aria-hidden="true" />
              <p className="text-gray-500 font-medium mt-3">Hakuna mafundi wanaolingana.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFundi.map(f => {
                const s      = KYC_STATUS_STYLE[f.kyc_status] ?? KYC_STATUS_STYLE.none
                const isExp  = expanded === f.user_id
                const pdocs  = f.kyc_documents.filter(d => d.status === 'pending')
                return (
                  <div key={f.user_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-xl font-medium transition ${pdocs.length > 0 ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {pdocs.length > 0 ? `Kagua (${pdocs.length})` : 'Hati'}
                      </button>
                    </div>
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
                                  <button onClick={() => { setRejectModal({ fundiId: f.user_id, kycId: doc.id }); setRejectReason(''); setKycErr(null) }}
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
        </>
      )}

      {/* ── Plans Tab ── */}
      {activeTab === 'plans' && (
        <>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm text-gray-500">Simamia mipango ya usajili inayolipwa na mafundi kujibu maombi ya kazi.</p>
            </div>
            <button onClick={openNewForm}
              className="flex items-center gap-1.5 bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              <i className="ti ti-plus text-base" aria-hidden="true" /> Mpango Mpya
            </button>
          </div>

          {plansLoading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
          ) : plans.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
              <i className="ti ti-currency-dollar text-5xl text-gray-200" aria-hidden="true" />
              <p className="text-gray-500 font-medium mt-3">Hakuna mipango bado.</p>
              <button onClick={openNewForm} className="mt-4 text-sm text-primary-600 font-semibold hover:underline">
                Unda mpango wa kwanza
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map(p => (
                <div key={p.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${p.is_active ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-60'}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{p.name}</span>
                        {p.is_default && <span className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full font-semibold">Chaguo-msingi</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {p.is_active ? 'Imewashwa' : 'Imezimwa'}
                        </span>
                      </div>
                    </div>
                    {p.description && <p className="text-xs text-gray-500 mb-3 leading-relaxed">{p.description}</p>}
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="font-bold text-primary-600 text-lg">TZS {p.price_tzs.toLocaleString()}</span>
                        <span className="text-gray-400 text-xs ml-1">/ {CYCLE_LABELS[p.billing_cycle] ?? p.billing_cycle}</span>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <i className="ti ti-file-text" aria-hidden="true" />
                        {p.max_job_forms >= 999 ? 'Fomu bila kikomo' : `Fomu ${p.max_job_forms}/mwezi`}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-3 flex items-center gap-2 border-t border-gray-50 pt-3">
                    <button onClick={() => openEditForm(p)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition flex items-center gap-1">
                      <i className="ti ti-pencil text-xs" aria-hidden="true" /> Hariri
                    </button>
                    <button onClick={() => toggleActive(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${p.is_active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                      {p.is_active ? 'Zima' : 'Washa'}
                    </button>
                    <button onClick={() => deletePlan(p.id)}
                      className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition flex items-center gap-1 ml-auto">
                      <i className="ti ti-trash text-xs" aria-hidden="true" /> Futa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info note */}
          <div className="mt-6 bg-blue-50 rounded-2xl p-4 flex gap-3">
            <i className="ti ti-info-circle text-blue-500 text-lg flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Jinsi Usajili wa Fundi Unavyofanya Kazi</p>
              <p>Fundi analipa mpango kupitia NyumbaFasta na AzamPay (M-Pesa, Airtel, Tigo). Baada ya malipo, anaweza kujibu maombi ya kazi ya wateja.</p>
              <p>Mapato yote yanakwenda moja kwa moja kwenye <strong>Hesabu za NyumbaFasta</strong> kama <code>fundi_subscription</code>.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
