'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { TANZANIA_REGIONS } from '@/lib/agent/regions'
import { PlatformLogo } from '@/components/shared/PlatformLogo'

const IMPORT_CHUNK_SIZE = 500
const BRAND_PLATFORMS = new Set(['whatsapp', 'instagram', 'facebook', 'tiktok'])

type Lead = {
  id: string
  business_name: string
  phone: string | null
  email: string | null
  region: string | null
  district: string | null
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
  { id: 'google_maps',      label: 'Google Maps',      icon: 'map-pin' },
  { id: 'google_business',  label: 'Google Business',  icon: 'building-store' },
  { id: 'facebook_groups',  label: 'FB Groups',        icon: 'brand-facebook' },
  { id: 'facebook_pages',   label: 'FB Pages',         icon: 'brand-facebook' },
  { id: 'facebook_profile', label: 'FB Profile',       icon: 'brand-facebook' },
  { id: 'instagram',        label: 'Instagram',        icon: 'brand-instagram' },
  { id: 'tiktok',           label: 'TikTok',           icon: 'brand-tiktok' },
  { id: 'manual',           label: 'Manual',           icon: 'pencil' },
  { id: 'excel_import',     label: 'Excel Import',     icon: 'table-import' },
  { id: 'whatsapp_amina',   label: 'WA Amina',         icon: 'brand-whatsapp' },
  { id: 'instagram_amina',  label: 'IG Amina',         icon: 'brand-instagram' },
  { id: 'facebook_amina',   label: 'FB Amina',         icon: 'brand-facebook' },
]

const STATUSES = [
  { id: 'new',         label: 'Mpya',      color: 'bg-blue-100 text-blue-700' },
  { id: 'contacted',   label: 'Amepigiwa', color: 'bg-amber-100 text-amber-700' },
  { id: 'interested',  label: 'Anapenda',  color: 'bg-orange-100 text-orange-700' },
  { id: 'converted',   label: 'Amesajili', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'rejected',    label: 'Amekataa',  color: 'bg-red-100 text-red-700' },
]

