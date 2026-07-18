'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Campaign = {
  id: string; title: string; ad_type: string; status: string
  payment_status: string; target_region: string; created_at: string; admin_note: string | null
  advertiser: { id: string; business_name: string; contact_phone: string; city: string; status: string } | null
  plan: { name: string; price_tzs: number } | null
}

type StaffMember = {
  id: string; full_name: string; staff_title: string | null
}

const STATUS_TABS = [
  { value: 'pending_review', label: 'Zinasubiri Ukaguzi' },
  { value: 'approved',       label: 'Zimeidhinishwa' },
  { value: 'active',         label: 'Zinafanya Kazi' },
  { value: 'rejected',       label: 'Zimekataliwa' },
  { value: 'expired',        label: 'Zimekwisha' },
]

const TYPE_ICONS: Record<string, string> = {
  banner: '🎯', search: '🔍', nearby: '📍', video: '🎬', featured: '⭐',
}

export default function AdminAdvertsPage() {
  const [tab, setTab]           = useState('pending_review')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [reason, setReason]     = useState('')
  const [showReject, setShowReject] = useState(false)

  // Assign to staff
  const [assignCampaign, setAssignCampaign] = useState<Campaign | null>(null)
  const [staffList, setStaffList]           = useState<StaffMember[]>([])
  const [staffLoading, setStaffLoading]     = useState(false)
  const [assignNote, setAssignNote]         = useState('')
  const [assignTo, setAssignTo]             = useState('')
  const [assigning, setAssigning]           = useState(false)
  const [assignToast, setAssignToast]       = useState<string | null>(null)

  async function openAssign(c: Campaign) {
    setAssignCampaign(c)
    setAssignTo('')
    setAssignNote('')
    setStaffLoading(true)
    try {
      const r = await fetch('/api/v1/admin/staff?permission=review_ads')
      const d = await r.json()
      setStaffList(d.staff ?? [])
    } finally { setStaffLoading(false) }
  }

  async function submitAssignment() {
    if (!assignCampaign || !assignTo) return
    setAssigning(true)
    try {
      const res = await fetch('/api/v1/staff/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id:    assignTo,
          title:       `Kagua tangazo: ${assignCampaign.title}`,
          description: assignNote || `Kampeni ya ${assignCampaign.ad_type} kutoka ${assignCampaign.advertiser?.business_name ?? '—'}. Tafadhali kagua na uidhinishe au kataa.`,
          category:    'moderation',
          priority:    'normal',
          ref_type:    'ad_campaign',
          ref_id:      assignCampaign.id,
        }),
      })
      if (res.ok) {
        setAssignCampaign(null)
        setAssignToast('Kazi imepewa mfanyakazi!')
        setTimeout(() => setAssignToast(null), 3000)
      }
    } finally { setAssigning(false) }
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

  async function bulkAction(action: 'approve' | 'reject') {
    if (selected.size === 0) return
    setActionLoading(true)
    try {
      await fetch('/api/v1/admin/adverts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected], action, reason: reason || undefined }),
      })
      await load()
      setSelected(new Set())
      setShowReject(false)
      setReason('')
    } finally { setActionLoading(false) }
  }

  async function singleAction(id: string, action: string, note?: string) {
    setActionLoading(true)
    try {
      await fetch(`/api/v1/admin/adverts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: note }),
      })
      await load()
    } finally { setActionLoading(false) }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  return (
    <div className="p-6">

      {/* Toast */}
      {assignToast && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white bg-primary-600 animate-in slide-in-from-top-2">
          ✅ {assignToast}
        </div>
      )}

      {/* Assign to Staff Modal */}
      {assignCampaign && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAssignCampaign(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-bold text-gray-900 mb-1">Pewa Mfanyakazi</h3>
            <p className="text-xs text-gray-500 mb-4">
              Pewa kazi ya kukagua kampeni: <span className="font-semibold text-gray-700">{assignCampaign.title}</span>
            </p>
            {staffLoading ? (
              <div className="space-y-2 mb-4">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}
              </div>
            ) : staffList.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4 text-center py-4">Hakuna mfanyakazi mwenye ruhusa ya kukagua matangazo.</p>
            ) : (
              <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
                {staffList.map(s => (
                  <label key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition border ${
                    assignTo === s.id ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="staff" value={s.id} checked={assignTo === s.id}
                      onChange={() => setAssignTo(s.id)} className="accent-primary-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{s.full_name}</p>
                      {s.staff_title && <p className="text-xs text-gray-400">{s.staff_title}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <textarea
              value={assignNote}
              onChange={e => setAssignNote(e.target.value)}
              placeholder="Maelezo ya ziada kwa mfanyakazi (hiari)..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setAssignCampaign(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">
                Ghairi
              </button>
              <button
                onClick={submitAssignment}
                disabled={!assignTo || assigning}
                className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary-600 transition">
                {assigning ? 'Inatuma...' : 'Pewa Kazi'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Kampeni za Matangazo</h1>
        <div className="flex gap-4">
          <Link href="/admin/adverts/advertisers" className="text-sm text-primary-600 hover:underline">
            Wafanyabiashara →
          </Link>
          <Link href="/admin/adverts/plans" className="text-sm text-primary-600 hover:underline">
            Simamia Mipango →
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              tab === t.value ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-primary-700">{selected.size} zimechaguliwa</span>
          <button
            onClick={() => bulkAction('approve')}
            disabled={actionLoading}
            className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            ✓ Idhinisha
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={actionLoading}
            className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            ✗ Kataa
          </button>
          {showReject && (
            <div className="flex gap-2 flex-1">
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="flex-1 border border-red-300 rounded-lg px-2 py-1 text-xs"
                placeholder="Sababu ya kukataa (hiari)..."
              />
              <button
                onClick={() => bulkAction('reject')}
                disabled={actionLoading}
                className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                Thibitisha
              </button>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>Hakuna kampeni za {STATUS_TABS.find(t => t.value === tab)?.label}</p>
        </div>
      )}

      <div className="space-y-2">
        {campaigns.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggleSelect(c.id)}
                className="mt-1 accent-primary-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span>{TYPE_ICONS[c.ad_type] ?? '📢'}</span>
                  <span className="font-bold text-gray-800 text-sm truncate">{c.title}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                    {c.ad_type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span>📍 {c.target_region}</span>
                  {c.advertiser && <span>🏪 {c.advertiser.business_name} ({c.advertiser.city})</span>}
                  {c.plan && <span>💰 TZS {c.plan.price_tzs.toLocaleString()}</span>}
                  <span>🗓 {new Date(c.created_at).toLocaleDateString('sw-TZ')}</span>
                </div>
                {c.admin_note && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 mt-1 inline-block">
                    Note: {c.admin_note}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Link
                  href={`/admin/adverts/${c.id}`}
                  className="border border-gray-200 text-gray-500 text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition"
                >
                  Angalia
                </Link>
                <button
                  onClick={() => openAssign(c)}
                  className="border border-primary-200 text-primary-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition"
                  title="Pewa mfanyakazi"
                >
                  👤
                </button>
                {tab === 'pending_review' && (
                  <>
                    <button
                      onClick={() => singleAction(c.id, 'approve')}
                      disabled={actionLoading}
                      className="bg-green-600 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        const r = window.prompt('Sababu ya kukataa (hiari):') ?? ''
                        singleAction(c.id, 'reject', r)
                      }}
                      disabled={actionLoading}
                      className="bg-red-600 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                    >
                      ✗
                    </button>
                  </>
                )}
                {tab === 'active' && (
                  <button
                    onClick={() => singleAction(c.id, 'suspend', 'Imesimamishwa na admin')}
                    disabled={actionLoading}
                    className="bg-amber-500 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
                  >
                    Simamisha
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {total > 20 && (
        <p className="text-center text-xs text-gray-400 mt-4">
          Kuonyesha {campaigns.length} kati ya {total}
        </p>
      )}
    </div>
  )
}
