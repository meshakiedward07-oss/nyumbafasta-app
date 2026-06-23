'use client'
import { useState, useEffect, useCallback } from 'react'
import PermissionManagerModal from '@/components/admin/PermissionManagerModal'

type StaffMember = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  staff_title: string | null
  staff_active: boolean
  max_leads_capacity: number
  activeLeads: number
  totalConverted: number
  created_at: string
}

const TITLES = ['Sales Agent', 'Onboarding Specialist', 'Team Lead', 'Customer Success']

export default function StaffManagementClient() {
  const [staff, setStaff]           = useState<StaffMember[]>([])
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]             = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null)
  const [editMember, setEditMember]       = useState<StaffMember | null>(null)
  const [managingPerms, setManagingPerms] = useState<StaffMember | null>(null)
  const [activityStaff, setActivityStaff] = useState<StaffMember | null>(null)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/v1/admin/staff')
    const data = await res.json()
    setStaff(data.staff || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  async function toggleActive(member: StaffMember) {
    await fetch(`/api/v1/admin/staff/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffActive: !member.staff_active }),
    })
    loadStaff()
  }

  async function deleteMember(member: StaffMember) {
    await fetch(`/api/v1/admin/staff/${member.id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    loadStaff()
  }

  const activeCount    = staff.filter(s => s.staff_active).length
  const totalLeads     = staff.reduce((a, s) => a + s.activeLeads, 0)
  const totalConverted = staff.reduce((a, s) => a + s.totalConverted, 0)

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">👨‍💼 Wafanyakazi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Timu inayoshughulikia madalali watarajiwa
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-[#1D9E75] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          ➕ Ongeza
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Wafanyakazi', value: activeCount,    emoji: '👤' },
          { label: 'Leads Active', value: totalLeads,    emoji: '🔄' },
          { label: 'Walisajili',  value: totalConverted, emoji: '✅' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <div className="text-xl">{s.emoji}</div>
            <div className="text-xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Staff list */}
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-24 animate-pulse mb-3 border border-gray-100" />
        ))
      ) : staff.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="text-5xl mb-3">👥</div>
          <p className="font-semibold text-gray-700">Hakuna wafanyakazi bado</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Ongeza mfanyakazi wa kwanza kushughulikia leads
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-[#1D9E75] text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            ➕ Ongeza Mfanyakazi
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-[#E1F5EE] flex items-center justify-center font-bold text-[#1D9E75] text-lg flex-shrink-0">
                  {s.full_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{s.full_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      s.staff_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.staff_active ? '🟢 Active' : '⚪ Zimwa'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {s.staff_title} · {s.phone}
                  </p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{s.activeLeads}</p>
                  <p className="text-[10px] text-gray-400">Active Leads</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-[#1D9E75]">{s.totalConverted}</p>
                  <p className="text-[10px] text-gray-400">Walisajili</p>
                </div>
              </div>
              {/* Capacity bar */}
              <div className="mt-2 pt-2 border-t border-gray-50">
                {(() => {
                  const pct = Math.round((s.activeLeads / s.max_leads_capacity) * 100)
                  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-[#1D9E75]'
                  const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-[#1D9E75]'
                  return (
                    <>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-gray-400">{s.activeLeads} / {s.max_leads_capacity} leads</span>
                        <span className={`font-medium ${textColor}`}>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => setManagingPerms(s)}
                  className="bg-blue-50 text-blue-700 text-xs py-2 rounded-xl font-medium border border-blue-100"
                >
                  🔑 Ruhusa
                </button>
                <button
                  onClick={() => setActivityStaff(s)}
                  className="border border-gray-200 text-gray-600 text-xs py-2 rounded-xl font-medium"
                >
                  📋 Shughuli
                </button>
                <button
                  onClick={() => setEditMember(s)}
                  className="border border-gray-200 text-gray-600 text-xs py-2 rounded-xl font-medium"
                >
                  ✏️ Hariri
                </button>
                <button
                  onClick={() => toggleActive(s)}
                  className={`text-xs py-2 rounded-xl font-medium ${
                    s.staff_active
                      ? 'bg-orange-50 text-orange-600 border border-orange-200'
                      : 'bg-green-50 text-green-600 border border-green-200'
                  }`}
                >
                  {s.staff_active ? '⏸ Zimwa' : '▶ Washa'}
                </button>
              </div>
              <button
                onClick={() => setConfirmDelete(s)}
                className="w-full mt-2 bg-red-50 text-red-600 text-xs py-2 rounded-xl font-medium border border-red-100"
              >
                🗑 Futa Akaunti
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddStaffModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); loadStaff() }}
        />
      )}

      {/* Edit modal */}
      {editMember && (
        <EditStaffModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={() => { setEditMember(null); loadStaff() }}
        />
      )}

      {/* Permission manager modal */}
      {managingPerms && (
        <PermissionManagerModal
          staff={managingPerms}
          onClose={() => setManagingPerms(null)}
          onSaved={() => setManagingPerms(null)}
        />
      )}

      {/* Activity feed modal */}
      {activityStaff && (
        <ActivityFeedModal
          staff={activityStaff}
          onClose={() => setActivityStaff(null)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h3 className="font-bold text-gray-900">Futa {confirmDelete.full_name}?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Leads {confirmDelete.activeLeads} zake zitaachwa bila mgawo. Hatua hii haiwezi kurudishwa.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600"
              >
                Ghairi
              </button>
              <button
                onClick={() => deleteMember(confirmDelete)}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold"
              >
                Futa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Staff Modal ──────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name,         setName]         = useState('')
  const [phone,        setPhone]        = useState('255')
  const [email,        setEmail]        = useState('')
  const [title,        setTitle]        = useState('Sales Agent')
  const [capacity,     setCapacity]     = useState(500)
  const [roleTemplate, setRoleTemplate] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/v1/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, staffTitle: title, maxLeadsCapacity: capacity, roleTemplate: roleTemplate || undefined }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Imeshindwa kuunda akaunti')
      return
    }

    setSuccess(data.message)
    setTimeout(onCreated, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-gray-900 mb-4">➕ Ongeza Mfanyakazi Mpya</h2>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl mb-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-3 py-2 rounded-xl mb-3">
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Jina Kamili *</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="mfano: Asha Mohammed"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Namba ya Simu * (format: 255XXXXXXXXX)</label>
            <input
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="255712345678"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Barua Pepe *</label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="asha@nyumbafasta.co"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Cheo</label>
            <select
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            >
              {TITLES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Ukomo wa Leads
            </label>
            <input
              type="number"
              min={1}
              max={9999}
              step={50}
              value={capacity}
              onChange={e => setCapacity(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            />
            <div className="flex gap-1.5 mt-1.5">
              {[100, 250, 500, 1000].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCapacity(n)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${
                    capacity === n
                      ? 'bg-[#1D9E75] text-white border-[#1D9E75]'
                      : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Default: 500 leads kwa kila staff</p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Aina ya Kazi (Permissions za Awali)</label>
            <select
              value={roleTemplate}
              onChange={e => setRoleTemplate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            >
              <option value="">Bila ruhusa (weka baadaye)</option>
              <option value="sales_agent">Sales Agent — Leads tu</option>
              <option value="onboarding_specialist">Onboarding Specialist — Leads + Scraper</option>
              <option value="customer_support">Customer Support — WhatsApp + Violations</option>
              <option value="social_media_manager">Social Media Manager — Social + Spam</option>
              <option value="quality_control">Quality Control — Spam + Violations + Analytics</option>
              <option value="team_lead">Team Lead — Vyote</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Unaweza kubadilisha ruhusa baadaye kupitia kitufe cha 🔑</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            💡 Password ya muda itatengenezwa na kutumwa kwa WhatsApp. Mfanyakazi atalazimishwa kuibadilisha mara ya kwanza ya kuingia.
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600"
            >
              Ghairi
            </button>
            <button
              type="submit"
              disabled={saving || !name || !phone || !email}
              className="flex-1 bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Inahifadhi...' : 'Unda Akaunti'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Activity Feed Modal ──────────────────────────────────────────────────────
type Activity = {
  id: string
  action_type: string
  resource_type: string | null
  description: string
  created_at: string
}

function ActivityFeedModal({
  staff,
  onClose,
}: {
  staff: StaffMember
  onClose: () => void
}) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    fetch(`/api/v1/admin/staff/${staff.id}/activity`)
      .then(r => r.json())
      .then(d => setActivities(d.activities ?? []))
      .finally(() => setLoading(false))
  }, [staff.id])

  const actionEmoji: Record<string, string> = {
    lead_stage_update: '🎯',
    whatsapp_takeover: '💬',
    comment_moderated: '🚫',
    violation_resolved: '⚖️',
    scraper_run: '🤖',
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">📋 Shughuli za {staff.full_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vitendo 50 vya hivi karibuni</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl px-2">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl mb-2" />
            ))
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm">Hakuna shughuli bado</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50">
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {actionEmoji[a.action_type] ?? '📌'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{a.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {a.action_type.replace(/_/g, ' ')}
                      {a.resource_type ? ` · ${a.resource_type}` : ''}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-300 flex-shrink-0 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString('sw-TZ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────
function EditStaffModal({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMember
  onClose: () => void
  onSaved: () => void
}) {
  const [name,     setName]     = useState(member.full_name)
  const [title,    setTitle]    = useState(member.staff_title || 'Sales Agent')
  const [capacity, setCapacity] = useState(member.max_leads_capacity)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch(`/api/v1/admin/staff/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, staffTitle: title, maxLeadsCapacity: capacity }),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Imeshindwa kuhifadhi')
      return
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <h2 className="font-bold text-gray-900 mb-4">✏️ Hariri {member.full_name}</h2>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Jina Kamili</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Cheo</label>
            <select
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            >
              {TITLES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Ukomo wa Leads
            </label>
            <input
              type="number"
              min={1}
              max={9999}
              step={50}
              value={capacity}
              onChange={e => setCapacity(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30"
            />
            <div className="flex gap-1.5 mt-1.5">
              {[100, 250, 500, 1000].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCapacity(n)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${
                    capacity === n
                      ? 'bg-[#1D9E75] text-white border-[#1D9E75]'
                      : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600"
            >
              Ghairi
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Inahifadhi...' : 'Hifadhi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
