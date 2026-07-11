'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { TANZANIA_REGIONS } from '@/lib/agent/regions'
import { PlatformLogo } from '@/components/shared/PlatformLogo'

const BRAND_PLATFORMS = new Set(['whatsapp', 'instagram', 'facebook', 'tiktok'])

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
  { id: 'google_maps',      label: 'Google Maps',      icon: 'map' },
  { id: 'google_business',  label: 'Google (Kiswahili)', icon: 'building' },
  { id: 'facebook_groups',  label: 'FB Groups',        icon: 'brand-facebook' },
  { id: 'facebook_pages',   label: 'FB Pages',         icon: 'brand-facebook' },
  { id: 'instagram',        label: 'Instagram',        icon: 'brand-instagram' },
  { id: 'tiktok',           label: 'TikTok',           icon: 'brand-tiktok' },
  { id: 'manual',           label: 'Manual',           icon: 'pencil' },
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

  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    duplicates_file: number
    duplicates_db: number
    skipped: number
    errors: { row: number; reason: string }[]
  } | null>(null)
  const [importError, setImportError] = useState('')

  // ── Broadcast state ───────────────────────────────────────────────────────
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastMessage, setBroadcastMessage]     = useState('')
  const [broadcastTone, setBroadcastTone]           = useState('personal')
  const [broadcastRegion, setBroadcastRegion]       = useState('')
  const [broadcastStatus, setBroadcastStatus]       = useState('')
  const [broadcastCount, setBroadcastCount]         = useState<number | null>(null)
  const [broadcasting, setBroadcasting]             = useState(false)
  const [broadcastResult, setBroadcastResult]       = useState<{
    total: number; sent: number; failed: number
  } | null>(null)
  const [broadcastError, setBroadcastError]         = useState('')

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
      const res = await fetch('/api/v1/agent/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, status: newStatus })
      })
      if (res.ok) fetchLeads()
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

  async function handleImport() {
    if (!importFile) return
    setImporting(true)
    setImportError('')
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await fetch('/api/v1/agent/leads/bulk', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error || 'Imeshindwa kuingiza leads')
      } else {
        setImportResult(data)
        fetchLeads()
        fetchStats()
      }
    } catch {
      setImportError('Hitilafu ya mtandao. Jaribu tena.')
    } finally {
      setImporting(false)
    }
  }

  function resetImport() {
    setImportFile(null)
    setImportResult(null)
    setImportError('')
  }

  // ── Broadcast helpers ─────────────────────────────────────────────────────
  async function fetchBroadcastCount(region: string, status: string) {
    setBroadcastCount(null)
    const params = new URLSearchParams()
    if (region) params.set('region', region)
    if (status) params.set('status', status)
    try {
      const res = await fetch(`/api/v1/agent/leads/broadcast?${params}`)
      const data = await res.json()
      setBroadcastCount(data.count ?? 0)
    } catch { setBroadcastCount(0) }
  }

  async function handleBroadcast() {
    if (!broadcastMessage.trim()) { setBroadcastError('Andika ujumbe kwanza'); return }
    setBroadcasting(true)
    setBroadcastError('')
    setBroadcastResult(null)
    try {
      const res = await fetch('/api/v1/agent/leads/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: broadcastMessage,
          tone:    broadcastTone,
          region:  broadcastRegion,
          status:  broadcastStatus,
        }),
      })
      const data = await res.json()
      if (!res.ok) setBroadcastError(data.error || 'Imeshindwa kutuma')
      else setBroadcastResult(data)
    } catch { setBroadcastError('Hitilafu ya mtandao. Jaribu tena.') }
    finally { setBroadcasting(false) }
  }

  function resetBroadcast() {
    setBroadcastMessage('')
    setBroadcastTone('personal')
    setBroadcastRegion('')
    setBroadcastStatus('')
    setBroadcastCount(null)
    setBroadcastResult(null)
    setBroadcastError('')
  }

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-500 bg-gray-100'
  }

  function getStatusStyle(status: string) {
    return STATUSES.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-600'
  }

  function renderSourceIcon(source: string) {
    const icon = SOURCES.find(s => s.id === source)?.icon || 'pin'
    return <i className={`ti ti-${icon}`} aria-hidden="true" />
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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><i className="ti ti-robot" aria-hidden="true" />Leads za Madalali</h1>
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
              <i className="ti ti-plus" aria-hidden="true" /> Ongeza Lead
            </button>
            <button
              onClick={() => { resetImport(); setShowImportModal(true) }}
              className="px-4 py-2 border border-primary-200 text-primary-600 bg-primary-50 rounded-xl text-sm font-medium hover:bg-primary-100"
            >
              <i className="ti ti-table-import" aria-hidden="true" /> Import Excel
            </button>
            <button
              onClick={() => { resetBroadcast(); setShowBroadcastModal(true); fetchBroadcastCount('', '') }}
              className="px-4 py-2 bg-[#25D366] text-white rounded-xl text-sm font-bold hover:bg-green-600"
            >
              <i className="ti ti-brand-whatsapp" aria-hidden="true" /> Broadcast WA
            </button>
            <button
              onClick={() => setShowRunModal(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600"
            >
              <i className="ti ti-robot" aria-hidden="true" /> Run Agent
            </button>
          </div>
        </div>

        {/* Desktop stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Jumla Leads', value: stats.total,    icon: 'chart-bar',           bg: 'bg-blue-50',   border: 'border-blue-100',   icon_c: 'text-blue-500',   val_c: 'text-blue-900',   lbl_c: 'text-blue-500' },
            { label: 'Leo',         value: stats.new_today, icon: 'square-rounded-plus', bg: 'bg-emerald-50',border: 'border-emerald-100', icon_c: 'text-emerald-500',val_c: 'text-emerald-900',lbl_c: 'text-emerald-500' },
            { label: 'Walipigiwa',  value: stats.contacted, icon: 'phone',               bg: 'bg-amber-50',  border: 'border-amber-100',  icon_c: 'text-amber-500',  val_c: 'text-amber-900',  lbl_c: 'text-amber-500' },
            { label: 'Walisajili',  value: stats.converted, icon: 'circle-check',        bg: 'bg-violet-50', border: 'border-violet-100', icon_c: 'text-violet-500', val_c: 'text-violet-900', lbl_c: 'text-violet-500' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} border ${s.border} rounded-2xl p-5`}>
              <div className="flex items-start justify-between mb-3">
                <i className={`ti ti-${s.icon} text-2xl ${s.icon_c}`} aria-hidden="true" />
              </div>
              <p className={`text-3xl font-extrabold tabular-nums ${s.val_c}`}>{s.value}</p>
              <p className={`text-xs font-semibold mt-1.5 uppercase tracking-wide ${s.lbl_c}`}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Desktop filters */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Tafuta jina au simu..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
              focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none min-w-44">
            <option value="">Mikoa Yote</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none min-w-44">
            <option value="">Sources Zote</option>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none min-w-36">
            <option value="">Status Zote</option>
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
                      {renderSourceIcon(lead.source)}
                      <div>
                        <p className="font-medium text-sm text-gray-900">{lead.business_name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {lead.facebook_url && (
                            <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800" title="Facebook">
                              <i className="ti ti-brand-facebook text-xs" aria-hidden="true" />
                            </a>
                          )}
                          {lead.instagram_url && (
                            <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-pink-500 hover:text-pink-700" title="Instagram">
                              <i className="ti ti-brand-instagram text-xs" aria-hidden="true" />
                            </a>
                          )}
                          {lead.tiktok_url && (
                            <a href={lead.tiktok_url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-gray-800 hover:text-black" title="TikTok">
                              <i className="ti ti-brand-tiktok text-xs" aria-hidden="true" />
                            </a>
                          )}
                          {lead.website_url && (
                            <a href={lead.website_url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-gray-500 hover:text-gray-700" title="Website">
                              <i className="ti ti-world text-xs" aria-hidden="true" />
                            </a>
                          )}
                          {lead.email && <p className="text-xs text-gray-400">{lead.email}</p>}
                        </div>
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
                    <span className="text-sm text-gray-600 flex items-center gap-1"><i className="ti ti-map-pin" aria-hidden="true" />{lead.region || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{renderSourceIcon(lead.source)} {lead.source?.replace(/_/g, ' ')}</span>
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
                        href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^0-9]/g, '')}?text=${waMessage(lead.business_name || 'Rafiki')}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="bg-[#25D366] text-white text-xs px-2.5 py-1.5 rounded-lg font-medium hover:bg-green-600"
                      >
                        <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WA
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
              <div className="text-5xl mb-3 flex justify-center"><i className="ti ti-robot text-gray-400" aria-hidden="true" /></div>
              <p className="font-semibold text-gray-700">Hakuna leads bado</p>
              <p className="text-gray-400 text-sm mt-1">Bonyeza &quot;Run Agent&quot; kupata leads mpya</p>
              <button onClick={() => setShowRunModal(true)}
                className="mt-4 bg-primary-500 text-white px-6 py-3 rounded-xl text-sm font-semibold">
                <i className="ti ti-robot" aria-hidden="true" /> Run Agent Sasa
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
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
              <span className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ti ti-robot text-primary-500 text-sm" aria-hidden="true" />
              </span>
              Leads
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 pl-8">
              {total} leads{lastRun ? ` · Mwisho ${timeAgo(lastRun)} · Leo +${leadsToday}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"
              title="Ongeza Lead"
            >
              <i className="ti ti-plus text-gray-600 text-base" aria-hidden="true" />
            </button>
            <button
              onClick={() => { resetImport(); setShowImportModal(true) }}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"
              title="Import Excel"
            >
              <i className="ti ti-table-import text-gray-600 text-base" aria-hidden="true" />
            </button>
            <button
              onClick={() => { resetBroadcast(); setShowBroadcastModal(true); fetchBroadcastCount('', '') }}
              className="h-9 px-2.5 rounded-xl bg-[#25D366] text-white text-[11px] font-bold flex items-center gap-1"
            >
              <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" /> WA
            </button>
            <button
              onClick={() => setShowRunModal(true)}
              className="h-9 px-2.5 rounded-xl bg-primary-500 text-white text-[11px] font-bold flex items-center gap-1"
            >
              <i className="ti ti-robot text-sm" aria-hidden="true" /> Run
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3">
        {[
          { label: 'Jumla',      value: stats.total,     icon: 'chart-bar',           bg: 'bg-blue-50',   text: 'text-blue-600',   num: 'text-blue-800' },
          { label: 'Leo',        value: stats.new_today,  icon: 'square-rounded-plus', bg: 'bg-emerald-50',text: 'text-emerald-600', num: 'text-emerald-800' },
          { label: 'Pigiwa',     value: stats.contacted,  icon: 'phone',               bg: 'bg-amber-50',  text: 'text-amber-600',  num: 'text-amber-800' },
          { label: 'Sajili',     value: stats.converted,  icon: 'circle-check',        bg: 'bg-violet-50', text: 'text-violet-600', num: 'text-violet-800' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} rounded-xl p-2.5 text-center`}>
            <i className={`ti ti-${stat.icon} ${stat.text} text-base block mb-1`} aria-hidden="true" />
            <div className={`font-extrabold text-xl leading-none ${stat.num}`}>{stat.value}</div>
            <div className={`text-[10px] mt-1 font-medium ${stat.text}`}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Regional Stats */}
      {stats.by_region && stats.by_region.length > 0 && (
        <div className="px-4 mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            <i className="ti ti-chart-bar" aria-hidden="true" /> Leads kwa Mkoa
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
          placeholder="Tafuta jina au simu..."
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
            <option value="">Mikoa Yote</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filterSource}
            onChange={e => { setFilterSource(e.target.value); setPage(1) }}
            className="flex-1 text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">Sources Zote</option>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="flex-1 text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">Status Zote</option>
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
            <div className="text-5xl mb-3 flex justify-center"><i className="ti ti-robot text-gray-400" aria-hidden="true" /></div>
            <p className="font-semibold text-gray-700">Hakuna leads bado</p>
            <p className="text-gray-400 text-sm mt-1">Bonyeza &quot;Run Agent&quot; kupata leads mpya</p>
            <button
              onClick={() => setShowRunModal(true)}
              className="mt-4 bg-primary-500 text-white px-6 py-3 rounded-xl text-sm font-semibold"
            >
              <i className="ti ti-robot" aria-hidden="true" /> Run Agent Sasa
            </button>
          </div>
        )}

        {!loading && leads.map(lead => {
          const scoreHigh = lead.ai_score >= 80
          const scoreMid  = lead.ai_score >= 60
          const accentBar = scoreHigh ? 'bg-emerald-400' : scoreMid ? 'bg-amber-400' : 'bg-gray-300'
          return (
            <div
              key={lead.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform shadow-sm"
              onClick={() => setSelectedLead(lead)}
            >
              {/* Score bar at top */}
              <div className={`h-0.5 w-full ${accentBar}`} />

              <div className="p-4">
                {/* Row 1: name + score */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 text-base">
                      {renderSourceIcon(lead.source)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
                        {lead.business_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {lead.region || '—'} · {timeAgo(lead.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-bold tabular-nums ${getScoreColor(lead.ai_score)}`}>
                    {lead.ai_score}
                  </span>
                </div>

                {/* Row 2: status + phone + WA */}
                <div className="flex items-center gap-2">
                  <select
                    value={lead.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value) }}
                    className={`text-[11px] px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer ${getStatusStyle(lead.status)}`}
                  >
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>

                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={e => e.stopPropagation()}
                      className="text-[11px] text-blue-600 flex items-center gap-0.5"
                    >
                      <i className="ti ti-phone text-xs" aria-hidden="true" />
                      {lead.phone}
                    </a>
                  )}

                  <div className="ml-auto flex items-center gap-1.5">
                    {(lead.facebook_url || lead.instagram_url || lead.tiktok_url) && (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {lead.facebook_url && (
                          <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer"
                            className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                            <i className="ti ti-brand-facebook text-xs" aria-hidden="true" />
                          </a>
                        )}
                        {lead.instagram_url && (
                          <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer"
                            className="w-6 h-6 rounded-md bg-pink-50 text-pink-500 flex items-center justify-center">
                            <i className="ti ti-brand-instagram text-xs" aria-hidden="true" />
                          </a>
                        )}
                        {lead.tiktok_url && (
                          <a href={lead.tiktok_url} target="_blank" rel="noopener noreferrer"
                            className="w-6 h-6 rounded-md bg-gray-100 text-gray-700 flex items-center justify-center">
                            <i className="ti ti-brand-tiktok text-xs" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    )}
                    {(lead.whatsapp || lead.phone) && (
                      <a
                        href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^0-9]/g, '')}?text=${waMessage(lead.business_name || 'Rafiki')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="h-7 px-2.5 bg-[#25D366] text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                      >
                        <i className="ti ti-brand-whatsapp text-xs" aria-hidden="true" /> WA
                      </a>
                    )}
                  </div>
                </div>

                {lead.ai_notes && (
                  <p className="text-[11px] text-gray-400 mt-2 line-clamp-1 flex items-center gap-1">
                    <i className="ti ti-robot text-[10px]" aria-hidden="true" />{lead.ai_notes}
                  </p>
                )}
              </div>
            </div>
          )
        })}

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
              <h3 className="font-bold text-lg flex items-center gap-2"><i className="ti ti-robot" aria-hidden="true" />Endesha Agent</h3>
              <button onClick={() => { setShowRunModal(false); setRunResult(null) }}
                aria-label="Funga" className="text-gray-400 text-xl"><i className="ti ti-x" aria-hidden="true" /></button>
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
                  <i className="ti ti-map-pin" aria-hidden="true" /> {runRegion} · Sources: {runSources.length}
                </p>
              </div>
            ) : !runResult ? (
              <>
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 block mb-2 flex items-center gap-1"><i className="ti ti-map-pin" aria-hidden="true" />Chagua Mkoa</label>
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
                  <label className="text-sm font-medium text-gray-700 block mb-2 flex items-center gap-1"><i className="ti ti-antenna" aria-hidden="true" />Chagua Sources</label>
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
                        {source?.icon?.startsWith('brand-') && BRAND_PLATFORMS.has(source.icon.replace('brand-', ''))
                          ? <PlatformLogo platform={source.icon.replace('brand-', '')} size={20} />
                          : <i className={`ti ti-${source?.icon ?? 'pin'} text-lg`} aria-hidden="true" />}
                        <span className="text-xs font-medium text-gray-700">{source.label}</span>
                        {runSources.includes(source.id) && (
                          <i className="ti ti-check ml-auto text-primary-500 text-sm" aria-hidden="true" />
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
                    <i className="ti ti-alert-triangle" aria-hidden="true" /> {runError}
                  </p>
                )}

                <button
                  onClick={() => { setRunError(''); handleRunAgent() }}
                  disabled={running || runSources.length === 0}
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50"
                >
                  {`Anza Kutafuta — ${runRegion}`}
                </button>
              </>
            ) : (
              <div>
                {runResult.error ? (
                  <div className="space-y-3">
                    <div className="bg-red-50 rounded-xl p-4 text-red-700">
                      <p className="font-bold mb-1 flex items-center gap-1"><i className="ti ti-circle-x" aria-hidden="true" />Kosa Limetokea</p>
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
                      <p className="font-bold text-green-700 mb-1 flex items-center gap-1"><i className="ti ti-circle-check" aria-hidden="true" />Imekamilika!</p>
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
                            {renderSourceIcon(String(run.source ?? ''))} {String(run.source ?? '')}
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
                              {run.status === 'FAILED' ? <><i className="ti ti-circle-x" aria-hidden="true" /> Imeshindwa</> : <><i className="ti ti-circle-check" aria-hidden="true" /> Imefanikiwa</>}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {runResult.errors?.length > 0 && (
                      <div className="bg-yellow-50 rounded-xl p-3">
                        {runResult.errors.map((e: any, i: number) => (
                          <p key={i} className="text-xs text-yellow-700">
                            <i className="ti ti-alert-triangle" aria-hidden="true" /> {String(e.source ?? '')}: {
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
                {renderSourceIcon(selectedLead.source)} {selectedLead.business_name}
              </h3>
              <button onClick={() => setSelectedLead(null)} aria-label="Funga" className="text-gray-400 text-xl"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>

            <div className="space-y-3">
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold
                ${getScoreColor(selectedLead.ai_score)}`}>
                <i className="ti ti-robot" aria-hidden="true" /> AI Score: {selectedLead.ai_score}/100
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                {selectedLead.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center gap-1"><i className="ti ti-phone" aria-hidden="true" />Simu</span>
                    <a href={`tel:${selectedLead.phone}`} className="text-sm font-medium text-blue-600">
                      {selectedLead.phone}
                    </a>
                  </div>
                )}
                {selectedLead.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center gap-1"><i className="ti ti-mail" aria-hidden="true" />Email</span>
                    <a href={`mailto:${selectedLead.email}`} className="text-sm font-medium text-blue-600">
                      {selectedLead.email}
                    </a>
                  </div>
                )}
                {selectedLead.region && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 flex items-center gap-1"><i className="ti ti-map-pin" aria-hidden="true" />Mkoa</span>
                    <span className="text-sm font-medium">{selectedLead.region}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1"><i className="ti ti-antenna" aria-hidden="true" />Source</span>
                  <span className="text-sm font-medium">
                    {renderSourceIcon(selectedLead.source)} {selectedLead.source}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {selectedLead.website_url && (
                  <a href={selectedLead.website_url} target="_blank" rel="noopener noreferrer"
                    className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-xl text-center font-medium">
                    <i className="ti ti-world" aria-hidden="true" /> Website
                  </a>
                )}
                {selectedLead.facebook_url && (
                  <a href={selectedLead.facebook_url} target="_blank" rel="noopener noreferrer"
                    className="bg-blue-600 text-white text-xs px-3 py-2 rounded-xl text-center font-medium">
                    <PlatformLogo platform="facebook" size={14} /> Facebook
                  </a>
                )}
                {selectedLead.instagram_url && (
                  <a href={selectedLead.instagram_url} target="_blank" rel="noopener noreferrer"
                    className="bg-pink-500 text-white text-xs px-3 py-2 rounded-xl text-center font-medium">
                    <PlatformLogo platform="instagram" size={14} /> Instagram
                  </a>
                )}
                {selectedLead.tiktok_url && (
                  <a href={selectedLead.tiktok_url} target="_blank" rel="noopener noreferrer"
                    className="bg-black text-white text-xs px-3 py-2 rounded-xl text-center font-medium">
                    <PlatformLogo platform="tiktok" size={14} /> TikTok
                  </a>
                )}
                {selectedLead.source_url && (
                  <a href={selectedLead.source_url} target="_blank" rel="noopener noreferrer"
                    className="bg-gray-100 text-gray-700 text-xs px-3 py-2 rounded-xl text-center font-medium">
                    <i className="ti ti-link" aria-hidden="true" /> Source
                  </a>
                )}
              </div>

              {selectedLead.ai_notes && (
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1"><i className="ti ti-robot" aria-hidden="true" />Claude Analysis:</p>
                  <p className="text-xs text-purple-600">{selectedLead.ai_notes}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2 flex items-center gap-1"><i className="ti ti-clipboard-list" aria-hidden="true" />Badilisha Status</label>
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
                  <i className="ti ti-brand-whatsapp" aria-hidden="true" /> Wasiliana WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WhatsApp Broadcast Modal ── */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <i className="ti ti-brand-whatsapp text-[#25D366] text-xl" aria-hidden="true" />
                Broadcast WhatsApp kwa Leads
              </h3>
              <button onClick={() => { setShowBroadcastModal(false); resetBroadcast() }}
                aria-label="Funga"
                className="text-gray-400 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
                <i className="ti ti-x text-xl" aria-hidden="true" />
              </button>
            </div>

            {broadcastResult ? (
              /* ── Result screen ── */
              <div className="space-y-4">
                <div className={`rounded-2xl p-5 text-center ${broadcastResult.failed === broadcastResult.total ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <i className={`ti ${broadcastResult.failed === broadcastResult.total ? 'ti-alert-circle text-red-500' : 'ti-circle-check text-green-500'} text-4xl block mb-2`} aria-hidden="true" />
                  <p className="font-bold text-lg text-gray-800">Imekamilika!</p>
                  <p className="text-gray-600 text-sm mt-1">Jumla ya wapokeaji: {broadcastResult.total}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{broadcastResult.sent}</p>
                    <p className="text-xs text-green-700 mt-0.5">Imetumwa</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-500">{broadcastResult.failed}</p>
                    <p className="text-xs text-red-600 mt-0.5">Imeshindwa</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button onClick={() => resetBroadcast()}
                    className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">
                    Tuma Nyingine
                  </button>
                  <button onClick={() => { setShowBroadcastModal(false); resetBroadcast() }}
                    className="py-3 bg-primary-500 text-white rounded-xl text-sm font-bold">
                    Funga
                  </button>
                </div>
              </div>
            ) : broadcasting ? (
              /* ── Sending ── */
              <div className="py-12 text-center">
                <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-gray-700">Inatuma ujumbe...</p>
                <p className="text-sm text-gray-400 mt-1">Tafadhali subiri — huchukua muda</p>
              </div>
            ) : (
              /* ── Compose screen ── */
              <div className="space-y-4">

                {/* Filters */}
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <i className="ti ti-filter" aria-hidden="true" /> Chagua Wapokeaji
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Mkoa</label>
                      <select
                        value={broadcastRegion}
                        onChange={e => { setBroadcastRegion(e.target.value); fetchBroadcastCount(e.target.value, broadcastStatus) }}
                        className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400"
                      >
                        <option value="">Mikoa Yote</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Hali ya Lead</label>
                      <select
                        value={broadcastStatus}
                        onChange={e => { setBroadcastStatus(e.target.value); fetchBroadcastCount(broadcastRegion, e.target.value) }}
                        className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400"
                      >
                        <option value="">Status Zote</option>
                        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Recipient count badge */}
                  <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                    <i className="ti ti-users text-[#25D366]" aria-hidden="true" />
                    {broadcastCount === null ? (
                      <span className="text-sm text-gray-400">Inahesabu...</span>
                    ) : (
                      <span className="text-sm font-medium text-gray-700">
                        Wapokeaji:&nbsp;
                        <span className={`font-bold ${broadcastCount === 0 ? 'text-red-500' : 'text-[#25D366]'}`}>
                          {broadcastCount}
                        </span>
                        &nbsp;leads wenye WhatsApp
                      </span>
                    )}
                  </div>
                </div>

                {/* Tone selector */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <i className="ti ti-mood-smile" aria-hidden="true" /> Mtindo wa Ujumbe
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'personal', label: 'Urafiki', icon: 'mood-smile' },
                      { id: 'formal',   label: 'Rasmi',   icon: 'tie' },
                      { id: 'urgent',   label: 'Dharura', icon: 'alert-triangle' },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setBroadcastTone(t.id)}
                        className={`py-2.5 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-1
                          ${broadcastTone === t.id
                            ? 'bg-[#25D366] text-white border-[#25D366]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}
                      >
                        <i className={`ti ti-${t.icon}`} aria-hidden="true" /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block flex items-center gap-1">
                    <i className="ti ti-message" aria-hidden="true" /> Ujumbe
                  </label>
                  <textarea
                    rows={5}
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder={`Andika ujumbe hapa...\n\nUnaweza kutumia {jina} ili mfumo ubadilishe jina la biashara kiotomatiki.\n\nMfano: Karibu {jina}! Tungependa kukuomba ujisajili kwenye NyumbaFasta Tanzania.`}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Tumia <code className="bg-gray-100 px-1 rounded">{'{jina}'}</code> — itabadilishwa na jina la biashara
                  </p>
                </div>

                {broadcastError && (
                  <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                    <i className="ti ti-alert-triangle flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{broadcastError}</span>
                  </div>
                )}

                <button
                  onClick={handleBroadcast}
                  disabled={!broadcastMessage.trim() || broadcasting || broadcastCount === 0}
                  className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <i className="ti ti-send" aria-hidden="true" />
                  {broadcastCount !== null && broadcastCount > 0
                    ? `Tuma kwa leads ${broadcastCount} wenye WhatsApp`
                    : broadcastCount === 0
                    ? 'Hakuna wapokeaji waliochaguliwa'
                    : 'Tuma Broadcast'}
                </button>

                <p className="text-xs text-center text-gray-400">
                  <i className="ti ti-info-circle" aria-hidden="true" /> Ujumbe utatumwa kwa leads wote wenye namba ya WhatsApp kwenye mfumo
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Import Excel Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <i className="ti ti-table-import text-primary-500" aria-hidden="true" />
                Import Leads kutoka Excel
              </h3>
              <button
                onClick={() => { setShowImportModal(false); resetImport() }}
                aria-label="Funga"
                className="text-gray-400 text-xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {importResult ? (
              /* ── Success/summary screen ── */
              <div className="space-y-4">
                {/* Main counter */}
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                  <i className="ti ti-circle-check text-green-500 text-4xl block mb-2" aria-hidden="true" />
                  <p className="font-bold text-green-700 text-lg">Imekamilika!</p>
                  <p className="text-green-600 text-sm mt-1">
                    <span className="font-bold text-2xl">{importResult.imported}</span> leads mpya zimeingizwa kwenye mfumo
                  </p>
                </div>

                {/* Duplicate breakdown — only show if any */}
                {(importResult.duplicates_file > 0 || importResult.duplicates_db > 0) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1 mb-2">
                      <i className="ti ti-copy-off" aria-hidden="true" /> Nakala zilizozuiwa
                    </p>
                    {importResult.duplicates_file > 0 && (
                      <div className="flex items-center justify-between text-xs text-blue-700">
                        <span className="flex items-center gap-1.5">
                          <i className="ti ti-files" aria-hidden="true" />
                          Nakala ndani ya faili hilo hilo
                        </span>
                        <span className="font-bold bg-blue-100 px-2 py-0.5 rounded-full">
                          {importResult.duplicates_file}
                        </span>
                      </div>
                    )}
                    {importResult.duplicates_db > 0 && (
                      <div className="flex items-center justify-between text-xs text-blue-700">
                        <span className="flex items-center gap-1.5">
                          <i className="ti ti-database" aria-hidden="true" />
                          Zilizopo tayari kwenye mfumo
                        </span>
                        <span className="font-bold bg-blue-100 px-2 py-0.5 rounded-full">
                          {importResult.duplicates_db}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Parse / insert errors */}
                {importResult.skipped > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                      <i className="ti ti-alert-triangle" aria-hidden="true" />
                      Safu {importResult.skipped} zenye makosa (zimepitwa):
                    </p>
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-amber-700">Safu {e.row}: {e.reason}</p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { resetImport() }}
                    className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600"
                  >
                    Import Nyingine
                  </button>
                  <button
                    onClick={() => { setShowImportModal(false); resetImport() }}
                    className="py-3 bg-primary-500 text-white rounded-xl text-sm font-bold"
                  >
                    Ona Leads →
                  </button>
                </div>
              </div>
            ) : importing ? (
              /* ── Loading ── */
              <div className="py-12 text-center">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-gray-700">Inaingiza leads...</p>
                <p className="text-sm text-gray-400 mt-1">Tafadhali subiri</p>
              </div>
            ) : (
              /* ── File picker ── */
              <div className="space-y-4">
                {/* Format guide */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                    <i className="ti ti-info-circle" aria-hidden="true" /> Muundo unaohitajika
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-xs text-blue-700 w-full">
                      <thead>
                        <tr className="border-b border-blue-200">
                          {['business_name *', 'phone', 'whatsapp', 'region', 'district', 'facebook_url', 'instagram_url', 'tiktok_url', 'confidence', 'notes'].map(h => (
                            <th key={h} className="pr-3 pb-1 text-left font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="pr-3 py-1 whitespace-nowrap">Nyumba Bora Agency</td>
                          <td className="pr-3 whitespace-nowrap">0712345678</td>
                          <td className="pr-3 whitespace-nowrap">0712345678</td>
                          <td className="pr-3">Dar es Salaam</td>
                          <td className="pr-3">Masaki</td>
                          <td className="pr-3 whitespace-nowrap text-blue-400">fb.com/nyumba</td>
                          <td className="pr-3 text-blue-400">ig.com/nyumba</td>
                          <td className="pr-3 text-blue-400">tiktok.com/@n</td>
                          <td className="pr-3">85</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-blue-500 mt-2">
                    * Lead bila simu na bila akaunti yoyote ya kijamii itapitwa.<br/>
                    * <code className="bg-blue-100 px-1 rounded">confidence</code> = nambari 0–100 (au 0–1). Default: 50.
                  </p>
                  <a
                    href="/api/v1/agent/leads/bulk"
                    download="leads_template.csv"
                    className="mt-2 text-xs text-blue-600 font-medium underline flex items-center gap-1"
                  >
                    <i className="ti ti-download" aria-hidden="true" /> Pakua template (CSV)
                  </a>
                </div>

                {/* Drop zone */}
                <label
                  htmlFor="excel-upload"
                  className={`flex flex-col items-center justify-center w-full min-h-[140px]
                    border-2 border-dashed rounded-2xl cursor-pointer transition-colors
                    ${importFile
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'
                    }`}
                >
                  {importFile ? (
                    <div className="text-center px-4">
                      <i className="ti ti-file-spreadsheet text-primary-500 text-4xl block mb-2" aria-hidden="true" />
                      <p className="font-semibold text-primary-700 text-sm truncate max-w-[250px]">{importFile.name}</p>
                      <p className="text-xs text-primary-500 mt-1">
                        {(importFile.size / 1024).toFixed(1)} KB · Tayari kuingiza
                      </p>
                    </div>
                  ) : (
                    <div className="text-center px-4">
                      <i className="ti ti-cloud-upload text-gray-400 text-4xl block mb-2" aria-hidden="true" />
                      <p className="font-semibold text-gray-600 text-sm">Gusa hapa kuchagua faili</p>
                      <p className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls) au CSV (.csv)</p>
                    </div>
                  )}
                  <input
                    id="excel-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="sr-only"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null
                      setImportFile(f)
                      setImportError('')
                    }}
                  />
                </label>

                {importError && (
                  <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                    <i className="ti ti-alert-triangle flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{importError}</span>
                  </div>
                )}

                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <i className="ti ti-table-import" aria-hidden="true" />
                  {importFile ? `Ingiza Leads kutoka "${importFile.name}"` : 'Chagua faili kwanza'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Manual Lead Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-1"><i className="ti ti-plus" aria-hidden="true" />Ongeza Lead Manually</h3>
              <button onClick={() => setShowAddModal(false)} aria-label="Funga" className="text-gray-400 text-xl"><i className="ti ti-x" aria-hidden="true" /></button>
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
                <i className="ti ti-plus" aria-hidden="true" /> Ongeza Lead
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
