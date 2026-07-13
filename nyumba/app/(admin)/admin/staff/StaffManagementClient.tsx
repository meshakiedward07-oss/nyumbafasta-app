'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import PermissionManagerModal from '@/components/admin/PermissionManagerModal'

type RoleFilter = 'staff' | 'performance' | 'dalali_activity'

type DalaliRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  whatsapp_number: string | null
  days_since_registration: number
  days_before_deletion: number | null
  total_listings_ever: number
  listing_warnings_count: number
  risk_level: 'safe' | 'new' | 'at_risk' | 'critical' | 'overdue'
  listing_deadline_days: number
}

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
  totalLost: number
  created_at: string
}

const TITLES = ['Sales Agent', 'Onboarding Specialist', 'Team Lead', 'Customer Success']

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 3600)  return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

export default function StaffManagementClient() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('staff')
  const [staff, setStaff]           = useState<StaffMember[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all')
  const [toast, setToast]           = useState<{msg: string; ok: boolean} | null>(null)

  const [showAdd, setShowAdd]             = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null)
  const [editMember, setEditMember]       = useState<StaffMember | null>(null)
  const [managingPerms,    setManagingPerms]    = useState<StaffMember | null>(null)
  const [activityStaff,    setActivityStaff]    = useState<StaffMember | null>(null)
  const [performanceStaff, setPerformanceStaff] = useState<StaffMember | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/admin/staff')
      const data = await res.json()
      setStaff(data.staff || [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  // Client-side search + filter
  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase().trim()
    return staff.filter(s => {
      if (statusFilter === 'active'   && !s.staff_active) return false
      if (statusFilter === 'inactive' &&  s.staff_active) return false
      if (!q) return true
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.email    ?? '').toLowerCase().includes(q) ||
        (s.phone    ?? '').includes(q) ||
        (s.staff_title ?? '').toLowerCase().includes(q)
      )
    })
  }, [staff, search, statusFilter])

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
    showToast(`${member.full_name} amefutwa`)
  }

  const activeCount    = staff.filter(s => s.staff_active).length
  const totalLeads     = staff.reduce((a, s) => a + s.activeLeads, 0)
  const totalConverted = staff.reduce((a, s) => a + s.totalConverted, 0)

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto pb-24 relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i className="ti ti-users" aria-hidden="true" /> Wafanyakazi
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Timu inayoshughulikia madalali watarajiwa</p>
        </div>
        {roleFilter === 'staff' && (
          <button
            onClick={() => setShowAdd(true)}
            className="bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <i className="ti ti-plus" aria-hidden="true" /> Ongeza
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-5 border-b border-gray-100 pb-3">
        {([
          { key: 'staff',           label: 'Wafanyakazi',   icon: 'users' },
          { key: 'performance',     label: 'Ubora wa Timu', icon: 'chart-bar' },
          { key: 'dalali_activity', label: 'Hatari (Madalali)', icon: 'alert-triangle' },
        ] as { key: RoleFilter; label: string; icon: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setRoleFilter(tab.key)}
            className={`flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-full font-medium transition-all ${
              roleFilter === tab.key
                ? 'bg-primary-500 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className={`ti ti-${tab.icon}`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dalali activity view */}
      {roleFilter === 'dalali_activity' && <DalaliActivityView />}

      {/* Team performance leaderboard */}
      {roleFilter === 'performance' && (
        <TeamPerformanceView staff={staff} onSelect={setPerformanceStaff} />
      )}

      {/* ── Staff section ──────────────────────────────────────────────────── */}
      {roleFilter === 'staff' && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Active',       value: activeCount,    icon: 'user',         color: 'text-primary-600 bg-primary-50' },
              { label: 'Active Leads', value: totalLeads,     icon: 'refresh',      color: 'text-blue-600 bg-blue-50' },
              { label: 'Walisajili',   value: totalConverted, icon: 'circle-check', color: 'text-emerald-600 bg-emerald-50' },
            ].map((s, i) => (
              <div key={i} className={`${s.color} rounded-2xl p-3 text-center border border-white/60`}>
                <i className={`ti ti-${s.icon} text-xl`} aria-hidden="true" />
                <div className="text-2xl font-bold mt-0.5">{s.value}</div>
                <div className="text-[10px] font-medium opacity-70 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Search + filter bar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 flex gap-2 shadow-sm">
            <div className="relative flex-1">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tafuta jina, email, simu, cheo…"
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all'|'active'|'inactive')}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none"
            >
              <option value="all">Wote ({staff.length})</option>
              <option value="active">Active ({staff.filter(s => s.staff_active).length})</option>
              <option value="inactive">Zimwa ({staff.filter(s => !s.staff_active).length})</option>
            </select>
          </div>

          {/* Staff list */}
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-36 animate-pulse mb-3 border border-gray-100" />
            ))
          ) : filteredStaff.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <i className="ti ti-users text-5xl text-gray-300 block mb-3" />
              <p className="font-semibold text-gray-700">
                {staff.length === 0 ? 'Hakuna wafanyakazi bado' : `Hakuna wanaofanana na "${search}"`}
              </p>
              <p className="text-sm text-gray-400 mt-1 mb-4">
                {staff.length === 0 ? 'Ongeza mfanyakazi wa kwanza kushughulikia leads' : 'Jaribu maneno mengine ya utafutaji'}
              </p>
              {staff.length === 0 && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
                >
                  <i className="ti ti-plus" aria-hidden="true" /> Ongeza Mfanyakazi
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStaff.map(s => {
                const capacity = s.max_leads_capacity > 0 ? s.max_leads_capacity : 1
                const pct      = Math.min(100, Math.round((s.activeLeads / capacity) * 100))
                const barColor  = pct >= 90 ? 'bg-red-500'    : pct >= 70 ? 'bg-amber-500' : 'bg-primary-500'
                const textColor = pct >= 90 ? 'text-red-600'  : pct >= 70 ? 'text-amber-600' : 'text-primary-500'
                const convRate  = (s.activeLeads + s.totalConverted + s.totalLost) > 0
                  ? Math.round((s.totalConverted / (s.activeLeads + s.totalConverted + s.totalLost)) * 1000) / 10
                  : 0
                const grade     = convRate >= 20 ? 'A' : convRate >= 12 ? 'B' : convRate >= 6 ? 'C' : 'D'
                const gradeStyle: Record<string, string> = {
                  A: 'bg-green-100 text-green-700 border-green-200',
                  B: 'bg-blue-100 text-blue-700 border-blue-200',
                  C: 'bg-amber-100 text-amber-700 border-amber-200',
                  D: 'bg-red-100 text-red-600 border-red-200',
                }

                return (
                  <div key={s.id} className={`bg-white rounded-2xl border ${s.staff_active ? 'border-gray-100' : 'border-gray-100 opacity-70'} p-4`}>
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${s.staff_active ? 'bg-primary-50 text-primary-500' : 'bg-gray-100 text-gray-400'}`}>
                        {s.full_name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{s.full_name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            s.staff_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {s.staff_active ? 'Active' : 'Zimwa'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${gradeStyle[grade] ?? gradeStyle.D}`}>
                            Grade {grade}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{s.staff_title} · {s.phone}</p>
                        <p className="text-xs text-gray-400 truncate">{s.email}</p>
                        <p className="text-[10px] text-gray-300 mt-0.5">
                          Ameongezwa {timeAgo(s.created_at)} iliyopita
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
                      <div className="text-center">
                        <p className="font-bold text-gray-900">{s.activeLeads}</p>
                        <p className="text-[10px] text-gray-400">Active Leads</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-primary-500">{s.totalConverted}</p>
                        <p className="text-[10px] text-gray-400">Walisajili</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-bold ${convRate >= 12 ? 'text-green-600' : convRate >= 6 ? 'text-amber-600' : 'text-red-500'}`}>
                          {convRate}%
                        </p>
                        <p className="text-[10px] text-gray-400">Conversion</p>
                      </div>
                    </div>

                    {/* Capacity bar */}
                    <div className="mt-2 pt-2 border-t border-gray-50">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-gray-400">{s.activeLeads} / {s.max_leads_capacity} leads</span>
                        <span className={`font-medium ${textColor}`}>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => setPerformanceStaff(s)}
                        className="bg-purple-50 text-purple-700 text-xs py-2 rounded-xl font-medium border border-purple-100 col-span-2 flex items-center justify-center gap-1.5"
                      >
                        <i className="ti ti-chart-bar" aria-hidden="true" /> Angalia Utendaji
                      </button>
                      <button
                        onClick={() => setManagingPerms(s)}
                        className="bg-blue-50 text-blue-700 text-xs py-2 rounded-xl font-medium border border-blue-100 flex items-center justify-center gap-1"
                      >
                        <i className="ti ti-key" aria-hidden="true" /> Ruhusa
                      </button>
                      <button
                        onClick={() => setActivityStaff(s)}
                        className="border border-gray-200 text-gray-600 text-xs py-2 rounded-xl font-medium flex items-center justify-center gap-1"
                      >
                        <i className="ti ti-clipboard-list" aria-hidden="true" /> Shughuli
                      </button>
                      <button
                        onClick={() => setEditMember(s)}
                        className="border border-gray-200 text-gray-600 text-xs py-2 rounded-xl font-medium flex items-center justify-center gap-1"
                      >
                        <i className="ti ti-pencil" aria-hidden="true" /> Hariri
                      </button>
                      <button
                        onClick={() => toggleActive(s)}
                        className={`text-xs py-2 rounded-xl font-medium flex items-center justify-center gap-1 ${
                          s.staff_active
                            ? 'bg-orange-50 text-orange-600 border border-orange-200'
                            : 'bg-green-50 text-green-600 border border-green-200'
                        }`}
                      >
                        {s.staff_active
                          ? <><i className="ti ti-player-pause" aria-hidden="true" /> Zimwa</>
                          : <><i className="ti ti-player-play" aria-hidden="true" /> Washa</>
                        }
                      </button>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(s)}
                      className="mt-2 w-full text-xs text-red-400 hover:text-red-600 border border-dashed border-red-200 hover:border-red-400 rounded-xl px-3 py-1.5 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="ti ti-trash" aria-hidden="true" /> Futa Akaunti
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showAdd && (
        <AddStaffModal
          onClose={() => setShowAdd(false)}
          onCreated={(msg) => { setShowAdd(false); loadStaff(); showToast(msg) }}
        />
      )}
      {editMember && (
        <EditStaffModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={() => { setEditMember(null); loadStaff(); showToast('Maelezo yamehifadhiwa') }}
        />
      )}
      {managingPerms && (
        <PermissionManagerModal
          staff={managingPerms}
          onClose={() => setManagingPerms(null)}
          onSaved={() => setManagingPerms(null)}
        />
      )}
      {activityStaff && (
        <ActivityFeedModal staff={activityStaff} onClose={() => setActivityStaff(null)} />
      )}
      {performanceStaff && (
        <PerformanceModal staff={performanceStaff} onClose={() => setPerformanceStaff(null)} />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5">
            <div className="text-center mb-4">
              <i className="ti ti-alert-triangle text-red-500 text-4xl block mb-2" />
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
function AddStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (msg: string) => void
}) {
  const [name,         setName]         = useState('')
  const [phone,        setPhone]        = useState('255')
  const [email,        setEmail]        = useState('')
  const [title,        setTitle]        = useState('Sales Agent')
  const [capacity,     setCapacity]     = useState(500)
  const [roleTemplate, setRoleTemplate] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [warning,      setWarning]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setWarning('')

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

    if (data.warning) setWarning(data.warning)
    setTimeout(() => onCreated(data.message || `Akaunti ya ${name} imeundwa`), data.warning ? 2500 : 800)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <i className="ti ti-user-plus" aria-hidden="true" /> Ongeza Mfanyakazi Mpya
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
            <i className="ti ti-x" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl mb-3 flex items-start gap-2">
            <i className="ti ti-alert-circle flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {warning && (
          <div className="bg-amber-50 border border-amber-100 text-amber-700 text-sm px-3 py-2 rounded-xl mb-3">
            <i className="ti ti-alert-triangle" /> {warning}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Jina Kamili *</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Asha Mohammed"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Namba ya Simu * (255XXXXXXXXX)</label>
            <input
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="255712345678"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
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
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Cheo</label>
            <select
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              {TITLES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ukomo wa Leads</label>
            <input
              type="number" min={1} max={9999} step={50}
              value={capacity}
              onChange={e => setCapacity(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            <div className="flex gap-1.5 mt-1.5">
              {[100, 250, 500, 1000].map(n => (
                <button
                  key={n} type="button" onClick={() => setCapacity(n)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${
                    capacity === n ? 'bg-primary-500 text-white border-primary-500' : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Aina ya Kazi (Permissions za Awali)</label>
            <select
              value={roleTemplate}
              onChange={e => setRoleTemplate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">Bila ruhusa (weka baadaye)</option>
              <option value="sales_agent">Sales Agent — Leads tu</option>
              <option value="onboarding_specialist">Onboarding Specialist — Leads + Scraper</option>
              <option value="customer_support">Customer Support — WhatsApp + Violations</option>
              <option value="social_media_manager">Social Media Manager — Social + Spam</option>
              <option value="quality_control">Quality Control — Spam + Violations + Analytics</option>
              <option value="team_lead">Team Lead — Vyote</option>
            </select>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
            <i className="ti ti-mail flex-shrink-0 mt-0.5" />
            <span>Password ya muda itatengenezwa na kutumwa kwa <strong>email</strong>. Mfanyakazi atalazimishwa kuibadilisha mara ya kwanza ya kuingia.</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600"
            >
              Ghairi
            </button>
            <button
              type="submit"
              disabled={saving || !name || !phone || !email}
              className="btn-primary flex-1 py-2.5"
            >
              {saving ? <><i className="ti ti-loader-2 animate-spin" /> Inaunda…</> : 'Unda Akaunti'}
            </button>
          </div>
        </form>
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
    const res  = await fetch(`/api/v1/admin/staff/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, staffTitle: title, maxLeadsCapacity: capacity }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Imeshindwa kuhifadhi'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <i className="ti ti-pencil" /> Hariri {member.full_name}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><i className="ti ti-x" /></button>
        </div>

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Jina Kamili</label>
            <input required value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Cheo</label>
            <select value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30">
              {TITLES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Ukomo wa Leads</label>
            <input type="number" min={1} max={9999} step={50} value={capacity} onChange={e => setCapacity(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
            <div className="flex gap-1.5 mt-1.5">
              {[100, 250, 500, 1000].map(n => (
                <button key={n} type="button" onClick={() => setCapacity(n)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${capacity === n ? 'bg-primary-500 text-white border-primary-500' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600">Ghairi</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
              {saving ? 'Inahifadhi...' : 'Hifadhi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Activity Feed Modal ──────────────────────────────────────────────────────
type Activity = { id: string; action_type: string; resource_type: string | null; description: string; created_at: string }

function ActivityFeedModal({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    fetch(`/api/v1/admin/staff/${staff.id}/activity`)
      .then(r => r.json())
      .then(d => setActivities(d.activities ?? []))
      .finally(() => setLoading(false))
  }, [staff.id])

  const actionIcon: Record<string, string> = {
    lead_stage_update: 'target', whatsapp_takeover: 'message-circle',
    comment_moderated: 'ban', violation_resolved: 'scale', scraper_run: 'robot',
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-1.5">
              <i className="ti ti-clipboard-list" /> Shughuli za {staff.full_name}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Vitendo 50 vya hivi karibuni</p>
          </div>
          <button onClick={onClose} className="text-gray-400 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
            <i className="ti ti-x text-lg" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl mb-2" />
            ))
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <i className="ti ti-inbox text-3xl block mb-2" />
              <p className="text-sm">Hakuna shughuli bado</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50">
                  <i className={`ti ti-${actionIcon[a.action_type] ?? 'pin'} text-base flex-shrink-0 mt-0.5 text-gray-400`} />
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

// ─── Dalali Activity View ─────────────────────────────────────────────────────
function DalaliActivityView() {
  const [rows,       setRows]       = useState<DalaliRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [riskFilter, setRiskFilter] = useState('all')
  const [extending,  setExtending]  = useState<DalaliRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = riskFilter !== 'all' ? `?risk=${riskFilter}` : ''
    const res = await fetch(`/api/v1/admin/dalali/activity${qs}`)
    const data = await res.json()
    setRows(data.dalali ?? [])
    setLoading(false)
  }, [riskFilter])

  useEffect(() => { load() }, [load])

  const riskColor: Record<string, string> = {
    safe: 'bg-green-100 text-green-700', new: 'bg-blue-100 text-blue-700',
    at_risk: 'bg-amber-100 text-amber-700', critical: 'bg-orange-100 text-orange-700', overdue: 'bg-red-100 text-red-700',
  }
  const riskLabel: Record<string, string> = {
    safe: 'Salama', new: 'Mpya', at_risk: 'Hatarini', critical: 'Muhimu', overdue: 'Imekwisha',
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'at_risk', 'critical', 'overdue'] as const).map(r => (
          <button
            key={r} onClick={() => setRiskFilter(r)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              riskFilter === r ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200'
            }`}
          >
            {r === 'all' ? 'Wote' : riskLabel[r] ?? r}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <i className="ti ti-circle-check text-primary-500 text-4xl block mb-2" />
          <p className="font-semibold text-gray-700">Hakuna madalali wenye hatari</p>
          <p className="text-sm text-gray-400 mt-1">Madalali wote wamechapisha listings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{row.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${riskColor[row.risk_level] ?? 'bg-gray-100 text-gray-500'}`}>
                      {riskLabel[row.risk_level] ?? row.risk_level}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{row.phone} · {row.email}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                    <span><i className="ti ti-calendar" /> Siku {row.days_since_registration ?? 0} tangu usajili</span>
                    <span><i className="ti ti-home" /> Listings: {row.total_listings_ever}</span>
                    {row.days_before_deletion != null && (
                      <span className={row.days_before_deletion <= 7 ? 'text-red-600 font-semibold' : row.days_before_deletion <= 14 ? 'text-amber-600' : ''}>
                        <i className="ti ti-clock-hour-4" /> Siku {row.days_before_deletion} kabla ya kufutwa
                      </span>
                    )}
                  </div>
                  {row.listing_warnings_count > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">Onyo {row.listing_warnings_count} zimetumwa</p>
                  )}
                </div>
                <button
                  onClick={() => setExtending(row)}
                  className="flex-shrink-0 bg-primary-50 text-primary-500 text-xs px-3 py-2 rounded-xl font-medium whitespace-nowrap"
                >
                  <i className="ti ti-plus" /> Panulia
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {extending && (
        <ExtendDeadlineModal dalali={extending} onClose={() => setExtending(null)} onSaved={() => { setExtending(null); load() }} />
      )}
    </div>
  )
}

// ─── Extend Deadline Modal ────────────────────────────────────────────────────
function ExtendDeadlineModal({ dalali, onClose, onSaved }: { dalali: DalaliRow; onClose: () => void; onSaved: () => void }) {
  const [days,   setDays]   = useState(30)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res  = await fetch(`/api/v1/admin/dalali/${dalali.id}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days, reason }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Imeshindwa'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
          <i className="ti ti-clock-hour-4" /> Panulia Muda
        </h3>
        <p className="text-xs text-gray-500 mb-4">{dalali.name}</p>
        {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-xl mb-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Siku za Ziada</label>
            <div className="flex gap-2 mb-2">
              {[7, 14, 30, 60].map(d => (
                <button key={d} type="button" onClick={() => setDays(d)}
                  className={`flex-1 text-xs py-2 rounded-xl border ${days === d ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600'}`}>
                  +{d}
                </button>
              ))}
            </div>
            <input type="number" min={1} max={90} value={days} onChange={e => setDays(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Sababu (si lazima)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="mfano: dalali ana mkakati wa kutoa listing wiki ijayo"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600">Ghairi</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
              {saving ? 'Inahifadhi...' : 'Panulia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Performance Modal ────────────────────────────────────────────────────────
type PerfData = {
  period: number
  summary: {
    total_assigned: number; all_time_assigned: number; converted: number; lost: number
    contacted: number; conversion_rate: number; activity_count: number; avg_daily_activity: number
  }
  pipeline: { stage: string; label: string; count: number; pct: number }[]
  daily_activity: { date: string; count: number }[]
  team_avg_rate: number; vs_team: number; grade: string
}

const GRADE_STYLE: Record<string, string> = {
  A: 'bg-green-100 text-green-700 border-green-200',
  B: 'bg-blue-100 text-blue-700 border-blue-200',
  C: 'bg-amber-100 text-amber-700 border-amber-200',
  D: 'bg-red-100 text-red-600 border-red-200',
}
const STAGE_COLORS: Record<string, string> = {
  mpya: 'bg-gray-400', mawasiliano: 'bg-blue-400', anajisajili: 'bg-amber-400',
  ameweka_listing: 'bg-purple-400', amefanikiwa: 'bg-green-500', amepotea: 'bg-red-400',
}

function PerformanceModal({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const [period,  setPeriod]  = useState<7 | 30 | 90>(30)
  const [data,    setData]    = useState<PerfData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setData(null)
    fetch(`/api/v1/admin/staff/${staff.id}/performance?period=${period}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [staff.id, period])

  const maxActivity = data ? Math.max(...data.daily_activity.map(d => d.count), 1) : 1

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <i className="ti ti-chart-bar text-purple-500" /> Utendaji — {staff.full_name}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{staff.staff_title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-4 flex-shrink-0">
          {([7, 30, 90] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-all ${period === p ? 'bg-purple-500 text-white border-purple-500' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              {p === 7 ? 'Wiki' : p === 30 ? 'Mwezi' : 'Miezi 3'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Inapakia takwimu...</p>
            </div>
          ) : !data ? null : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 col-span-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-600 font-medium">Kiwango cha Ubadilishaji</p>
                    <p className="text-3xl font-bold text-purple-700 mt-0.5">{data.summary.conversion_rate}%</p>
                    <p className="text-[10px] text-purple-500 mt-1">
                      {data.summary.converted} kati ya {data.summary.total_assigned} (siku {period})
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black px-4 py-2 rounded-xl border ${GRADE_STYLE[data.grade] ?? GRADE_STYLE.D}`}>
                      {data.grade}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Timu: {data.team_avg_rate}%
                      <span className={`ml-1 font-medium ${data.vs_team >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ({data.vs_team >= 0 ? '+' : ''}{data.vs_team}%)
                      </span>
                    </p>
                  </div>
                </div>

                {[
                  { label: 'Leads (kipindi)', value: data.summary.total_assigned, icon: 'users',        color: 'text-blue-600 bg-blue-50' },
                  { label: 'Wamefanikiwa',   value: data.summary.converted,      icon: 'circle-check', color: 'text-green-600 bg-green-50' },
                  { label: 'Wamepotea',      value: data.summary.lost,           icon: 'circle-x',     color: 'text-red-500 bg-red-50' },
                  { label: 'Walipigiwa',     value: data.summary.contacted,      icon: 'phone',        color: 'text-amber-600 bg-amber-50' },
                  { label: 'Shughuli Zote',  value: data.summary.activity_count, icon: 'bolt',         color: 'text-purple-600 bg-purple-50' },
                  { label: 'Wastani/Siku',   value: data.summary.avg_daily_activity, icon: 'trending-up', color: 'text-indigo-600 bg-indigo-50' },
                ].map((kpi, i) => (
                  <div key={i} className={`${kpi.color} rounded-xl p-3`}>
                    <i className={`ti ti-${kpi.icon} text-lg`} />
                    <p className="text-xl font-bold mt-1">{kpi.value}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{kpi.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                  <i className="ti ti-filter" /> Hatua za Pipeline (Jumla)
                </p>
                <div className="space-y-2.5">
                  {data.pipeline.map(s => (
                    <div key={s.stage}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{s.label}</span>
                        <span className="text-gray-400">{s.count} ({s.pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${STAGE_COLORS[s.stage] ?? 'bg-gray-300'}`} style={{ width: `${Math.min(100, s.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                  <i className="ti ti-chart-histogram" /> Shughuli za Kila Siku
                </p>
                <div className="flex items-end gap-0.5 h-16 bg-gray-50 rounded-xl px-3 py-2">
                  {data.daily_activity.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                      <div className="w-full bg-purple-400 rounded-sm min-h-[2px] transition-all"
                        style={{ height: `${Math.round((d.count / maxActivity) * 100)}%` }} />
                      <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        {d.date.slice(5)}: {d.count}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-gray-300 mt-1 px-1">
                  <span>{data.daily_activity[0]?.date.slice(5)}</span>
                  <span>{data.daily_activity[Math.floor(data.daily_activity.length / 2)]?.date.slice(5)}</span>
                  <span>{data.daily_activity[data.daily_activity.length - 1]?.date.slice(5)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 flex items-center justify-between">
                <span><i className="ti ti-database" /> Leads zote za historia</span>
                <span className="font-bold text-gray-700">{data.summary.all_time_assigned}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Team Performance Leaderboard ─────────────────────────────────────────────
function TeamPerformanceView({ staff, onSelect }: { staff: StaffMember[]; onSelect: (s: StaffMember) => void }) {
  const [search, setSearch] = useState('')

  const ranked = useMemo(() => {
    const q = search.toLowerCase().trim()
    return [...staff]
      .map(s => {
        const total = s.activeLeads + s.totalConverted + s.totalLost
        const rate  = total > 0 ? Math.round((s.totalConverted / total) * 1000) / 10 : 0
        return { ...s, total, rate }
      })
      .filter(s => !q || s.full_name.toLowerCase().includes(q) || (s.staff_title ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.rate - a.rate)
  }, [staff, search])

  const maxConverted = Math.max(...ranked.map(s => s.totalConverted), 1)
  const gradeOf      = (rate: number) => rate >= 20 ? 'A' : rate >= 12 ? 'B' : rate >= 6 ? 'C' : 'D'
  const avgRate      = ranked.length > 0
    ? Math.round(ranked.reduce((a, s) => a + s.rate, 0) / ranked.length * 10) / 10
    : 0

  if (staff.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
        <i className="ti ti-chart-bar text-4xl text-gray-300 block mb-2" />
        <p className="font-semibold text-gray-600">Hakuna wafanyakazi bado</p>
        <p className="text-sm text-gray-400 mt-1">Ongeza wafanyakazi kwenye tab ya &quot;Wafanyakazi&quot;</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Team summary */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: 'Wastani wa Timu',  value: `${avgRate}%`,                                       icon: 'chart-bar',    color: 'text-purple-600 bg-purple-50' },
          { label: 'Jumla Walisajili', value: ranked.reduce((a, s) => a + s.totalConverted, 0),    icon: 'circle-check', color: 'text-green-600 bg-green-50' },
          { label: 'Bora Zaidi',       value: ranked[0]?.full_name.split(' ')[0] ?? '—',           icon: 'trophy',       color: 'text-amber-600 bg-amber-50' },
        ].map((s, i) => (
          <div key={i} className={`${s.color} rounded-xl p-2.5 text-center`}>
            <i className={`ti ti-${s.icon} text-lg`} />
            <p className="font-bold text-sm mt-0.5">{s.value}</p>
            <p className="text-[9px] opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tafuta mfanyakazi au cheo…"
          className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>

      {/* Ranked list */}
      {ranked.map((s, i) => {
        const grade = gradeOf(s.rate)
        return (
          <div key={s.id}
            className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => onSelect(s)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                i === 0 ? 'bg-amber-100 text-amber-700' :
                i === 1 ? 'bg-gray-100 text-gray-600'   :
                i === 2 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'
              }`}>
                {i === 0 ? <i className="ti ti-trophy text-sm" /> : i + 1}
              </div>
              <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center font-bold text-primary-500 flex-shrink-0">
                {s.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm truncate">{s.full_name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold flex-shrink-0 ${GRADE_STYLE[grade]}`}>{grade}</span>
                </div>
                <p className="text-[10px] text-gray-400">{s.staff_title}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900 text-sm">{s.rate}%</p>
                <p className="text-[10px] text-gray-400">{s.totalConverted}/{s.total}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-green-400 transition-all"
                  style={{ width: `${Math.round((s.totalConverted / maxConverted) * 100)}%` }} />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-right">
              <i className="ti ti-info-circle" /> Bonyeza kuona kwa undani
            </p>
          </div>
        )
      })}
    </div>
  )
}
