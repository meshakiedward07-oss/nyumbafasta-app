'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'

type Lead = {
  id: string
  business_name: string
  phone: string | null
  email: string | null
  region: string | null
  source: string
  source_url: string | null
  website_url: string | null
  facebook_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  whatsapp: string | null
  ai_score: number
  ai_notes: string | null
  status: string
  notes: string | null
  created_at: string
}

const REGIONS = [
  'Dar es Salaam', 'Arusha', 'Mwanza',
  'Dodoma', 'Zanzibar', 'Mbeya',
  'Tanga', 'Morogoro', 'Kilimanjaro'
]

const SOURCES = [
  { id: 'google_maps',      label: 'Google Maps',      emoji: '🗺️' },
  { id: 'google_business',  label: 'Google Business',  emoji: '🏢' },
  { id: 'facebook_groups',  label: 'FB Groups',        emoji: '👥' },
  { id: 'facebook_pages',   label: 'FB Pages',         emoji: '📄' },
  { id: 'instagram',        label: 'Instagram',        emoji: '📸' },
  { id: 'tiktok',           label: 'TikTok',           emoji: '🎵' },
  { id: 'manual',           label: 'Manual',           emoji: '✍️' },
]

const STATUSES = [
  { id: 'new',       label: 'Mpya',      color: 'bg-blue-100 text-blue-700' },
  { id: 'contacted', label: 'Amepigiwa', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'interested',label: 'Anapenda',  color: 'bg-orange-100 text-orange-700' },
  { id: 'converted', label: 'Amesajili', color: 'bg-green-100 text-green-700' },
  { id: 'rejected',  label: 'Amekataa',  color: 'bg-red-100 text-red-700' },
]

