'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Campaign = {
  id: string; title: string; ad_type: string; status: string
  payment_status: string; target_region: string; created_at: string; admin_note: string | null
  advertiser: { id: string; business_name: string; contact_phone: string; city: string; status: string } | null
  plan: { name: string; price_tzs: number } | null
}
type StaffMember = { id: string; full_name: string; staff_title: string | null }

const STATUS_TABS = [
  { value: 'pending_review', label: 'Zinasubiri',      dot: 'bg-amber-400' },
  { value: 'approved',       label: 'Zimeidhinishwa',  dot: 'bg-blue-400' },
  { value: 'active',         label: 'Zinafanya Kazi',  dot: 'bg-green-400' },
  { value: 'rejected',       label: 'Zimekataliwa',    dot: 'bg-red-400' },
  { value: 'expired',        label: 'Zimekwisha',      dot: 'bg-gray-300' },
]

const AD_TYPE_META: Record<string, { icon: string; cls: string }> = {
  banner:    { icon: '🎯', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  search:    { icon: '🔍', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  nearby:    { icon: '📍', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  video:     { icon: '🎬', cls: 'bg-pink-50 text-pink-700 border-pink-200' },
  featured:  { icon: '⭐', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  directory: { icon: '📂', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  bundle:    { icon: '📦', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
}

const PAY_CHIP: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-red-100 text-red-700',
}

export default function AdminAdvertsPage() {
  const [tab, setTab]             = useState('pending_review')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)

  // Reject modal (handles both single and bulk)
  const [rejectModal, setRejectModal] = useState<{ ids: string[] } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Assign to staff modal
  const [assignCampaign, setAssignCampaign] = useState<Campaign | null>(null)
  const [staffList, setStaffList]           = useState<StaffMember[]>([])
  const [staffLoading, setStaffLoading]     = useState(false)
  const [assignNote, setAssignNote]         = useState('')
  const [assignTo, setAssignTo]             = useState('')
  const [assigning, setAssigning]           = useState(false)

  const [toast, setToast] = useState<{ msg: string; ok?: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/v1/admin/adverts?status=${tab}`)
      const d = await r.json()
      setCampaigns(d.campaigns ?? [])
      setTotal(d.total ?? 0)
    } finally { setLoading(false) }
  }, [tab])

  useEffect(() => { load(); setSelected(new Set()) }, [load])

  async function openAssign(c: Campaign) {
    setAssignCampaign(c); setAssignTo(''); setAssignNote(''); setStaffLoading(true)
    try {
      const r = await fetch('/api/v1/admin/staff?permission=review_ads')
      setStaffList((await r.json()).staff ?? [])
    } finally { setStaffLoading(false) }
  }

  async function submitAssignment() {
    if (!assignCampaign || !assignTo) return
    setAssigning(true)
    try {
      const res = await fetch('/api/v1/staff/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: assignTo,
          title: `Kagua tangazo: ${assignCampaign.title}`,
          description: assignNote || `Kampeni ya ${assignCampaign.ad_type} kutoka ${assignCampaign.advertiser?.business_name ?? '—'}.`,
          category: 'moderation', priority: 'normal',
          ref_type: 'ad_campaign', ref_id: assignCampaign.id,
        }),
      })
      if (res.ok) { setAssignCampaign(null); showToast('Kazi imepewa mfanyakazi!') }
    } finally { setAssigning(false) }
  }

  async function doAction(ids: string[], action: 'approve' | 'reject' | 'suspend', reason?: string) {
    setActionLoading(true)
    try {
      if (ids.length === 1 && action !== 'approve') {
        await fetch(`/api/v1/admin/adverts/${ids[0]}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason }),
        })
      } else if (ids.length === 1 && action === 'approve') {
        await fetch(`/api/v1/admin/adverts/${ids[0]}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
      } else {
        await fetch('/api/v1/admin/adverts', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, action, reason }),
        })
      }
      await load()
      setSelected(new Set())
      const label = action === 'approve' ? '✅ Zimeidhinishwa' : action === 'reject' ? '❌ Zimekataliwa' : '⏸ Zimesimamishwa'
      showToast(`${label} (${ids.length})`)
    } finally { setActionLoading(false) }
  }

  function openReject(ids: string[]) { setRejectModal({ ids }); setRejectReason('') }

  async function confirmReject() {
    if (!rejectModal) return
    await doAction(rejectModal.ids, 'reject', rejectReason)
    setRejectModal(null)
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const allSelected = campaigns.length > 0 && campaigns.every(c => selected.has(c.id))

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[300] px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white animate-in slide-in-from-top-2 ${toast.ok === false ? 'bg-red-600' : 'bg-gray-900'}`}>
          {toast.msg}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center mb-3">
              <span className="text-xl">❌</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Kataa Kampeni</h3>
            <p className="text-sm text-gray-500 mb-4">
              {rejectModal.ids.length > 1 ? `Kampeni ${rejectModal.ids.length} zilizochaguliwa zitakataliwa.` : 'Kampeni hii itakataliwa.'}
            </p>
            <textarea
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Sababu ya kukataa (hiari)..."
              rows={3} autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Ghairi
              </button>
              <button onClick={confirmReject} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition">
                {actionLoading ? 'Inakataa...' : 'Kataa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignCampaign && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAssignCampaign(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-bold text-gray-900 mb-1">Pewa Mfanyakazi</h3>
            <p className="text-xs text-gray-500 mb-4">Kampeni: <span className="font-semibold text-gray-700">{assignCampaign.title}</span></p>
            {staffLoading ? (
              <div className="space-y-2 mb-4">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl" />)}</div>
            ) : staffList.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4 text-center py-4">Hakuna mfanyakazi mwenye ruhusa ya kukagua matangazo.</p>
            ) : (
              <div className="space-y-1.5 mb-4 max-h-52 overflow-y-auto">
                {staffList.map(s => (
                  <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition ${assignTo === s.id ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <input type="radio" name="staff" value={s.id} checked={assignTo === s.id} onChange={() => setAssignTo(s.id)} className="accent-primary-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{s.full_name}</p>
                      {s.staff_title && <p className="text-xs text-gray-400">{s.staff_title}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <textarea value={assignNote} onChange={e => setAssignNote(e.target.value)}
              placeholder="Maelezo ya ziada (hiari)..." rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setAssignCampaign(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Ghairi</button>
              <button onClick={submitAssignment} disabled={!assignTo || assigning}
                className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary-600 transition">
                {assigning ? 'Inatuma...' : 'Pewa Kazi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Kampeni za Matangazo</h1>
            <p className="text-xs text-gray-400 mt-0.5">Kagua, idhinisha na simamia kampeni</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/adverts/advertisers"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition font-medium">
              🏪 <span className="hidden sm:inline">Wafanyabiashara</span>
            </Link>
            <Link href="/admin/adverts/plans"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition font-medium">
              📋 <span className="hidden sm:inline">Mipango</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 max-w-5xl mx-auto">

        {/* Status tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl p-1 mb-4 overflow-x-auto shadow-sm">
          {STATUS_TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl font-medium transition ${
                tab === t.value ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.dot} ${tab === t.value ? 'opacity-70' : 'opacity-50'}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Bulk toolbar — slides in when items selected */}
        {selected.size > 0 && (
          <div className="bg-gray-900 text-white rounded-2xl px-4 py-3 mb-3 flex items-center gap-3 flex-wrap shadow-lg">
            <span className="text-sm font-bold">{selected.size} zimechaguliwa</span>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-white transition ml-1">
              × Futa
            </button>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => doAction([...selected], 'approve')} disabled={actionLoading}
                className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-400 disabled:opacity-50 transition">
                ✓ Idhinisha zote
              </button>
              <button onClick={() => openReject([...selected])} disabled={actionLoading}
                className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-400 disabled:opacity-50 transition">
                ✗ Kataa zote
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[88px] bg-white rounded-2xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && campaigns.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-20">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-semibold text-gray-600">Hakuna kampeni</p>
            <p className="text-sm text-gray-400 mt-1">Hakuna {STATUS_TABS.find(t => t.value === tab)?.label.toLowerCase()} sasa hivi</p>
          </div>
        )}

        {/* List */}
        {!loading && campaigns.length > 0 && (
          <div className="space-y-2">
            {/* Select all */}
            <div className="flex items-center gap-3 px-1 pb-1">
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                <input type="checkbox" checked={allSelected}
                  onChange={() => allSelected ? setSelected(new Set()) : setSelected(new Set(campaigns.map(c => c.id)))}
                  className="accent-primary-500" />
                Chagua zote
              </label>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{total} jumla</span>
            </div>

            {campaigns.map(c => {
              const meta = AD_TYPE_META[c.ad_type] ?? { icon: '📢', cls: 'bg-gray-50 text-gray-600 border-gray-200' }
              const payColor = PAY_CHIP[c.payment_status] ?? 'bg-gray-100 text-gray-500'
              const isSelected = selected.has(c.id)
              return (
                <div key={c.id}
                  className={`bg-white rounded-2xl border transition-all ${isSelected ? 'border-primary-300 ring-1 ring-primary-200' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                  <div className="flex items-start gap-3 p-4">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c.id)}
                      className="mt-1 accent-primary-500 flex-shrink-0" />

                    {/* Type icon */}
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 text-base ${meta.cls}`}>
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{c.title}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${meta.cls}`}>
                              {c.ad_type.toUpperCase()}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${payColor}`}>
                              {c.payment_status === 'completed' ? '✓' : c.payment_status === 'pending' ? '⏳' : '✗'} {c.payment_status}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                          <Link href={`/admin/adverts/${c.id}`}
                            className="text-xs border border-gray-200 text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition font-medium">
                            Angalia
                          </Link>
                          <button onClick={() => openAssign(c)} title="Pewa mfanyakazi"
                            className="text-xs border border-gray-200 text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition">
                            👤
                          </button>
                          {tab === 'pending_review' && (
                            <>
                              <button onClick={() => doAction([c.id], 'approve')} disabled={actionLoading}
                                className="text-xs bg-green-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium transition">
                                ✓ Idhinisha
                              </button>
                              <button onClick={() => openReject([c.id])} disabled={actionLoading}
                                className="text-xs bg-red-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium transition">
                                ✗ Kataa
                              </button>
                            </>
                          )}
                          {tab === 'active' && (
                            <button onClick={() => doAction([c.id], 'suspend', 'Imesimamishwa na admin')} disabled={actionLoading}
                              className="text-xs bg-amber-500 text-white px-2.5 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium transition">
                              ⏸ Simamisha
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-gray-400">
                        <span>📍 {c.target_region}</span>
                        {c.advertiser && <span>🏪 {c.advertiser.business_name}{c.advertiser.city ? `, ${c.advertiser.city}` : ''}</span>}
                        {c.plan && <span>💰 Tsh {c.plan.price_tzs.toLocaleString()}</span>}
                        <span>🗓 {new Date(c.created_at).toLocaleDateString('sw-TZ')}</span>
                      </div>

                      {c.admin_note && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2 border border-amber-100">
                          📝 {c.admin_note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {total > 20 && !loading && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Kuonyesha {campaigns.length} kati ya {total}
          </p>
        )}
      </div>
    </div>
  )
}