export default function LeadsClient() {
  // ── Core state ──────────────────────────────────────────────────────────────
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
  }>({ total: 0, new_today: 0, contacted: 0, converted: 0, by_region: [] })

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [showRunModal, setShowRunModal] = useState(false)
  const [runRegion, setRunRegion] = useState('Dar es Salaam')
  const [runSources, setRunSources] = useState<string[]>(['google_maps'])
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)
  const [runError, setRunError] = useState('')

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [newLead, setNewLead] = useState({
    business_name: '', phone: '', email: '', region: 'Dar es Salaam', notes: ''
  })

  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{
    phase: 'reading' | 'processing'
    currentChunk: number
    totalChunks: number
    totalRows: number
  } | null>(null)
  const [importResult, setImportResult] = useState<{
    success: boolean
    imported: number
    duplicates_file: number
    duplicates_db: number
    skipped: number
    errors: { row: number; reason: string }[]
  } | null>(null)
  const [importError, setImportError] = useState('')

  // ── Broadcast state ─────────────────────────────────────────────────────────
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastTone, setBroadcastTone] = useState('personal')
  const [broadcastRegion, setBroadcastRegion] = useState('')
  const [broadcastStatus, setBroadcastStatus] = useState('')
  const [broadcastCount, setBroadcastCount] = useState<number | null>(null)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{
    total: number; sent: number; failed: number
  } | null>(null)
  const [broadcastError, setBroadcastError] = useState('')

  const [lastRun, setLastRun] = useState<string | null>(null)
  const [leadsToday, setLeadsToday] = useState(0)
  const [showFilters, setShowFilters] = useState(false)

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        ...(filterRegion && { region: filterRegion }),
        ...(filterSource && { source: filterSource }),
        ...(filterStatus && { status: filterStatus }),
        ...(search && { search }),
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

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    fetch('/api/v1/agent/last-run')
      .then(r => r.json())
      .then(data => { setLastRun(data.last_run); setLeadsToday(data.leads_today) })
      .catch(() => {})
  }, [])

  // ── Event handlers ──────────────────────────────────────────────────────────
  async function handleRunAgent() {
    if (runSources.length === 0) { setRunError('Chagua angalau source moja'); return }
    setRunning(true); setRunResult(null)
    try {
      const res = await fetch('/api/v1/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: runRegion, sources: runSources }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        const text = await res.text()
        setRunResult({ error: `Server error (${res.status}): ${text.slice(0, 300)}` })
        return
      }
      setRunResult(await res.json())
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
        body: JSON.stringify({ id: leadId, status: newStatus }),
      })
      if (res.ok) fetchLeads()
    } catch (err) { console.error(err) }
  }

  async function handleAddManualLead() {
    try {
      const res = await fetch('/api/v1/agent/leads/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      })
      if (res.ok) {
        setShowAddModal(false)
        setNewLead({ business_name: '', phone: '', email: '', region: 'Dar es Salaam', notes: '' })
        fetchLeads(); fetchStats()
      }
    } catch (err) { console.error(err) }
  }

  async function handleImport() {
    if (!importFile) return
    setImporting(true); setImportError(''); setImportResult(null)
    setImportProgress({ phase: 'reading', currentChunk: 0, totalChunks: 0, totalRows: 0 })

    try {
      const XLSX = await import('xlsx')
      const arrayBuf = await importFile.arrayBuffer()
      const wb = XLSX.read(arrayBuf, { type: 'array', raw: false, cellDates: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false, defval: '' })

      if (rawData.length === 0) { setImportError('Faili haina data ya kutosha'); return }

      const chunks: Record<string, string>[][] = []
      for (let i = 0; i < rawData.length; i += IMPORT_CHUNK_SIZE) {
        chunks.push(rawData.slice(i, i + IMPORT_CHUNK_SIZE))
      }

      setImportProgress({ phase: 'processing', currentChunk: 0, totalChunks: chunks.length, totalRows: rawData.length })

      const totals = {
        imported: 0, duplicates_file: 0, duplicates_db: 0, skipped: 0,
        errors: [] as { row: number; reason: string }[],
      }

      for (let ci = 0; ci < chunks.length; ci++) {
        setImportProgress({ phase: 'processing', currentChunk: ci, totalChunks: chunks.length, totalRows: rawData.length })
        const res = await fetch('/api/v1/agent/leads/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunks[ci], chunkOffset: ci * IMPORT_CHUNK_SIZE }),
        })
        const data = await res.json()
        if (!res.ok) { setImportError(data.error || `Hitilafu kwenye sehemu ${ci + 1}`); return }
        totals.imported        += data.imported        || 0
        totals.duplicates_file += data.duplicates_file || 0
        totals.duplicates_db   += data.duplicates_db   || 0
        totals.skipped         += data.skipped         || 0
        if (data.errors?.length) totals.errors.push(...data.errors)
        setImportProgress({ phase: 'processing', currentChunk: ci + 1, totalChunks: chunks.length, totalRows: rawData.length })
      }

      setImportResult({ success: totals.imported > 0 || totals.errors.length === 0, ...totals })
      fetchLeads(); fetchStats()
    } catch {
      setImportError('Hitilafu ya mtandao. Jaribu tena.')
    } finally {
      setImporting(false); setImportProgress(null)
    }
  }

  function resetImport() {
    setImportFile(null); setImportResult(null); setImportError(''); setImportProgress(null)
  }

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
    setBroadcasting(true); setBroadcastError(''); setBroadcastResult(null)
    try {
      const res = await fetch('/api/v1/agent/leads/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage, tone: broadcastTone, region: broadcastRegion, status: broadcastStatus }),
      })
      const data = await res.json()
      if (!res.ok) setBroadcastError(data.error || 'Imeshindwa kutuma')
      else setBroadcastResult(data)
    } catch { setBroadcastError('Hitilafu ya mtandao. Jaribu tena.') }
    finally { setBroadcasting(false) }
  }

  function resetBroadcast() {
    setBroadcastMessage(''); setBroadcastTone('personal'); setBroadcastRegion('')
    setBroadcastStatus(''); setBroadcastCount(null); setBroadcastResult(null); setBroadcastError('')
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────
  function getScoreColor(score: number) {
    if (score >= 80) return 'text-emerald-700 bg-emerald-100'
    if (score >= 60) return 'text-amber-700 bg-amber-100'
    return 'text-gray-500 bg-gray-100'
  }

  function getScoreBorder(score: number) {
    if (score >= 80) return 'border-l-emerald-400'
    if (score >= 60) return 'border-l-amber-400'
    return 'border-l-gray-300'
  }

  function getStatusStyle(status: string) {
    return STATUSES.find(s => s.id === status)?.color || 'bg-gray-100 text-gray-600'
  }

  function renderSourceIcon(source: string) {
    const src = SOURCES.find(s => s.id === source)
    if (!src) return <i className="ti ti-pin" aria-hidden="true" />
    const platform = src.icon.replace('brand-', '')
    if (BRAND_PLATFORMS.has(platform) && src.icon.startsWith('brand-')) {
      return <PlatformLogo platform={platform} size={14} />
    }
    return <i className={`ti ti-${src.icon}`} aria-hidden="true" />
  }

  function getSourceLabel(source: string) {
    return SOURCES.find(s => s.id === source)?.label || source.replace(/_/g, ' ')
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (mins < 60)  return `${mins}m`
    if (hours < 24) return `${hours}h`
    if (days === 1) return 'Jana'
    return `Siku ${days}`
  }

  const waMessage = (name: string) =>
    encodeURIComponent(
      `Habari ${name}! Mimi ni kutoka NyumbaFasta Tanzania — platform ya madalali wa nyumba. Tungependa kukualika ujisajili bure. Je, una dakika kuzungumza?`
    )

  const activeFiltersCount = [filterRegion, filterSource, filterStatus].filter(Boolean).length
  const totalPages = Math.ceil(total / 50)
  const conversionRate = stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ═══════════════════════════════════════
          STICKY PAGE HEADER
      ═══════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ti ti-users text-white text-lg" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-base leading-tight">Leads Pipeline</h1>
              <p className="text-xs text-gray-500 truncate">
                {total.toLocaleString()} leads
                {lastRun ? ` · Mwisho ${timeAgo(lastRun)} · Leo +${leadsToday}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              <i className="ti ti-plus" aria-hidden="true" /> Ongeza
            </button>
            <button
              onClick={() => { resetImport(); setShowImportModal(true) }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 border border-primary-200 rounded-xl hover:bg-primary-100"
            >
              <i className="ti ti-table-import" aria-hidden="true" /> Import
            </button>
            <button
              onClick={() => { resetBroadcast(); setShowBroadcastModal(true); fetchBroadcastCount('', '') }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-[#25D366] rounded-xl hover:bg-green-600"
            >
              <i className="ti ti-brand-whatsapp" aria-hidden="true" />
              <span className="hidden sm:inline">Broadcast</span>
            </button>
            <button
              onClick={() => setShowRunModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-white bg-primary-500 rounded-xl hover:bg-primary-600"
            >
              <i className="ti ti-robot" aria-hidden="true" />
              <span className="hidden sm:inline">Run Agent</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5">

        {/* ═══════════════════════════════════════
            STATS ROW
        ═══════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {([
            { label: 'Jumla Leads',   value: stats.total,     sub: `+${stats.new_today} leo`,     icon: 'users',       bg: 'bg-blue-50',    border: 'border-blue-200',   ic: 'text-blue-500',    val: 'text-blue-900',    lbl: 'text-blue-600' },
            { label: 'Leads Mpya',    value: stats.new_today, sub: 'Zilizoongezwa leo',            icon: 'user-plus',   bg: 'bg-emerald-50', border: 'border-emerald-200',ic: 'text-emerald-500', val: 'text-emerald-900', lbl: 'text-emerald-600' },
            { label: 'Waliopigiwa',   value: stats.contacted, sub: 'Walioshughulikiwa',             icon: 'phone-call',  bg: 'bg-amber-50',   border: 'border-amber-200',  ic: 'text-amber-500',   val: 'text-amber-900',   lbl: 'text-amber-600' },
            { label: 'Walisajili',    value: stats.converted, sub: `${conversionRate}% kiwango`,   icon: 'user-check',  bg: 'bg-violet-50',  border: 'border-violet-200', ic: 'text-violet-500',  val: 'text-violet-900',  lbl: 'text-violet-600' },
          ] as const).map((s, i) => (
            <div key={i} className={`${s.bg} border ${s.border} rounded-2xl p-4`}>
              <i className={`ti ti-${s.icon} text-xl ${s.ic} block mb-2`} aria-hidden="true" />
              <p className={`text-3xl font-extrabold tabular-nums ${s.val}`}>{s.value.toLocaleString()}</p>
              <p className={`text-xs font-semibold mt-1 uppercase tracking-wide ${s.lbl}`}>{s.label}</p>
              <p className={`text-xs mt-0.5 ${s.lbl} opacity-70`}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════
            SEARCH + FILTER BAR
        ═══════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 shadow-sm">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                placeholder="Tafuta jina, simu, au mkoa..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Mobile: filter toggle */}
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`sm:hidden relative flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-medium transition-colors
                ${activeFiltersCount > 0 || showFilters
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <i className="ti ti-adjustments-horizontal" aria-hidden="true" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Desktop: inline filters */}
            <div className="hidden sm:flex gap-2">
              <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(1) }}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-40">
                <option value="">Mikoa Yote</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1) }}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-36">
                <option value="">Sources Zote</option>
                {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-36">
                <option value="">Status Zote</option>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setFilterRegion(''); setFilterSource(''); setFilterStatus(''); setPage(1) }}
                  className="px-3 py-2.5 text-sm text-gray-500 hover:text-red-500 border border-gray-200 rounded-xl hover:border-red-200 hover:bg-red-50"
                >
                  <i className="ti ti-x" aria-hidden="true" /> Futa
                </button>
              )}
            </div>

            {/* Mobile: quick action icons */}
            <div className="sm:hidden flex gap-1.5">
              <button onClick={() => setShowAddModal(true)}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">
                <i className="ti ti-plus text-base" aria-hidden="true" />
              </button>
              <button onClick={() => { resetImport(); setShowImportModal(true) }}
                className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 hover:bg-primary-100">
                <i className="ti ti-table-import text-base" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Mobile collapsible filters */}
          {showFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-gray-100 space-y-2">
              <select value={filterRegion} onChange={e => { setFilterRegion(e.target.value); setPage(1) }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                <option value="">Mikoa Yote</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1) }}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                  <option value="">Sources Zote</option>
                  {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                  <option value="">Status Zote</option>
                  {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setFilterRegion(''); setFilterSource(''); setFilterStatus(''); setPage(1) }}
                  className="w-full py-2.5 text-sm text-red-600 border border-red-100 bg-red-50 rounded-xl font-medium">
                  Futa Filters Zote
                </button>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            REGIONAL DISTRIBUTION
        ═══════════════════════════════════════ */}
        {stats.by_region?.length > 0 && !filterRegion && !search && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <i className="ti ti-map-2 text-primary-500" aria-hidden="true" /> Usambazaji kwa Mkoa
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {stats.by_region.slice(0, 10).map(item => (
                <button
                  key={item.region}
                  onClick={() => { setFilterRegion(item.region); setPage(1) }}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left group"
                >
                  <span className="text-xs font-medium text-gray-700 truncate group-hover:text-primary-700">{item.region}</span>
                  <span className="text-xs font-bold text-primary-600 flex-shrink-0 bg-primary-100 px-1.5 py-0.5 rounded-full">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            DESKTOP TABLE
        ═══════════════════════════════════════ */}
        <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {loading
                ? <span className="inline-flex items-center gap-1.5"><i className="ti ti-loader-2 animate-spin text-primary-500" aria-hidden="true" /> Inapakia...</span>
                : <>{total.toLocaleString()} lead{total !== 1 ? 's' : ''}{activeFiltersCount > 0 && <span className="text-primary-500 ml-1">(imechujwa)</span>}</>
              }
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  {['Biashara', 'Mawasiliano', 'Eneo', 'Chanzo', 'Score', 'Status', 'Umri', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className={`h-3.5 bg-gray-100 rounded-full animate-pulse ${j === 0 ? 'w-40' : j === 7 ? 'w-12' : 'w-24'}`} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : leads.map(lead => (
                      <tr
                        key={lead.id}
                        className="hover:bg-blue-50/30 cursor-pointer transition-colors group"
                        onClick={() => setSelectedLead(lead)}
                      >
                        {/* Business + social links */}
                        <td className="px-4 py-3.5 max-w-[220px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 text-sm group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                              {renderSourceIcon(lead.source)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{lead.business_name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {lead.facebook_url && (
                                  <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700">
                                    <i className="ti ti-brand-facebook text-xs" aria-hidden="true" />
                                  </a>
                                )}
                                {lead.instagram_url && (
                                  <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-pink-500 hover:text-pink-700">
                                    <i className="ti ti-brand-instagram text-xs" aria-hidden="true" />
                                  </a>
                                )}
                                {lead.tiktok_url && (
                                  <a href={lead.tiktok_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-gray-700 hover:text-black">
                                    <i className="ti ti-brand-tiktok text-xs" aria-hidden="true" />
                                  </a>
                                )}
                                {lead.email && <span className="text-xs text-gray-400 truncate max-w-[110px]">{lead.email}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5">
                          {lead.phone
                            ? <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-sm text-blue-600 hover:underline font-medium">{lead.phone}</a>
                            : <span className="text-gray-300 text-sm">—</span>
                          }
                        </td>

                        {/* Region / District */}
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-gray-700 font-medium">{lead.region || '—'}</span>
                          {lead.district && <p className="text-xs text-gray-400">{lead.district}</p>}
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-600 font-medium">
                            {renderSourceIcon(lead.source)}
                            {getSourceLabel(lead.source)}
                          </span>
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-bold tabular-nums ${getScoreColor(lead.ai_score)}`}>
                            {lead.ai_score}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <select
                            value={lead.status}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value) }}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border-0 font-semibold cursor-pointer appearance-none ${getStatusStyle(lead.status)}`}
                          >
                            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-gray-400 tabular-nums">{timeAgo(lead.created_at)}</span>
                        </td>

                        {/* WA action */}
                        <td className="px-4 py-3.5">
                          {(lead.whatsapp || lead.phone) && (
                            <a
                              href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^0-9]/g, '')}?text=${waMessage(lead.business_name || 'Rafiki')}`}
                              target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 bg-[#25D366] text-white text-xs px-2.5 py-1.5 rounded-lg font-bold hover:bg-green-600 transition-colors"
                            >
                              <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" /> WA
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!loading && leads.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="ti ti-users text-3xl text-gray-400" aria-hidden="true" />
              </div>
              <p className="font-semibold text-gray-700 text-base">
                {activeFiltersCount > 0 ? 'Hakuna leads zinazolingana na filter' : 'Hakuna leads bado'}
              </p>
              <p className="text-gray-400 text-sm mt-1 mb-5">
                {activeFiltersCount > 0 ? 'Jaribu kubadilisha filters' : 'Bonyeza "Run Agent" au "Import" kupata leads'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {activeFiltersCount > 0 && (
                  <button onClick={() => { setFilterRegion(''); setFilterSource(''); setFilterStatus(''); setSearch(''); setPage(1) }}
                    className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Futa Filters
                  </button>
                )}
                <button onClick={() => setShowRunModal(true)}
                  className="px-5 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600">
                  <i className="ti ti-robot" aria-hidden="true" /> Run Agent
                </button>
              </div>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 50 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Ukurasa <span className="font-semibold text-gray-700">{page}</span> / {totalPages}
                &nbsp;·&nbsp;<span className="font-semibold text-gray-700">{total.toLocaleString()}</span> jumla
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  ← Iliyopita
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pn = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                  return (
                    <button key={pn} onClick={() => setPage(pn)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                        ${pn === page ? 'bg-primary-500 text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                      {pn}
                    </button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  Inayofuata →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════
            MOBILE CARDS
        ═══════════════════════════════════════ */}
        <div className="lg:hidden space-y-2.5">

          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-[100px] animate-pulse border border-gray-100" />
          ))}

          {!loading && leads.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center shadow-sm">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <i className="ti ti-users text-2xl text-gray-400" aria-hidden="true" />
              </div>
              <p className="font-semibold text-gray-700">
                {activeFiltersCount > 0 ? 'Hakuna leads zinazolingana' : 'Hakuna leads bado'}
              </p>
              <p className="text-gray-400 text-sm mt-1 mb-4">
                {activeFiltersCount > 0 ? 'Jaribu kubadilisha filters' : 'Bonyeza "Run Agent" kupata leads mpya'}
              </p>
              <button onClick={() => setShowRunModal(true)}
                className="bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600">
                <i className="ti ti-robot" aria-hidden="true" /> Run Agent
              </button>
            </div>
          )}

          {!loading && leads.map(lead => (
            <div
              key={lead.id}
              className={`bg-white rounded-2xl border border-gray-100 border-l-4 overflow-hidden cursor-pointer active:scale-[0.99] transition-all shadow-sm ${getScoreBorder(lead.ai_score)}`}
              onClick={() => setSelectedLead(lead)}
            >
              <div className="p-4">
                {/* Name + score */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                      {renderSourceIcon(lead.source)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{lead.business_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        {lead.region && <><i className="ti ti-map-pin text-[10px]" aria-hidden="true" />{lead.region}</>}
                        {lead.region && <span>·</span>}
                        {timeAgo(lead.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-bold tabular-nums ${getScoreColor(lead.ai_score)}`}>
                    {lead.ai_score}
                  </span>
                </div>

                {/* Status + phone + social + WA */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={lead.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value) }}
                    className={`text-[11px] px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer appearance-none ${getStatusStyle(lead.status)}`}
                  >
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>

                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-600 flex items-center gap-0.5 font-medium">
                      <i className="ti ti-phone text-xs" aria-hidden="true" />{lead.phone}
                    </a>
                  )}

                  <div className="ml-auto flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    {lead.facebook_url && (
                      <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer"
                        className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <i className="ti ti-brand-facebook text-xs" aria-hidden="true" />
                      </a>
                    )}
                    {lead.instagram_url && (
                      <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer"
                        className="w-6 h-6 rounded-lg bg-pink-50 text-pink-500 flex items-center justify-center">
                        <i className="ti ti-brand-instagram text-xs" aria-hidden="true" />
                      </a>
                    )}
                    {lead.tiktok_url && (
                      <a href={lead.tiktok_url} target="_blank" rel="noopener noreferrer"
                        className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                        <i className="ti ti-brand-tiktok text-xs" aria-hidden="true" />
                      </a>
                    )}
                    {(lead.whatsapp || lead.phone) && (
                      <a
                        href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^0-9]/g, '')}?text=${waMessage(lead.business_name || 'Rafiki')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="h-7 px-2.5 bg-[#25D366] text-white text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-green-600"
                      >
                        <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" /> WA
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
          ))}

          {/* Mobile pagination */}
          {!loading && total > 50 && (
            <div className="flex items-center justify-between py-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 shadow-sm">
                ← Iliyopita
              </button>
              <span className="text-sm text-gray-500 font-medium">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50 shadow-sm">
                Inayofuata →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RUN AGENT MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center">
                  <i className="ti ti-robot text-primary-500" aria-hidden="true" />
                </span>
                Endesha Agent
              </h3>
              <button onClick={() => { setShowRunModal(false); setRunResult(null) }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {running ? (
              <div className="py-12 text-center">
                <div className="w-14 h-14 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-gray-700">Inatafuta madalali...</p>
                <p className="text-sm text-gray-400 mt-1">Inaweza kuchukua dakika 5–15</p>
              </div>
            ) : !runResult ? (
              <>
                <div className="mb-4">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    <i className="ti ti-map-pin text-primary-500" aria-hidden="true" /> Chagua Mkoa
                  </label>
                  <select value={runRegion} onChange={e => setRunRegion(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="mb-5">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    <i className="ti ti-antenna text-primary-500" aria-hidden="true" /> Chagua Sources
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCES.filter(s => !['manual', 'excel_import', 'whatsapp_amina', 'instagram_amina', 'facebook_amina'].includes(s.id)).map(source => (
                      <label
                        key={source.id}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all
                          ${runSources.includes(source.id)
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      >
                        <input type="checkbox" checked={runSources.includes(source.id)} className="hidden"
                          onChange={e => {
                            if (e.target.checked) setRunSources(prev => [...prev, source.id])
                            else setRunSources(prev => prev.filter(s => s !== source.id))
                          }}
                        />
                        <span className="text-sm text-gray-600 flex-shrink-0">{renderSourceIcon(source.id)}</span>
                        <span className="text-xs font-medium text-gray-700 flex-1 leading-tight">{source.label}</span>
                        {runSources.includes(source.id) && <i className="ti ti-check text-primary-500 text-sm" aria-hidden="true" />}
                      </label>
                    ))}
                  </div>
                </div>

                {runError && (
                  <p className="text-sm text-red-500 mb-3 flex items-center gap-1">
                    <i className="ti ti-alert-triangle" aria-hidden="true" /> {runError}
                  </p>
                )}

                <button
                  onClick={() => { setRunError(''); handleRunAgent() }}
                  disabled={running || runSources.length === 0}
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50 hover:bg-primary-600"
                >
                  Anza Kutafuta — {runRegion}
                </button>
              </>
            ) : (
              <div>
                {runResult.error ? (
                  <div className="space-y-3">
                    <div className="bg-red-50 rounded-xl p-4 text-red-700">
                      <p className="font-bold mb-1 flex items-center gap-1"><i className="ti ti-circle-x" aria-hidden="true" /> Kosa Limetokea</p>
                      <p className="text-sm">{typeof runResult.error === 'string' ? runResult.error : runResult.error?.message ?? JSON.stringify(runResult.error)}</p>
                    </div>
                    <button onClick={() => setRunResult(null)}
                      className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50">
                      ← Rudi
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="font-bold text-green-700 mb-1 flex items-center gap-1"><i className="ti ti-circle-check" aria-hidden="true" /> Imekamilika!</p>
                      <p className="text-green-600 text-sm">
                        Leads mpya: <span className="font-bold text-green-800">
                          {(runResult.runs ?? []).reduce((sum: number, r: any) => sum + (Number(r.saved) || 0), 0)}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(runResult.runs ?? []).map((run: any, i: number) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                          <span className="text-sm font-medium flex items-center gap-2">
                            {renderSourceIcon(String(run.source ?? ''))} {String(run.source ?? '')}
                          </span>
                          <div className="flex items-center gap-2">
                            {run.status !== 'FAILED' && (
                              <span className="text-xs font-bold text-gray-600">+{Number(run.saved) || 0} leads</span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full ${run.status === 'FAILED' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {run.status === 'FAILED' ? 'Imeshindwa' : 'Imefanikiwa'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setShowRunModal(false); setRunResult(null); fetchLeads(); fetchStats() }}
                      className="w-full bg-primary-500 text-white py-3 rounded-xl font-bold hover:bg-primary-600"
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

      {/* ═══════════════════════════════════════════════════════════════
          LEAD DETAIL MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                  {renderSourceIcon(selectedLead.source)}
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">{selectedLead.business_name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{getSourceLabel(selectedLead.source)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold mb-4 ${getScoreColor(selectedLead.ai_score)}`}>
              <i className="ti ti-robot" aria-hidden="true" /> AI Score: {selectedLead.ai_score}/100
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-4">
              {selectedLead.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5"><i className="ti ti-phone" aria-hidden="true" />Simu</span>
                  <a href={`tel:${selectedLead.phone}`} className="text-sm font-semibold text-blue-600 hover:underline">{selectedLead.phone}</a>
                </div>
              )}
              {selectedLead.email && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5"><i className="ti ti-mail" aria-hidden="true" />Email</span>
                  <a href={`mailto:${selectedLead.email}`} className="text-sm font-semibold text-blue-600 truncate max-w-[60%]">{selectedLead.email}</a>
                </div>
              )}
              {selectedLead.region && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5"><i className="ti ti-map-pin" aria-hidden="true" />Eneo</span>
                  <span className="text-sm font-semibold">
                    {selectedLead.region}{selectedLead.district ? ` · ${selectedLead.district}` : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5"><i className="ti ti-antenna" aria-hidden="true" />Chanzo</span>
                <span className="text-sm font-semibold">{getSourceLabel(selectedLead.source)}</span>
              </div>
            </div>

            {/* Social/links grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {selectedLead.website_url && (
                <a href={selectedLead.website_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 text-sm px-3 py-2.5 rounded-xl font-medium hover:bg-blue-100">
                  <i className="ti ti-world" aria-hidden="true" /> Website
                </a>
              )}
              {selectedLead.facebook_url && (
                <a href={selectedLead.facebook_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-blue-600 text-white text-sm px-3 py-2.5 rounded-xl font-medium hover:bg-blue-700">
                  <i className="ti ti-brand-facebook" aria-hidden="true" /> Facebook
                </a>
              )}
              {selectedLead.instagram_url && (
                <a href={selectedLead.instagram_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm px-3 py-2.5 rounded-xl font-medium">
                  <i className="ti ti-brand-instagram" aria-hidden="true" /> Instagram
                </a>
              )}
              {selectedLead.tiktok_url && (
                <a href={selectedLead.tiktok_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-black text-white text-sm px-3 py-2.5 rounded-xl font-medium hover:bg-gray-900">
                  <i className="ti ti-brand-tiktok" aria-hidden="true" /> TikTok
                </a>
              )}
              {selectedLead.source_url && (
                <a href={selectedLead.source_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 text-sm px-3 py-2.5 rounded-xl font-medium hover:bg-gray-200">
                  <i className="ti ti-link" aria-hidden="true" /> Source
                </a>
              )}
            </div>

            {selectedLead.ai_notes && (
              <div className="bg-purple-50 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1">
                  <i className="ti ti-robot" aria-hidden="true" /> Claude Analysis
                </p>
                <p className="text-xs text-purple-600">{selectedLead.ai_notes}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-2">Badilisha Status</label>
              <div className="grid grid-cols-3 gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { handleStatusChange(selectedLead.id, s.id); setSelectedLead({ ...selectedLead, status: s.id }) }}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all ${s.color}
                      ${selectedLead.status === s.id ? 'ring-2 ring-offset-2 ring-gray-400 scale-95' : 'hover:opacity-80'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {(selectedLead.whatsapp || selectedLead.phone) && (
              <a
                href={`https://wa.me/${(selectedLead.whatsapp || selectedLead.phone)?.replace(/[^0-9]/g, '')}?text=${waMessage(selectedLead.business_name)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold text-base hover:bg-green-600"
              >
                <i className="ti ti-brand-whatsapp text-xl" aria-hidden="true" /> Wasiliana WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          BROADCAST MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <i className="ti ti-brand-whatsapp text-[#25D366] text-xl" aria-hidden="true" />
                Broadcast WhatsApp
              </h3>
              <button onClick={() => { setShowBroadcastModal(false); resetBroadcast() }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {broadcastResult ? (
              <div className="space-y-4">
                <div className={`rounded-2xl p-5 text-center ${broadcastResult.failed === broadcastResult.total ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <i className={`ti ${broadcastResult.failed === broadcastResult.total ? 'ti-alert-circle text-red-500' : 'ti-circle-check text-green-500'} text-4xl block mb-2`} aria-hidden="true" />
                  <p className="font-bold text-lg text-gray-800">Imekamilika!</p>
                  <p className="text-gray-500 text-sm mt-1">Jumla ya wapokeaji: {broadcastResult.total}</p>
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
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={resetBroadcast}
                    className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Tuma Nyingine
                  </button>
                  <button onClick={() => { setShowBroadcastModal(false); resetBroadcast() }}
                    className="py-3 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600">
                    Funga
                  </button>
                </div>
              </div>
            ) : broadcasting ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-gray-700">Inatuma ujumbe...</p>
                <p className="text-sm text-gray-400 mt-1">Tafadhali subiri</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chagua Wapokeaji</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Mkoa</label>
                      <select value={broadcastRegion}
                        onChange={e => { setBroadcastRegion(e.target.value); fetchBroadcastCount(e.target.value, broadcastStatus) }}
                        className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none">
                        <option value="">Mikoa Yote</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Hali ya Lead</label>
                      <select value={broadcastStatus}
                        onChange={e => { setBroadcastStatus(e.target.value); fetchBroadcastCount(broadcastRegion, e.target.value) }}
                        className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none">
                        <option value="">Status Zote</option>
                        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                    <i className="ti ti-users text-[#25D366]" aria-hidden="true" />
                    {broadcastCount === null
                      ? <span className="text-sm text-gray-400">Inahesabu...</span>
                      : <span className="text-sm font-medium">
                          Wapokeaji: <span className={`font-bold ${broadcastCount === 0 ? 'text-red-500' : 'text-[#25D366]'}`}>{broadcastCount}</span> wenye WhatsApp
                        </span>
                    }
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mtindo wa Ujumbe</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'personal', label: 'Urafiki',  icon: 'mood-smile' },
                      { id: 'formal',   label: 'Rasmi',    icon: 'tie' },
                      { id: 'urgent',   label: 'Dharura',  icon: 'alert-triangle' },
                    ].map(t => (
                      <button key={t.id} onClick={() => setBroadcastTone(t.id)}
                        className={`py-2.5 rounded-xl text-xs font-medium border flex items-center justify-center gap-1 transition-all
                          ${broadcastTone === t.id ? 'bg-[#25D366] text-white border-[#25D366]' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
                        <i className={`ti ti-${t.icon}`} aria-hidden="true" /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Ujumbe</label>
                  <textarea rows={5} value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder={`Andika ujumbe hapa...\n\nTumia {jina} kwa jina la biashara.\n\nMfano: Karibu {jina}! Tungependa kukuomba ujisajili kwenye NyumbaFasta.`}
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

                <button onClick={handleBroadcast}
                  disabled={!broadcastMessage.trim() || broadcasting || broadcastCount === 0}
                  className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-green-600">
                  <i className="ti ti-send" aria-hidden="true" />
                  {broadcastCount !== null && broadcastCount > 0
                    ? `Tuma kwa leads ${broadcastCount} wenye WhatsApp`
                    : broadcastCount === 0 ? 'Hakuna wapokeaji' : 'Tuma Broadcast'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          IMPORT EXCEL MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <i className="ti ti-table-import text-primary-500" aria-hidden="true" />
                Import Leads kutoka Excel
              </h3>
              <button onClick={() => { setShowImportModal(false); resetImport() }}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {importing && importProgress ? (
              <div className="space-y-5 py-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 relative">
                    <div className="w-16 h-16 border-4 border-primary-100 rounded-full absolute inset-0" />
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="font-bold text-gray-800 text-lg">
                    {importProgress.phase === 'reading' ? 'Inasoma faili...' : 'Inachambua leads...'}
                  </p>
                  {importProgress.totalChunks > 0 && (
                    <p className="text-gray-500 text-sm mt-1">
                      Sehemu {importProgress.currentChunk} / {importProgress.totalChunks}
                    </p>
                  )}
                </div>
                {importProgress.totalChunks > 0 && (
                  <>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.round((importProgress.currentChunk / importProgress.totalChunks) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {Math.min(importProgress.currentChunk * IMPORT_CHUNK_SIZE, importProgress.totalRows).toLocaleString()} / {importProgress.totalRows.toLocaleString()} safu
                      </span>
                      <span className="font-semibold text-primary-600">
                        {Math.round((importProgress.currentChunk / importProgress.totalChunks) * 100)}%
                      </span>
                    </div>
                  </>
                )}
                <p className="text-xs text-center text-gray-400">Tafadhali subiri — usifunge ukurasa huu</p>
              </div>
            ) : importResult ? (
              <div className="space-y-4">
                {importResult.imported > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                    <i className="ti ti-circle-check text-green-500 text-5xl block mb-2" aria-hidden="true" />
                    <p className="font-bold text-green-700 text-lg">Imekamilika!</p>
                    <p className="text-green-600 text-sm mt-1">
                      <span className="font-bold text-3xl text-green-800">{importResult.imported}</span> leads mpya zimeingizwa
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                    <i className="ti ti-alert-circle text-red-500 text-5xl block mb-2" aria-hidden="true" />
                    <p className="font-bold text-red-700 text-lg">Hakuna leads zilizoingizwa</p>
                    <p className="text-red-600 text-sm mt-1">Angalia makosa hapa chini</p>
                  </div>
                )}

                {(importResult.duplicates_file > 0 || importResult.duplicates_db > 0) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                      <i className="ti ti-copy-off" aria-hidden="true" /> Nakala zilizozuiwa
                    </p>
                    {importResult.duplicates_file > 0 && (
                      <div className="flex items-center justify-between text-xs text-blue-700">
                        <span className="flex items-center gap-1.5"><i className="ti ti-files" aria-hidden="true" />Nakala ndani ya faili</span>
                        <span className="font-bold bg-blue-100 px-2 py-0.5 rounded-full">{importResult.duplicates_file}</span>
                      </div>
                    )}
                    {importResult.duplicates_db > 0 && (
                      <div className="flex items-center justify-between text-xs text-blue-700">
                        <span className="flex items-center gap-1.5"><i className="ti ti-database" aria-hidden="true" />Zilizopo tayari kwenye mfumo</span>
                        <span className="font-bold bg-blue-100 px-2 py-0.5 rounded-full">{importResult.duplicates_db}</span>
                      </div>
                    )}
                  </div>
                )}

                {importResult.skipped > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                      <i className="ti ti-alert-triangle" aria-hidden="true" />
                      Safu {importResult.skipped} zenye makosa (zimepitwa)
                    </p>
                    {importResult.errors.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-xs text-amber-700">Safu {e.row}: {e.reason}</p>
                    ))}
                    {importResult.errors.length > 5 && (
                      <p className="text-xs text-amber-500 mt-1">+{importResult.errors.length - 5} zaidi...</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={resetImport}
                    className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                    Import Nyingine
                  </button>
                  <button onClick={() => { setShowImportModal(false); resetImport() }}
                    className="py-3 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600">
                    Ona Leads →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                    <i className="ti ti-info-circle" aria-hidden="true" /> Safu wima zinazotambuliwa
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['business_name *', 'phone', 'whatsapp', 'region', 'district', 'facebook_url', 'instagram_url', 'tiktok_url', 'confidence', 'notes'].map(h => (
                      <span key={h} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">{h}</span>
                    ))}
                  </div>
                  <a href="/api/v1/agent/leads/bulk" download="leads_template.csv"
                    className="mt-2.5 text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline">
                    <i className="ti ti-download" aria-hidden="true" /> Pakua template (CSV)
                  </a>
                </div>

                <label
                  htmlFor="excel-upload"
                  className={`flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed rounded-2xl cursor-pointer transition-colors
                    ${importFile ? 'border-primary-400 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'}`}
                >
                  {importFile ? (
                    <div className="text-center px-4">
                      <i className="ti ti-file-spreadsheet text-primary-500 text-4xl block mb-2" aria-hidden="true" />
                      <p className="font-semibold text-primary-700 text-sm truncate max-w-[250px]">{importFile.name}</p>
                      <p className="text-xs text-primary-500 mt-1">{(importFile.size / 1024).toFixed(1)} KB · Tayari kuingiza</p>
                    </div>
                  ) : (
                    <div className="text-center px-4">
                      <i className="ti ti-cloud-upload text-gray-400 text-4xl block mb-2" aria-hidden="true" />
                      <p className="font-semibold text-gray-600 text-sm">Gusa hapa kuchagua faili</p>
                      <p className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls) au CSV (.csv)</p>
                    </div>
                  )}
                  <input id="excel-upload" type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                    onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportError('') }}
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
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-primary-600"
                >
                  <i className="ti ti-table-import" aria-hidden="true" />
                  {importFile ? `Ingiza Leads kutoka "${importFile.name}"` : 'Chagua faili kwanza'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          ADD MANUAL LEAD MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center">
                  <i className="ti ti-user-plus text-primary-500" aria-hidden="true" />
                </span>
                Ongeza Lead
              </h3>
              <button onClick={() => setShowAddModal(false)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Jina la biashara *"
                value={newLead.business_name}
                onChange={e => setNewLead({ ...newLead, business_name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input type="tel" placeholder="Nambari ya simu (+255...)"
                value={newLead.phone}
                onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input type="email" placeholder="Email (hiari)"
                value={newLead.email}
                onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select value={newLead.region} onChange={e => setNewLead({ ...newLead, region: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea placeholder="Maelezo (hiari)" value={newLead.notes} rows={3}
                onChange={e => setNewLead({ ...newLead, notes: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <button onClick={handleAddManualLead} disabled={!newLead.business_name}
                className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold disabled:opacity-50 hover:bg-primary-600">
                <i className="ti ti-plus" aria-hidden="true" /> Ongeza Lead
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
