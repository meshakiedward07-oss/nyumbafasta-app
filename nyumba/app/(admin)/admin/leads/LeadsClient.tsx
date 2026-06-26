'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { TANZANIA_REGIONS } from '@/lib/agent/regions'

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

const REGIONS = TANZANIA_REGIONS

const SOURCES = [
  { id: 'google_maps',      label: 'Google Maps',      emoji: '🗺️' },
  { id: 'google_business',  label: 'Google (Kiswahili)', emoji: '🏢' },
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

  const [stats, setStats] = useState<{
    total: number
    new_today: number
    contacted: number
    converted: number
    by_region: { region: string; count: number }[]
  }>({
    total: 0, new_today: 0, contacted: 0, converted: 0, by_region: []
  })

  const [showRunModal, setShowRunModal] = useState(false)
  const [runRegion, setRunRegion] = useState('Dar es Salaam')
  const [runSources, setRunSources] = useState<string[]>(['google_maps'])
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)
  const [runError, setRunError] = useState('')

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [newLead, setNewLead] = useState({
    business_name: '', phone: '', email: '',
    region: 'Dar es Salaam', notes: ''
  })

  const [lastRun, setLastRun] = useState<string | null>(null)
  const [leadsToday, setLeadsToday] = useState(0)

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

  useEffect(() => {
    fetch('/api/v1/agent/last-run')
      .then(r => r.json())
      .then(data => {
        setLastRun(data.last_run)
        setLeadsToday(data.leads_today)
      })
      .catch(() => {})
  }, [])

  async function handleRunAgent() {
    if (runSources.length === 0) { setRunError('Chagua angalau source moja'); return }
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/v1/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: runRegion, sources: runSources })
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        setRunResult({ error: `Server error (${res.status}): ${text.slice(0, 300)}` })
        return
      }
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

      {/* ════════════════════════════════════════
          DESKTOP VIEW
      ════════════════════════════════════════ */}
      <div className="hidden lg:block p-6">

        {/* Desktop header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🤖 Leads za Madalali</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Jumla: {total} leads
              {lastRun && ` · Mwisho: ${timeAgo(lastRun)} · Leo +${leadsToday}`}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 bg-white"
            >
              ➕ Ongeza Lead
            </button>
            <button
              onClick={() => setShowRunModal(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600"
            >
              🤖 Run Agent
            </button>
          </div>
        </div>

        {/* Desktop stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Jumla Leads',  value: stats.total,     emoji: '📊', color: 'bg-blue-50 border-blue-200 text-blue-700' },
            { label: 'Leo',          value: stats.new_today,  emoji: '🆕', color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Walipigiwa',   value: stats.contacted,  emoji: '📞', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: 'Walisajili',   value: stats.converted,  emoji: '✅', color: 'bg-purple-50 border-purple-200 text-purple-700' },
          ].map((s, i) => (
            <div key={i} className={`${s.color} border rounded-2xl p-4`}>
              <div className="text-2xl mb-2">{s.emoji}</div>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm mt-1 opacity-70">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Desktop filters */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="🔍 Tafuta jina au simu..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
              focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none min-w-44">
            <option value="">🗺️ Mikoa Yote</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none min-w-44">
            <option value="">📡 Sources Zote</option>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none min-w-36">
            <option value="">📋 Status Zote</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* Desktop table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Biashara', 'Simu', 'Mkoa', 'Source', 'Score', 'Status', 'Tarehe', 'Hatua'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : leads.map(lead => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{getSourceEmoji(lead.source)}</span>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{lead.business_name}</p>
                        {lead.email && <p className="text-xs text-gray-400">{lead.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                      className="text-sm text-blue-600 hover:underline">
                      {lead.phone || '—'}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">📍 {lead.region || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{getSourceEmoji(lead.source)} {lead.source?.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getScoreColor(lead.ai_score)}`}>
                      {lead.ai_score}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value) }}
                      className={`text-xs px-2 py-1.5 rounded-lg border-0 font-medium cursor-pointer ${getStatusStyle(lead.status)}`}
                    >
                      {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">{timeAgo(lead.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(lead.whatsapp || lead.phone) && (
                      <a
                        href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Habari! Mimi ni kutoka NyumbaFasta Tanzania. Tungependa kukuomba ujisajili kwenye platform yetu ya madalali wa nyumba. Je, una dakika kuzungumza?')}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="bg-[#25D366] text-white text-xs px-2.5 py-1.5 rounded-lg font-medium hover:bg-green-600"
                      >
                        💬 WA
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {leads.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">🤖</div>
              <p className="font-semibold text-gray-700">Hakuna leads bado</p>
              <p className="text-gray-400 text-sm mt-1">Bonyeza &quot;Run Agent&quot; kupata leads mpya</p>
              <button onClick={() => setShowRunModal(true)}
                className="mt-4 bg-primary-500 text-white px-6 py-3 rounded-xl text-sm font-semibold">
                🤖 Run Agent Sasa
              </button>
            </div>
          )}
        </div>

        {/* Desktop pagination */}
        {!loading && total > 50 && (
          <div className="flex justify-center gap-3 py-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm disabled:opacity-50">
              ← Iliyopita
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Ukurasa {page} / {Math.ceil(total / 50)}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm disabled:opacity-50">
              Inayofuata →
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          MOBILE VIEW
      ════════════════════════════════════════ */}
      <div className="lg:hidden">

      {/* Header */}
      <header className="bg-primary-500 sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">🤖 Leads za Madalali</h1>
            <p className="text-green-100 text-xs">Jumla: {total} leads</p>
            {lastRun && (
              <p className="text-green-100 text-xs">
                🕐 Mwisho: {timeAgo(lastRun)} · Leo: +{leadsToday}
              </p>
            )}
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
              className="bg-white text-primary-500 text-xs px-3 py-2 rounded-lg font-bold"
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

      {/* Regional Stats */}
      {stats.by_region && stats.by_region.length > 0 && (
        <div className="px-4 mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            📊 Leads kwa Mkoa
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {stats.by_region.slice(0, 10).map((item, i) => (
              <div
                key={item.region}
                className="flex items-center justify-between px-4 py-2.5
                  border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50"
                onClick={() => { setFilterRegion(item.region); setPage(1) }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-700">{item.region}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-primary-500 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(100,
                          (item.count / (stats.by_region[0]?.count || 1)) * 100
                        )}%`
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-600 w-8 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 space-y-2 mb-3">
        <input
          type="text"
          placeholder="🔍 Tafuta jina au simu..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="mt-4 bg-primary-500 text-white px-6 py-3 rounded-xl text-sm font-semibold"
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

      </div> {/* end lg:hidden mobile view */}

      {/* ── Run Agent Modal ── */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">🤖 Endesha Agent</h3>
              <button onClick={() => { setShowRunModal(false); setRunResult(null) }}
                aria-label="Funga" className="text-gray-400 text-xl">✕</button>
            </div>

            {running ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent
                  rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-gray-700">Inatafuta madalali...</p>
                <p className="text-sm text-gray-400 mt-1">
                  Inaweza kuchukua dakika 5–15. Tafadhali subiri.
                </p>
                <p className="text-xs text-gray-300 mt-2">
                  📍 {runRegion} · Sources: {runSources.length}
                </p>
              </div>
            ) : !runResult ? (
              <>
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 block mb-2">📍 Chagua Mkoa</label>
                  <select
                    value={runRegion}
                    onChange={e => setRunRegion(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                            ? 'border-primary-500 bg-green-50'
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
                          <span className="ml-auto text-primary-500 text-sm">✓</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-blue-700">
                  ℹ️ Agent itaanza kutafuta madalali kwenye {runRegion}. Matokeo yataonekana baada ya dakika 5-15.
                </div>

                {runError && (
                  <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                    <span>⚠️</span> {runError}
                  </p>
                )}

                <button
                  onClick={() => { setRunError(''); handleRunAgent() }}
                  disabled={running || runSources.length === 0}
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50"
                >
                  {`🚀 Anza Kutafuta — ${runRegion}`}
                </button>
              </>
            ) : (
              <div>
                {runResult.error ? (
                  <div className="space-y-3">
                    <div className="bg-red-50 rounded-xl p-4 text-red-700">
                      <p className="font-bold mb-1">❌ Kosa Limetokea</p>
                      <p className="text-sm">
                        {typeof runResult.error === 'string'
                          ? runResult.error
                          : (runResult.error as any)?.message
                            ?? JSON.stringify(runResult.error)}
                      </p>
                    </div>
                    <button
                      onClick={() => setRunResult(null)}
                      className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-semibold"
                    >
                      ← Rudi
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Summary */}
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="font-bold text-green-700 mb-1">✅ Imekamilika!</p>
                      <p className="text-green-600 text-sm">
                        Leads mpya: <span className="font-bold text-green-800">
                          {(runResult.runs ?? []).reduce((sum: number, r: any) => sum + (Number(r.saved) || 0), 0)}
                        </span> · Mkoa: {String(runResult.region ?? '')}
                      </p>
                    </div>
                    {/* Per-source results */}
                    <div className="space-y-2">
                      {(runResult.runs ?? []).map((run: any, i: number) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-xl p-3
                          flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {getSourceEmoji(String(run.source ?? ''))} {String(run.source ?? '')}
                          </span>
                          <div className="flex items-center gap-2">
                            {run.status !== 'FAILED' && (
                              <span className="text-xs font-bold text-gray-600">
                                +{Number(run.saved) || 0} leads
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full
                              ${run.status === 'FAILED'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-green-100 text-green-600'}`}>
                              {run.status === 'FAILED' ? '❌ Imeshindwa' : '✅ Imefanikiwa'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {runResult.errors?.length > 0 && (
                      <div className="bg-yellow-50 rounded-xl p-3">
                        {runResult.errors.map((e: any, i: number) => (
                          <p key={i} className="text-xs text-yellow-700">
                            ⚠️ {String(e.source ?? '')}: {
                              typeof e.error === 'string'
                                ? e.error
                                : (e.error as any)?.message ?? JSON.stringify(e.error)
                            }
                          </p>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setShowRunModal(false)
                        setRunResult(null)
                        fetchLeads()
                        fetchStats()
                      }}
                      className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold"
                    >
                      Ona Leads Mpya →
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
              <button onClick={() => setSelectedLead(null)} aria-label="Funga" className="text-gray-400 text-xl">✕</button>
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
              <button onClick={() => setShowAddModal(false)} aria-label="Funga" className="text-gray-400 text-xl">✕</button>
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
                className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold disabled:opacity-50"
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