export default function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [filterRegion, setFilterRegion] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const [stats, setStats] = useState({
    total: 0, new_today: 0, contacted: 0, converted: 0
  })

  const [showRunModal, setShowRunModal] = useState(false)
  const [runRegion, setRunRegion] = useState('Dar es Salaam')
  const [runSources, setRunSources] = useState<string[]>(['google_maps'])
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [newLead, setNewLead] = useState({
    business_name: '', phone: '', email: '',
    region: 'Dar es Salaam', notes: ''
  })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        ...(filterRegion && { region: filterRegion }),
        ...(filterSource && { source: filterSource }),
        ...(filterStatus && { status: filterStatus }),
        ...(search && { search })
      })
      const res = await fetch(`/api/v1/agent/leads?${params}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, filterRegion, filterSource, filterStatus, search])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/agent/leads/stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
    fetchStats()
  }, [fetchLeads, fetchStats])

  async function handleRunAgent() {
    if (runSources.length === 0) { alert('Chagua angalau source moja'); return }
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/v1/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: runRegion, sources: runSources })
      })
      const data = await res.json()
      setRunResult(data)
    } catch (err: any) {
      setRunResult({ error: err.message })
    } finally {
      setRunning(false)
    }
  }

  async function handleStatusChange(leadId: string, newStatus: string) {
    try {
      await fetch('/api/v1/agent/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus })
      })
      fetchLeads()
    } catch (err) { console.error(err) }
  }

  async function handleAddManualLead() {
    try {
      const res = await fetch('/api/v1/agent/leads/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead)
      })
      if (res.ok) {
        setShowAddModal(false)
        setNewLead({ business_name: '', phone: '', email: '', region: 'Dar es Salaam', notes: '' })
        fetchLeads()
        fetchStats()
      }
    } catch (err) { console.error(err) }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-500 bg-gray-100'
  }

  function getStatusStyle(status: string) {
    return STATUSES.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-600'
  }

  function getSourceEmoji(source: string) {
    return SOURCES.find(s => s.id === source)?.emoji || '📌'
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Leo'
    if (days === 1) return 'Jana'
    return `Siku ${days}`
  }

  const waMessage = (name: string) =>
    encodeURIComponent(
      `Habari ${name}! Mimi ni kutoka NyumbaFasta Tanzania — platform ya madalali wa nyumba. Tungependa kukualika ujisajili bure. Je, una dakika kuzungumza?`
    )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Header */}
      <header className="bg-[#1D9E75] sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">🤖 Leads za Madalali</h1>
            <p className="text-green-100 text-xs">Jumla: {total} leads</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white/20 text-white text-xs px-3 py-2 rounded-lg font-medium"
            >
              ➕ Ongeza
            </button>
            <button
              onClick={() => setShowRunModal(true)}
              className="bg-white text-[#1D9E75] text-xs px-3 py-2 rounded-lg font-bold"
            >
              🤖 Run Agent
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3">
        {[
          { label: 'Jumla',      value: stats.total,     emoji: '📊', color: 'bg-blue-50 text-blue-700' },
          { label: 'Leo',        value: stats.new_today,  emoji: '🆕', color: 'bg-green-50 text-green-700' },
          { label: 'Walipigiwa', value: stats.contacted,  emoji: '📞', color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Walisajili', value: stats.converted,  emoji: '✅', color: 'bg-purple-50 text-purple-700' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.color} rounded-xl p-2 text-center`}>
            <div className="text-lg">{stat.emoji}</div>
            <div className="font-bold text-lg leading-none">{stat.value}</div>
            <div className="text-xs opacity-70">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-4 space-y-2 mb-3">
        <input
          type="text"
          placeholder="🔍 Tafuta jina au simu..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
        />
        <div className="flex gap-2">
          <select
            value={filterRegion}
            onChange={e => { setFilterRegion(e.target.value); setPage(1) }}
            className="flex-1 text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">🗺️ Mikoa Yote</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filterSource}
            onChange={e => { setFilterSource(e.target.value); setPage(1) }}
            className="flex-1 text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">📡 Sources Zote</option>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="flex-1 text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">📋 Status Zote</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Leads List */}
      <div className="px-4 space-y-3">

        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />
        ))}

        {!loading && leads.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🤖</div>
            <p className="font-semibold text-gray-700">Hakuna leads bado</p>
            <p className="text-gray-400 text-sm mt-1">Bonyeza &quot;Run Agent&quot; kupata leads mpya</p>
            <button
              onClick={() => setShowRunModal(true)}
              className="mt-4 bg-[#1D9E75] text-white px-6 py-3 rounded-xl text-sm font-semibold"
            >
              🤖 Run Agent Sasa
            </button>
          </div>
        )}

        {!loading && leads.map(lead => (
          <div
            key={lead.id}
            className="bg-white rounded-2xl border border-gray-100 p-4
              cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedLead(lead)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{getSourceEmoji(lead.source)}</span>
                  <p className="font-semibold text-gray-900 text-sm">{lead.business_name}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {lead.region && (
                    <span className="text-xs text-gray-400">📍 {lead.region}</span>
                  )}
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-600"
                    >
                      📞 {lead.phone}
                    </a>
                  )}
                </div>
              </div>
              <div className={`px-2 py-1 rounded-lg text-xs font-bold ${getScoreColor(lead.ai_score)}`}>
                {lead.ai_score}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <select
                value={lead.status}
                onClick={e => e.stopPropagation()}
                onChange={e => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value) }}
                className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer
                  ${getStatusStyle(lead.status)}`}
              >
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>

              <div className="flex items-center gap-2">
                {(lead.whatsapp || lead.phone) && (
                  <a
                    href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Habari! Mimi ni kutoka NyumbaFasta Tanzania. Tungependa kukuomba ujisajili kwenye platform yetu ya madalali wa nyumba. Je, una dakika kuzungumza?')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="bg-[#25D366] text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                  >
                    💬 WA
                  </a>
                )}
                <span className="text-xs text-gray-400">{timeAgo(lead.created_at)}</span>
              </div>
            </div>

            {lead.ai_notes && (
              <p className="text-xs text-gray-400 mt-2 line-clamp-1">🤖 {lead.ai_notes}</p>
            )}
          </div>
        ))}

        {/* Pagination */}
        {!loading && total > 50 && (
          <div className="flex justify-center gap-3 py-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm disabled:opacity-50"
            >
              ← Iliyopita
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Ukurasa {page} / {Math.ceil(total / 50)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / 50)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm disabled:opacity-50"
            >
              Inayofuata →
            </button>
          </div>
        )}
      </div>

      {/* ── Run Agent Modal ── */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">🤖 Endesha Agent</h3>
              <button onClick={() => { setShowRunModal(false); setRunResult(null) }}
                className="text-gray-400 text-xl">✕</button>
            </div>

            {!runResult ? (
              <>
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 block mb-2">📍 Chagua Mkoa</label>
                  <select
                    value={runRegion}
                    onChange={e => setRunRegion(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  >
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="mb-5">
                  <label className="text-sm font-medium text-gray-700 block mb-2">📡 Chagua Sources</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCES.filter(s => s.id !== 'manual').map(source => (
                      <label
                        key={source.id}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all
                          ${runSources.includes(source.id)
                            ? 'border-[#1D9E75] bg-green-50'
                            : 'border-gray-200 bg-white'}`}
                      >
                        <input
                          type="checkbox"
                          checked={runSources.includes(source.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setRunSources(prev => [...prev, source.id])
                            } else {
                              setRunSources(prev => prev.filter(s => s !== source.id))
                            }
                          }}
                          className="hidden"
                        />
                        <span className="text-lg">{source.emoji}</span>
                        <span className="text-xs font-medium text-gray-700">{source.label}</span>
                        {runSources.includes(source.id) && (
                          <span className="ml-auto text-[#1D9E75] text-sm">✓</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-blue-700">
                  ℹ️ Agent itaanza kutafuta madalali kwenye {runRegion}. Matokeo yataonekana baada ya dakika 5-15.
                </div>

                <button
                  onClick={handleRunAgent}
                  disabled={running || runSources.length === 0}
                  className="w-full bg-[#1D9E75] text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50"
                >
                  {running ? '⏳ Inaanzisha...' : `🚀 Anza Kutafuta — ${runRegion}`}
                </button>
              </>
            ) : (
              <div>
                {runResult.error ? (
                  <div className="bg-red-50 rounded-xl p-4 text-red-700">
                    ❌ Kosa: {runResult.error}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="font-bold text-green-700 mb-2">✅ Agent Imeanzishwa!</p>
                      <p className="text-green-600 text-sm">Inatafuta madalali kwenye {runResult.region}...</p>
                    </div>
                    <div className="space-y-2">
                      {runResult.runs?.map((run: any, i: number) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-xl p-3
                          flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {getSourceEmoji(run.source)} {run.source}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full
                            ${run.status === 'FAILED'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-green-100 text-green-600'}`}>
                            {run.status === 'FAILED' ? '❌ Failed' : '✅ Running'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-gray-400 text-xs text-center">
                      Leads zitaonekana hapa baada ya dakika 5-15. Refresh page kuona matokeo.
                    </p>
                    <button
                      onClick={() => { setShowRunModal(false); setRunResult(null); fetchLeads(); fetchStats() }}
                      className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-semibold"
                    >
                      Sawa, Nisubiri Matokeo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lead Detail Panel ── */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                {getSourceEmoji(selectedLead.source)} {selectedLead.business_name}
              </h3>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="space-y-3">
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold
                ${getScoreColor(selectedLead.ai_score)}`}>
                🤖 AI Score: {selectedLead.ai_score}/100
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {selectedLead.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">📞 Simu</span>
                    <a href={`tel:${selectedLead.phone}`} className="text-sm font-medium text-blue-600">
                      {selectedLead.phone}
                    </a>
                  </div>
                )}
                {selectedLead.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">✉️ Email</span>
                    <a href={`mailto:${selectedLead.email}`} className="text-sm font-medium text-blue-600">
                      {selectedLead.email}
                    </a>
                  </div>
                )}
                {selectedLead.region && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">📍 Mkoa</span>
                    <span className="text-sm font-medium">{selectedLead.region}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">📡 Source</span>
                  <span className="text-sm font-medium">
                    {getSourceEmoji(selectedLead.source)} {selectedLead.source}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {selectedLead.website_url && (
                  <a href={selectedLead.website_url} target="_blank" rel="noopener noreferrer"
                    className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-xl text-center font-medium">
                    🌐 Website
                  </a>
                )}
                {selectedLead.facebook_url && (
                  <a href={selectedLead.facebook_url} target="_blank" rel="noopener noreferrer"
                    className="bg-blue-600 text-white text-xs px-3 py-2 rounded-xl text-center font-medium">
                    📘 Facebook
                  </a>
                )}
                {selectedLead.instagram_url && (
                  <a href={selectedLead.instagram_url} target="_blank" rel="noopener noreferrer"
                    className="bg-pink-500 text-white text-xs px-3 py-2 rounded-xl text-center font-medium">
                    📸 Instagram
                  </a>
                )}
                {selectedLead.tiktok_url && (
                  <a href={selectedLead.tiktok_url} target="_blank" rel="noopener noreferrer"
                    className="bg-black text-white text-xs px-3 py-2 rounded-xl text-center font-medium">
                    🎵 TikTok
                  </a>
                )}
                {selectedLead.source_url && (
                  <a href={selectedLead.source_url} target="_blank" rel="noopener noreferrer"
                    className="bg-gray-100 text-gray-700 text-xs px-3 py-2 rounded-xl text-center font-medium">
                    🔗 Source
                  </a>
                )}
              </div>

              {selectedLead.ai_notes && (
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-purple-700 mb-1">🤖 Claude Analysis:</p>
                  <p className="text-xs text-purple-600">{selectedLead.ai_notes}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">📋 Badilisha Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        handleStatusChange(selectedLead.id, s.id)
                        setSelectedLead({ ...selectedLead, status: s.id })
                      }}
                      className={`py-2 rounded-xl text-xs font-medium transition-all ${s.color}
                        ${selectedLead.status === s.id ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {(selectedLead.whatsapp || selectedLead.phone) && (
                <a
                  href={`https://wa.me/${(selectedLead.whatsapp || selectedLead.phone)?.replace(/[^0-9]/g, '')}?text=${waMessage(selectedLead.business_name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-[#25D366] text-white py-4 rounded-2xl
                    font-bold text-center text-base"
                >
                  💬 Wasiliana WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Manual Lead Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">➕ Ongeza Lead Manually</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <input
                type="text" placeholder="Jina la biashara *"
                value={newLead.business_name}
                onChange={e => setNewLead({ ...newLead, business_name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
              />
              <input
                type="tel" placeholder="Nambari ya simu (+255...)"
                value={newLead.phone}
                onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
              />
              <input
                type="email" placeholder="Email (optional)"
                value={newLead.email}
                onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
              />
              <select
                value={newLead.region}
                onChange={e => setNewLead({ ...newLead, region: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea
                placeholder="Maelezo (optional)"
                value={newLead.notes}
                onChange={e => setNewLead({ ...newLead, notes: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                  focus:outline-none resize-none"
              />
              <button
                onClick={handleAddManualLead}
                disabled={!newLead.business_name}
                className="w-full bg-[#1D9E75] text-white py-4 rounded-2xl font-bold disabled:opacity-50"
              >
                ➕ Ongeza Lead
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
