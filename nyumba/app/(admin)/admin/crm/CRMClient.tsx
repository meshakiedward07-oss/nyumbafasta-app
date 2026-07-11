'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { PIPELINE_STAGES, SOURCE_LABELS, type DalaliLead } from '@/lib/crm/constants'
import LeadDetailModal from './LeadDetailModal'

type Stats = {
  totalActive:       number
  byStage:           Record<string, number>
  conversionRate:    number
  followupsDueToday: number
  uncontacted:       number
}

export default function CRMClient() {
  const [view, setView]             = useState<'kanban' | 'list'>('kanban')
  const [leads, setLeads]           = useState<DalaliLead[]>([])
  const [stats, setStats]           = useState<Stats | null>(null)
  const [stage, setStage]           = useState('all')
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [selectedLead, setSelectedLead] = useState<DalaliLead | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (q = search) => {
    setLoading(true)
    const [leadsRes, statsRes] = await Promise.all([
      fetch(`/api/v1/crm/leads?stage=${stage}&search=${encodeURIComponent(q)}`).then(r => r.json()),
      fetch('/api/v1/crm/stats').then(r => r.json()),
    ])
    setLeads(leadsRes.leads || [])
    setStats(statsRes)
    setLoading(false)
  }, [stage, search])

  useEffect(() => { load() }, [load])

  function handleSearchChange(v: string) {
    setSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(v), 350)
  }

  async function handleStageMove(leadId: string, newStage: string) {
    await fetch(`/api/v1/crm/leads/${leadId}/stage`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ stage: newStage }),
    })
    load()
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Header ─────────────────────────────────── */}
      <div className="bg-white border-b px-4 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              <i className="ti ti-target" aria-hidden="true" /> CRM — Madalali Watarajiwa
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Fuatilia madalali kutoka mawasiliano ya kwanza hadi listing yao ya kwanza
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex bg-gray-100 p-0.5 rounded-lg">
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  view === 'kanban' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
                }`}
              >
                <i className="ti ti-layout-kanban" aria-hidden="true" /> Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  view === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
                }`}
              >
                <i className="ti ti-clipboard-list" aria-hidden="true" /> Orodha
              </button>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-primary-500 text-white text-xs px-3 py-2 rounded-xl font-medium"
            >
              + Lead Mpya
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-gray-800">{stats.totalActive}</p>
              <p className="text-xs text-gray-400">Leads Hai</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-amber-600">{stats.followupsDueToday}</p>
              <p className="text-xs text-gray-400">Follow-up Leo</p>
            </div>
            <div className="bg-red-50 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-red-500">{stats.uncontacted}</p>
              <p className="text-xs text-gray-400">Hawajaguswa</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2.5 text-center">
              <p className="text-xl font-bold text-green-600">{stats.conversionRate}%</p>
              <p className="text-xs text-gray-400">Conversion</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Tafuta jina, simu, mkoa..."
            className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Stage filter pills (list view) */}
        {view === 'list' && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
            <button
              onClick={() => setStage('all')}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                stage === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Zote ({stats?.totalActive ?? '—'})
            </button>
            {PIPELINE_STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => setStage(s.key)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  stage === s.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <><i className={`ti ti-${s.icon}`} aria-hidden="true" /> {s.label} ({stats?.byStage?.[s.key] ?? 0})</>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {view === 'kanban' ? (
          <KanbanView
            leads={leads}
            loading={loading}
            stats={stats}
            onLeadClick={setSelectedLead}
            onStageMove={handleStageMove}
          />
        ) : (
          <ListView
            leads={leads}
            loading={loading}
            onLeadClick={setSelectedLead}
          />
        )}
      </div>

      {/* ── Lead Detail Panel ───────────────────────── */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => load()}
        />
      )}

      {/* ── Add Lead Modal ──────────────────────────── */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── Kanban View ────────────────────────────────────────────────────────────────
function KanbanView({
  leads, loading, stats, onLeadClick, onStageMove,
}: {
  leads:       DalaliLead[]
  loading:     boolean
  stats:       Stats | null
  onLeadClick: (l: DalaliLead) => void
  onStageMove: (id: string, stage: string) => void
}) {
  const activeStages = PIPELINE_STAGES.filter(s => s.key !== 'amepotea')

  return (
    <div className="flex gap-3 h-full overflow-x-auto px-4 py-4">
      {activeStages.map(s => {
        const stageLeads = leads.filter(l => l.pipeline_stage === s.key)
        return (
          <div
            key={s.key}
            className="flex-shrink-0 w-[270px] flex flex-col"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              const leadId = e.dataTransfer.getData('leadId')
              if (leadId) onStageMove(leadId, s.key)
            }}
          >
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${s.bgClass}`}>
              <span className={`text-xs font-semibold ${s.textClass}`}>
                <><i className={`ti ti-${s.icon}`} aria-hidden="true" /> {s.label}</>
              </span>
              <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center
                bg-white bg-opacity-70 ${s.textClass}`}>
                {stats?.byStage?.[s.key] ?? stageLeads.length}
              </span>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto min-h-[80px] pb-4">
              {loading
                ? [0,1].map(i => <div key={i} className="h-20 bg-white animate-pulse rounded-xl border" />)
                : stageLeads.length === 0
                  ? (
                    <div className="text-center py-6 text-gray-300 text-xs border-2 border-dashed rounded-xl">
                      Hakuna leads
                    </div>
                  )
                  : stageLeads.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => onLeadClick(lead)}
                      onDragStart={e => e.dataTransfer.setData('leadId', lead.id)}
                    />
                  ))
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Lead Card ──────────────────────────────────────────────────────────────────
function LeadCard({
  lead, onClick, onDragStart,
}: {
  lead:        DalaliLead
  onClick:     () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const isFollowupDue = lead.next_followup_at && new Date(lead.next_followup_at) <= new Date()
  const neverContacted = !lead.last_contacted_at
  const daysSince = lead.last_contacted_at
    ? Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / 86400000)
    : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`bg-white border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all select-none ${
        isFollowupDue  ? 'border-amber-300'
        : neverContacted ? 'border-red-200'
        : 'border-gray-100'
      }`}
    >
      {isFollowupDue && (
        <p className="text-xs text-amber-600 font-medium mb-1.5 flex items-center gap-1"><i className="ti ti-clock-hour-4" aria-hidden="true" />Follow-up inahitajika</p>
      )}
      {neverContacted && (
        <p className="text-xs text-red-500 mb-1.5 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" />Hajaguswa bado</p>
      )}

      <p className="font-semibold text-sm text-gray-800 line-clamp-1">
        {lead.business_name || '—'}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{lead.phone || '—'}</p>
      {lead.region && (
        <p className="text-xs text-gray-400 flex items-center gap-1"><i className="ti ti-map-pin" aria-hidden="true" />{lead.region}</p>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-400 truncate">
          {SOURCE_LABELS[lead.source || '']?.split(' ')[0] || lead.source || '—'}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(lead.contact_attempts ?? 0) > 0 && (
            <span className="text-xs text-gray-400">
              <i className="ti ti-phone" aria-hidden="true" />{lead.contact_attempts}x
            </span>
          )}
          {daysSince !== null && (
            <span className={`text-xs ${
              daysSince > 7 ? 'text-red-400'
              : daysSince > 3 ? 'text-amber-500'
              : 'text-gray-400'
            }`}>
              {daysSince === 0 ? 'Leo' : `${daysSince}d`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── List View ──────────────────────────────────────────────────────────────────
function ListView({
  leads, loading, onLeadClick,
}: {
  leads:       DalaliLead[]
  loading:     boolean
  onLeadClick: (l: DalaliLead) => void
}) {
  return (
    <div className="px-4 py-4">
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 font-medium">
              <th className="text-left px-4 py-3">Dalali Mtarajiwa</th>
              <th className="text-left px-4 py-3">Stage</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Chanzo</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Mawasiliano</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Staff</th>
              <th className="text-left px-4 py-3">Follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 animate-pulse rounded" />
                  </td>
                </tr>
              ))
              : leads.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                      Hakuna leads — badilisha filter au ongeza lead mpya
                    </td>
                  </tr>
                )
                : leads.map(lead => {
                  const s = PIPELINE_STAGES.find(x => x.key === lead.pipeline_stage)
                  const isOverdue = lead.next_followup_at && new Date(lead.next_followup_at) <= new Date()
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onLeadClick(lead)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">
                          {lead.business_name || '—'}
                        </p>
                        <p className="text-xs text-gray-400">{lead.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s?.badgeClass || ''}`}>
                          <>{s && <i className={`ti ti-${s.icon}`} aria-hidden="true" />} {s?.label}</>
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-500">
                          {SOURCE_LABELS[lead.source || ''] || lead.source || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-500">
                          {lead.contact_attempts ?? 0}x
                          {lead.last_contacted_at && (
                            <span className="ml-1 text-gray-400">
                              · {new Date(lead.last_contacted_at).toLocaleDateString('sw-TZ')}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">
                          {(lead.assigned_staff as { full_name?: string } | null)?.full_name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.next_followup_at ? (
                          <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                            {isOverdue ? <><i className="ti ti-alert-triangle" aria-hidden="true" />{' '}</> : null}
                            {new Date(lead.next_followup_at).toLocaleDateString('sw-TZ')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Add Lead Modal ─────────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    business_name: '',
    phone:         '',
    whatsapp:      '',
    region:        '',
    notes:         '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function submit() {
    if (!form.business_name.trim()) { setError('Jina linahitajika'); return }
    setSaving(true)
    const res = await fetch('/api/v1/crm/leads', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Hitilafu'); return }
    onAdded()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-1"><i className="ti ti-plus" aria-hidden="true" />Ongeza Lead Mpya</h2>
          <button aria-label="Funga" onClick={onClose} className="text-gray-400 text-xl"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-3 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
        )}

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Jina la dalali / biashara *"
            value={form.business_name}
            onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500"
          />
          <input
            type="tel"
            placeholder="Nambari ya simu (255...)"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500"
          />
          <input
            type="tel"
            placeholder="WhatsApp (kama tofauti na simu)"
            value={form.whatsapp}
            onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500"
          />
          <input
            type="text"
            placeholder="Mkoa / Eneo (mfano: Dar es Salaam)"
            value={form.region}
            onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500"
          />
          <textarea
            placeholder="Maelezo (hiari)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 resize-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={saving || !form.business_name.trim()}
          className="btn-primary w-full mt-4 py-3"
        >
          {saving ? 'Inaongeza...' : 'Ongeza Lead'}
        </button>
      </div>
    </div>
  )
}
