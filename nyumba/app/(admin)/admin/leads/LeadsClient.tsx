'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
type Lead = {
  id: string
  full_name: string
  phone: string | null
  phone_2: string | null
  email: string | null
  ward: string | null
  district: string | null
  region: string | null
  lead_type: string
  source: string
  notes: string | null
  facebook_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  whatsapp_number: string | null
  facebook_status: string
  instagram_status: string
  tiktok_status: string
  whatsapp_status: string
  social_score: number
  contact_quality: string
  has_valid_phone: boolean
  has_any_social: boolean
  is_dead_lead: boolean
  is_duplicate: boolean
  duplicate_reason: string | null
  status: string
  contacted_at: string | null
  assigned_to: string | null
  address: string | null
  created_at: string
}

type Stats = {
  total: number; high: number; medium: number; low: number
  dead: number; duplicates: number
  has_whatsapp: number; has_facebook: number; has_instagram: number; has_tiktok: number
}

type ImportResult = {
  success: boolean; batchId: string
  stats: {
    total: number; imported: number; duplicates: number; deadLeads: number; activeLeads: number
    socialVerified: number; socialActive: number; socialInactive: number
  }
}

// ── Config ────────────────────────────────────────────────────────────────────
const QUALITY_CFG: Record<string, { label: string; pill: string; dot: string; border: string }> = {
  high:    { label: 'Juu',         pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', border: 'border-l-emerald-400' },
  medium:  { label: 'Wastani',     pill: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400',   border: 'border-l-amber-400' },
  low:     { label: 'Chini',       pill: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-400',  border: 'border-l-orange-400' },
  dead:    { label: 'Amekufa',     pill: 'bg-red-100 text-red-600',         dot: 'bg-red-500',     border: 'border-l-red-300' },
  unknown: { label: 'Haijulikani', pill: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-300',    border: 'border-l-gray-200' },
}

const SOCIAL_CFG: Record<string, { icon: string; color: string }> = {
  active:     { icon: 'ti-circle-check', color: 'text-emerald-500' },
  inactive:   { icon: 'ti-circle-x',     color: 'text-red-400' },
  not_found:  { icon: 'ti-circle-x',     color: 'text-red-500' },
  unchecked:  { icon: 'ti-circle-dashed', color: 'text-gray-300' },
  has_number: { icon: 'ti-circle-check', color: 'text-emerald-400' },
}

const STATUS_PILL: Record<string, string> = {
  new:       'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  interested:'bg-purple-100 text-purple-700',
  registered:'bg-emerald-100 text-emerald-700',
  inactive:  'bg-gray-100 text-gray-500',
  rejected:  'bg-red-100 text-red-600',
}

const STATUSES = [
  { id: 'new',        label: 'Mpya' },
  { id: 'contacted',  label: 'Amewasiliana' },
  { id: 'interested', label: 'Ana nia' },
  { id: 'registered', label: 'Amesajili' },
  { id: 'inactive',   label: 'Haifanyi kazi' },
  { id: 'rejected',   label: 'Amekataa' },
]

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60)   return `${d}s`
  if (d < 3600) return `${Math.floor(d/60)}m`
  if (d < 86400) return `${Math.floor(d/3600)}h`
  return `${Math.floor(d/86400)}d`
}

function waLink(num: string, name: string) {
  const clean = num.replace(/[^0-9]/g, '')
  const msg = encodeURIComponent(`Habari ${name}! Mimi ni kutoka NyumbaFasta Tanzania. Tungependa kukuomba ujisajili kwenye platform yetu ya madalali. Je, una dakika?`)
  return `https://wa.me/${clean}?text=${msg}`
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LeadsClient() {
  const [leads, setLeads]         = useState<Lead[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]     = useState(true)
  const [stats, setStats]         = useState<Stats>({ total:0,high:0,medium:0,low:0,dead:0,duplicates:0,has_whatsapp:0,has_facebook:0,has_instagram:0,has_tiktok:0 })
  const [statsLoading, setStatsLoading] = useState(true)

  // Filters
  const [page,          setPage]          = useState(1)
  const [search,        setSearch]        = useState('')
  const [qualityFilter, setQualityFilter] = useState('')
  const [typeFilter,    setTypeFilter]    = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [socialFilter,  setSocialFilter]  = useState('')
  const [showDups,      setShowDups]      = useState(false)
  const [showDead,      setShowDead]      = useState(false)
  const [showFilters,   setShowFilters]   = useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Lead detail
  const [detailLead, setDetailLead] = useState<Lead | null>(null)

  // Import
  const [importing,       setImporting]       = useState(false)
  const [importResult,    setImportResult]    = useState<ImportResult | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile,      setImportFile]      = useState<File | null>(null)
  const [importLeadType,  setImportLeadType]  = useState('dalali')
  const fileRef = useRef<HTMLInputElement>(null)

  // Verify social
  const [verifying, setVerifying] = useState(false)

  // Add manual
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ full_name:'', phone:'', phone_2:'', email:'', ward:'', district:'', region:'Dar es Salaam', lead_type:'dalali', facebook_url:'', instagram_url:'', tiktok_url:'', whatsapp_number:'', notes:'' })
  const [addLoading, setAddLoading] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        page: String(page), limit: '50',
        duplicates: String(showDups),
        dead: String(showDead),
        ...(search        && { search }),
        ...(qualityFilter && { quality: qualityFilter }),
        ...(typeFilter    && { type:    typeFilter }),
        ...(statusFilter  && { status:  statusFilter }),
        ...(socialFilter  && { social:  socialFilter }),
      })
      const res  = await fetch(`/api/v1/leads?${p}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setTotal(data.pagination?.total || 0)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [page, search, qualityFilter, typeFilter, statusFilter, socialFilter, showDups, showDead])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res  = await fetch('/api/v1/leads/stats')
      const data = await res.json()
      setStats(data)
    } catch { /* silent */ } finally { setStatsLoading(false) }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchStats() }, [fetchStats])

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!importFile) return
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('leadType', importLeadType)
      const res  = await fetch('/api/v1/leads/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) {
        setImportResult(data)
        fetchLeads(); fetchStats()
        showToast(`✅ ${data.stats.imported} leads zimeingizwa!`)
      } else {
        showToast(data.error || 'Imeshindwa', false)
      }
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setImporting(false) }
  }

  // ── Verify social ──────────────────────────────────────────────────────────
  async function handleVerify() {
    const ids = selectedIds.size > 0 ? [...selectedIds] : leads.filter(l => l.has_any_social).map(l => l.id)
    if (!ids.length) { showToast('Chagua leads zenye social media kwanza', false); return }
    setVerifying(true)
    try {
      const res  = await fetch('/api/v1/leads/verify-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: ids.slice(0, 20) }),
      })
      const data = await res.json()
      showToast(`✅ Leads ${data.verified} zimecheckiwa`)
      fetchLeads()
    } catch { showToast('Hitilafu wakati wa kucheki', false) }
    finally { setVerifying(false) }
  }

  // ── Status change ──────────────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: string) {
    await fetch('/api/v1/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (detailLead?.id === id) setDetailLead(prev => prev ? { ...prev, status } : null)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string, hard = false) {
    if (!confirm(hard ? 'Futa kabisa?' : 'Futa hii lead?')) return
    await fetch(`/api/v1/leads?id=${id}&type=${hard ? 'hard' : 'soft'}`, { method: 'DELETE' })
    setLeads(prev => prev.filter(l => l.id !== id))
    setDetailLead(null)
    fetchStats()
  }

  // ── Add manual ─────────────────────────────────────────────────────────────
  async function handleAddManual() {
    if (!addForm.full_name.trim()) { showToast('Jina linahitajika', false); return }
    setAddLoading(true)
    try {
      const res  = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Lead imeongezwa!')
        setShowAddModal(false)
        setAddForm({ full_name:'', phone:'', phone_2:'', email:'', ward:'', district:'', region:'Dar es Salaam', lead_type:'dalali', facebook_url:'', instagram_url:'', tiktok_url:'', whatsapp_number:'', notes:'' })
        fetchLeads(); fetchStats()
      } else showToast(data.error || 'Imeshindwa', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setAddLoading(false) }
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  async function handleExport() {
    const p = new URLSearchParams({ limit:'5000', duplicates: String(showDups), dead: String(showDead), ...(qualityFilter && { quality: qualityFilter }) })
    const res  = await fetch(`/api/v1/leads?${p}`)
    const data = await res.json()
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet((data.leads || []).map((l: Lead) => ({
      'Jina': l.full_name, 'Simu': l.phone, 'Simu 2': l.phone_2, 'Email': l.email,
      'Ward': l.ward, 'Wilaya': l.district, 'Mkoa': l.region, 'Aina': l.lead_type,
      'Ubora': l.contact_quality, 'Status': l.status,
      'Facebook': l.facebook_url, 'FB Status': l.facebook_status,
      'Instagram': l.instagram_url, 'IG Status': l.instagram_status,
      'TikTok': l.tiktok_url, 'TT Status': l.tiktok_status,
      'WhatsApp': l.whatsapp_number,
      'Social Score': l.social_score,
      'Duplicate': l.is_duplicate ? 'Ndiyo' : 'Hapana',
      'Dead': l.is_dead_lead ? 'Ndiyo' : 'Hapana',
      'Maelezo': l.notes, 'Tarehe': l.created_at,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const activeFilterCount = [qualityFilter, typeFilter, statusFilter, socialFilter].filter(Boolean).length + (showDups ? 1 : 0) + (showDead ? 1 : 0)

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ═══ HEADER ════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ti ti-users text-white text-lg" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-sm leading-tight">Leads Management</h1>
              <p className="text-xs text-gray-400 truncate">
                {statsLoading ? '…' : `${stats.total.toLocaleString()} leads · ${stats.high.toLocaleString()} ubora juu`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50">
              <i className="ti ti-plus" aria-hidden="true" /> Ongeza
            </button>
            <button onClick={handleVerify} disabled={verifying}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {verifying ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> : <i className="ti ti-brand-facebook" aria-hidden="true" />}
              {verifying ? 'Inacheki…' : 'Check Social'}
            </button>
            <button onClick={handleExport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">
              <i className="ti ti-download" aria-hidden="true" /> Export
            </button>
            <button onClick={() => { setShowImportModal(true); setImportResult(null); setImportFile(null) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-xs font-bold rounded-xl hover:bg-primary-600">
              <i className="ti ti-table-import" aria-hidden="true" />
              <span className="hidden sm:inline">Import Excel</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex-1 w-full">

        {/* ═══ STATS CARDS ═══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-4">
          {[
            { label:'Zote',        val: stats.total,        bg:'bg-slate-50',   border:'border-slate-200',   text:'text-slate-800',   small:'text-slate-500',  filter: null },
            { label:'Ubora Juu',   val: stats.high,         bg:'bg-emerald-50', border:'border-emerald-200', text:'text-emerald-800', small:'text-emerald-600',filter: 'high' },
            { label:'Wastani',     val: stats.medium,       bg:'bg-amber-50',   border:'border-amber-200',   text:'text-amber-800',   small:'text-amber-600',  filter: 'medium' },
            { label:'Chini',       val: stats.low,          bg:'bg-orange-50',  border:'border-orange-200',  text:'text-orange-800',  small:'text-orange-600', filter: 'low' },
            { label:'Amekufa',     val: stats.dead,         bg:'bg-red-50',     border:'border-red-200',     text:'text-red-700',     small:'text-red-500',    filter: 'dead' },
            { label:'Duplicates',  val: stats.duplicates,   bg:'bg-gray-50',    border:'border-gray-200',    text:'text-gray-700',    small:'text-gray-500',   filter: 'dup' },
            { label:'WhatsApp',    val: stats.has_whatsapp, bg:'bg-green-50',   border:'border-green-200',   text:'text-green-800',   small:'text-green-600',  filter: 'whatsapp' },
            { label:'Social',      val: stats.has_facebook + stats.has_instagram + stats.has_tiktok, bg:'bg-purple-50', border:'border-purple-200', text:'text-purple-800', small:'text-purple-600', filter: 'active_social' },
          ].map((s) => {
            const isActive = (s.filter === 'high' && qualityFilter === 'high') ||
              (s.filter === 'medium' && qualityFilter === 'medium') ||
              (s.filter === 'low' && qualityFilter === 'low') ||
              (s.filter === 'dead' && showDead) ||
              (s.filter === 'dup' && showDups) ||
              (s.filter === 'whatsapp' && socialFilter === 'has_whatsapp') ||
              (s.filter === 'active_social' && socialFilter === 'active_social')
            return (
              <button key={s.label}
                onClick={() => {
                  if (!s.filter) return
                  setPage(1)
                  if (s.filter === 'dup')          { setShowDups(p => !p) }
                  else if (s.filter === 'dead')    { setShowDead(p => !p); setQualityFilter('') }
                  else if (s.filter === 'whatsapp'){ setSocialFilter(p => p === 'has_whatsapp' ? '' : 'has_whatsapp') }
                  else if (s.filter === 'active_social') { setSocialFilter(p => p === 'active_social' ? '' : 'active_social') }
                  else setQualityFilter(p => p === s.filter ? '' : s.filter!)
                }}
                className={`${s.bg} border ${s.border} rounded-2xl p-3 text-left transition-all ${s.filter ? 'cursor-pointer hover:scale-[0.98]' : ''} ${isActive ? 'ring-2 ring-offset-1 ring-primary-400' : ''}`}
              >
                <p className={`text-xl font-extrabold tabular-nums ${s.text}`}>{statsLoading ? '—' : s.val.toLocaleString()}</p>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mt-0.5 ${s.small}`}>{s.label}</p>
              </button>
            )
          })}
        </div>

        {/* ═══ FILTER BAR ════════════════════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 shadow-sm">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" aria-hidden="true" />
              <input type="text" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Tafuta jina, simu, ward…"
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button onClick={() => setShowFilters(f => !f)}
              className={`relative sm:hidden flex items-center gap-1 px-3 py-2 border rounded-xl text-xs font-medium transition-colors ${activeFilterCount > 0 || showFilters ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
              <i className="ti ti-adjustments-horizontal" aria-hidden="true" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>

            <div className="hidden sm:flex gap-2 flex-wrap">
              <select value={typeFilter}    onChange={e => { setTypeFilter(e.target.value);    setPage(1) }} className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Aina zote</option>
                <option value="dalali">Madalali</option>
                <option value="mteja">Wateja</option>
                <option value="owner">Wamiliki</option>
              </select>
              <select value={socialFilter}  onChange={e => { setSocialFilter(e.target.value);  setPage(1) }} className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Social zote</option>
                <option value="active_social">Wana social hai</option>
                <option value="has_facebook">Wana Facebook</option>
                <option value="has_instagram">Wana Instagram</option>
                <option value="has_tiktok">Wana TikTok</option>
                <option value="none">Hawana social</option>
              </select>
              <select value={statusFilter}  onChange={e => { setStatusFilter(e.target.value);  setPage(1) }} className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Status zote</option>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {activeFilterCount > 0 && (
                <button onClick={() => { setSearch(''); setQualityFilter(''); setTypeFilter(''); setStatusFilter(''); setSocialFilter(''); setShowDups(false); setShowDead(false); setPage(1) }}
                  className="px-2.5 py-2 text-xs text-red-500 border border-red-100 rounded-xl hover:bg-red-50">
                  <i className="ti ti-x" aria-hidden="true" /> Futa
                </button>
              )}
            </div>

            <button onClick={() => setShowAddModal(true)}
              className="sm:hidden w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200">
              <i className="ti ti-plus" aria-hidden="true" />
            </button>
          </div>

          {showFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
              <select value={typeFilter}   onChange={e => { setTypeFilter(e.target.value);   setPage(1) }} className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Aina zote</option><option value="dalali">Madalali</option><option value="mteja">Wateja</option><option value="owner">Wamiliki</option>
              </select>
              <select value={socialFilter} onChange={e => { setSocialFilter(e.target.value); setPage(1) }} className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Social zote</option><option value="active_social">Social hai</option><option value="has_facebook">Facebook</option><option value="has_instagram">Instagram</option><option value="has_tiktok">TikTok</option>
              </select>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none col-span-2">
                <option value="">Status zote</option>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ═══ DESKTOP TABLE ═════════════════════════════════════════════════ */}
        <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">
              {loading
                ? <span className="flex items-center gap-1.5"><i className="ti ti-loader-2 animate-spin text-primary-400" aria-hidden="true" /> Inapakia…</span>
                : <>{total.toLocaleString()} lead{total !== 1 ? 's' : ''}{activeFilterCount > 0 && <span className="text-primary-500 ml-1">(imechujwa)</span>}</>
              }
            </p>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{selectedIds.size} zimechaguliwa</span>
                <button onClick={handleVerify} disabled={verifying}
                  className="text-xs px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg font-medium hover:bg-primary-100 disabled:opacity-50">
                  {verifying ? 'Inacheki…' : 'Check Social'}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? new Set(leads.map(l => l.id)) : new Set())} checked={selectedIds.size === leads.length && leads.length > 0} className="rounded" />
                  </th>
                  {['Jina','Mawasiliano','Eneo','Social','Ubora','Status','Umri',''].map((h,i) => (
                    <th key={i} className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({length:8}).map((_,i) => (
                      <tr key={i}>{Array.from({length:9}).map((_,j) => <td key={j} className="px-3 py-4"><div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{width:`${40+j*10}%`,maxWidth:'120px'}} /></td>)}</tr>
                    ))
                  : leads.map(lead => {
                      const q = QUALITY_CFG[lead.contact_quality] || QUALITY_CFG.unknown
                      const waNum = lead.whatsapp_number || lead.phone
                      return (
                        <tr key={lead.id} onClick={() => setDetailLead(lead)}
                          className={`group cursor-pointer hover:bg-blue-50/30 transition-colors ${lead.is_duplicate ? 'opacity-60 bg-amber-50/30' : ''} ${lead.is_dead_lead ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(lead.id)}
                              onChange={e => { const n = new Set(selectedIds); e.target.checked ? n.add(lead.id) : n.delete(lead.id); setSelectedIds(n) }}
                              className="rounded" />
                          </td>

                          {/* Name + type */}
                          <td className="px-3 py-3 max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${q.dot}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">{lead.full_name}</p>
                                <p className="text-[10px] text-gray-400 capitalize">{lead.lead_type}</p>
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="px-3 py-3">
                            {lead.phone
                              ? <a href={`tel:${lead.phone}`} onClick={e=>e.stopPropagation()} className="text-xs text-blue-600 hover:underline font-medium">{lead.phone}</a>
                              : <span className="text-gray-300 text-xs">—</span>}
                            {lead.phone_2 && <p className="text-[10px] text-gray-400">{lead.phone_2}</p>}
                          </td>

                          {/* Location */}
                          <td className="px-3 py-3">
                            <p className="text-xs font-medium text-gray-700">{lead.ward || lead.district || lead.region || '—'}</p>
                            {lead.ward && (lead.district || lead.region) && <p className="text-[10px] text-gray-400">{lead.district || lead.region}</p>}
                          </td>

                          {/* Social */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              {lead.facebook_url && (
                                <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} title={`Facebook: ${lead.facebook_status}`}
                                  className={`text-sm ${(SOCIAL_CFG[lead.facebook_status]||SOCIAL_CFG.unchecked).color}`}>
                                  <i className="ti ti-brand-facebook" aria-hidden="true" />
                                </a>
                              )}
                              {lead.instagram_url && (
                                <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} title={`Instagram: ${lead.instagram_status}`}
                                  className={`text-sm ${(SOCIAL_CFG[lead.instagram_status]||SOCIAL_CFG.unchecked).color}`}>
                                  <i className="ti ti-brand-instagram" aria-hidden="true" />
                                </a>
                              )}
                              {lead.tiktok_url && (
                                <a href={lead.tiktok_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} title={`TikTok: ${lead.tiktok_status}`}
                                  className={`text-sm ${(SOCIAL_CFG[lead.tiktok_status]||SOCIAL_CFG.unchecked).color}`}>
                                  <i className="ti ti-brand-tiktok" aria-hidden="true" />
                                </a>
                              )}
                              {lead.social_score > 0 && <span className="text-[10px] text-gray-400 font-mono">{lead.social_score}</span>}
                              {!lead.has_any_social && <span className="text-gray-300 text-xs">—</span>}
                            </div>
                          </td>

                          {/* Quality */}
                          <td className="px-3 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold ${q.pill}`}>{q.label}</span>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3" onClick={e=>e.stopPropagation()}>
                            <select value={lead.status} onChange={e => handleStatusChange(lead.id, e.target.value)}
                              className={`text-[10px] px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer appearance-none ${STATUS_PILL[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                          </td>

                          {/* Age */}
                          <td className="px-3 py-3">
                            <span className="text-[10px] text-gray-400 tabular-nums">{timeAgo(lead.created_at)}</span>
                            {lead.is_duplicate && <p className="text-[10px] text-amber-600 font-medium">Duplicate</p>}
                          </td>

                          {/* WA */}
                          <td className="px-3 py-3" onClick={e=>e.stopPropagation()}>
                            {waNum && (
                              <a href={waLink(waNum, lead.full_name)} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[10px] px-2 py-1.5 rounded-lg font-bold hover:bg-green-600">
                                <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" /> WA
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>

          {/* Empty */}
          {!loading && leads.length === 0 && (
            <div className="py-20 text-center">
              <i className="ti ti-users text-5xl text-gray-300 block mb-3" aria-hidden="true" />
              <p className="font-semibold text-gray-600">{activeFilterCount > 0 ? 'Hakuna leads zinazolingana' : 'Hakuna leads bado'}</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">{activeFilterCount > 0 ? 'Badilisha filters' : 'Import Excel au ongeza lead moja kwa moja'}</p>
              <button onClick={() => setShowImportModal(true)} className="bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600">
                <i className="ti ti-table-import" aria-hidden="true" /> Import Excel
              </button>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Ukurasa <b>{page}</b> / {totalPages} · {total.toLocaleString()} jumla</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Iliyopita</button>
                {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                  const pn = Math.max(1, Math.min(totalPages-4, page-2)) + i
                  return <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-lg text-xs font-medium ${pn===page ? 'bg-primary-500 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>{pn}</button>
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Inayofuata →</button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MOBILE CARDS ══════════════════════════════════════════════════ */}
        <div className="lg:hidden space-y-2.5">
          {loading && Array.from({length:5}).map((_,i) => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}

          {!loading && leads.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center shadow-sm">
              <i className="ti ti-users text-4xl text-gray-300 block mb-3" aria-hidden="true" />
              <p className="font-semibold text-gray-600 text-sm">Hakuna leads bado</p>
              <button onClick={() => setShowImportModal(true)} className="mt-4 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold">Import Excel</button>
            </div>
          )}

          {!loading && leads.map(lead => {
            const q = QUALITY_CFG[lead.contact_quality] || QUALITY_CFG.unknown
            const waNum = lead.whatsapp_number || lead.phone
            return (
              <div key={lead.id} onClick={() => setDetailLead(lead)}
                className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${q.border} shadow-sm cursor-pointer active:scale-[0.99] transition-all ${lead.is_duplicate ? 'opacity-70' : ''}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{lead.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {lead.ward || lead.district || lead.region || '—'} · {timeAgo(lead.created_at)}
                        {lead.is_duplicate && <span className="ml-1 text-amber-600 font-medium">· Duplicate</span>}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold ${q.pill}`}>{q.label}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                    <select value={lead.status} onChange={e => handleStatusChange(lead.id, e.target.value)}
                      className={`text-[10px] px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer appearance-none ${STATUS_PILL[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    {lead.phone && <a href={`tel:${lead.phone}`} className="text-xs text-blue-600 font-medium">{lead.phone}</a>}

                    <div className="ml-auto flex items-center gap-1.5">
                      {lead.facebook_url && <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.facebook_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-facebook" aria-hidden="true" /></a>}
                      {lead.instagram_url && <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.instagram_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-instagram" aria-hidden="true" /></a>}
                      {lead.tiktok_url && <a href={lead.tiktok_url} target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.tiktok_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-tiktok" aria-hidden="true" /></a>}
                      {waNum && <a href={waLink(waNum, lead.full_name)} target="_blank" rel="noopener noreferrer" className="h-7 px-2.5 bg-[#25D366] text-white text-[10px] font-bold rounded-lg flex items-center gap-1"><i className="ti ti-brand-whatsapp" aria-hidden="true" /> WA</a>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {!loading && total > 50 && (
            <div className="flex items-center justify-between py-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium disabled:opacity-40">← Iliyopita</button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page>=totalPages} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium disabled:opacity-40">Inayofuata →</button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          LEAD DETAIL MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {detailLead && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${(QUALITY_CFG[detailLead.contact_quality]||QUALITY_CFG.unknown).dot}`} />
                <div>
                  <h3 className="font-bold text-base">{detailLead.full_name}</h3>
                  <p className="text-xs text-gray-400 capitalize">{detailLead.lead_type} · {detailLead.source}</p>
                </div>
              </div>
              <button onClick={() => setDetailLead(null)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Quality badge */}
              {detailLead.is_duplicate && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  <b>Duplicate:</b> {detailLead.duplicate_reason}
                </div>
              )}

              {/* Info grid */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                {[
                  { label: 'Simu', val: detailLead.phone, href: `tel:${detailLead.phone}` },
                  { label: 'Simu 2', val: detailLead.phone_2, href: `tel:${detailLead.phone_2}` },
                  { label: 'Email', val: detailLead.email, href: `mailto:${detailLead.email}` },
                  { label: 'Ward', val: detailLead.ward },
                  { label: 'Wilaya', val: detailLead.district },
                  { label: 'Mkoa', val: detailLead.region },
                  { label: 'Anwani', val: detailLead.address },
                ].filter(r => r.val).map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    {row.href
                      ? <a href={row.href} className="text-xs font-semibold text-blue-600 hover:underline">{row.val}</a>
                      : <span className="text-xs font-semibold text-gray-800">{row.val}</span>
                    }
                  </div>
                ))}
              </div>

              {/* Social media */}
              {detailLead.has_any_social && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Social Media</p>
                  <div className="grid grid-cols-2 gap-2">
                    {detailLead.facebook_url && (
                      <a href={detailLead.facebook_url} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.facebook_status]||SOCIAL_CFG.unchecked).color} bg-blue-50 border-blue-100`}>
                        <i className="ti ti-brand-facebook text-base" aria-hidden="true" />
                        <div>
                          <p>Facebook</p>
                          <p className="text-[10px] opacity-70">{detailLead.facebook_status}</p>
                        </div>
                      </a>
                    )}
                    {detailLead.instagram_url && (
                      <a href={detailLead.instagram_url} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.instagram_status]||SOCIAL_CFG.unchecked).color} bg-pink-50 border-pink-100`}>
                        <i className="ti ti-brand-instagram text-base" aria-hidden="true" />
                        <div>
                          <p>Instagram</p>
                          <p className="text-[10px] opacity-70">{detailLead.instagram_status}</p>
                        </div>
                      </a>
                    )}
                    {detailLead.tiktok_url && (
                      <a href={detailLead.tiktok_url} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium text-gray-800 bg-gray-100 border-gray-200`}>
                        <i className="ti ti-brand-tiktok text-base" aria-hidden="true" />
                        <div>
                          <p>TikTok</p>
                          <p className="text-[10px] opacity-70">{detailLead.tiktok_status}</p>
                        </div>
                      </a>
                    )}
                    {detailLead.whatsapp_number && (
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium text-emerald-700 bg-emerald-50 border-emerald-100`}>
                        <i className="ti ti-brand-whatsapp text-base" aria-hidden="true" />
                        <div>
                          <p>WhatsApp</p>
                          <p className="text-[10px] opacity-70">{detailLead.whatsapp_number}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailLead.notes && (
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-purple-700 mb-1">Maelezo</p>
                  <p className="text-xs text-purple-600">{detailLead.notes}</p>
                </div>
              )}

              {/* Status change */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Badilisha Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map(s => (
                    <button key={s.id} onClick={() => handleStatusChange(detailLead.id, s.id)}
                      className={`py-2 rounded-xl text-[10px] font-bold transition-all ${STATUS_PILL[s.id] || 'bg-gray-100 text-gray-600'} ${detailLead.status === s.id ? 'ring-2 ring-offset-1 ring-gray-400 scale-95' : 'hover:opacity-80'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                {(detailLead.whatsapp_number || detailLead.phone) && (
                  <a href={waLink(detailLead.whatsapp_number || detailLead.phone!, detailLead.full_name)} target="_blank" rel="noopener noreferrer"
                    className="col-span-2 flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-2xl font-bold hover:bg-green-600">
                    <i className="ti ti-brand-whatsapp text-xl" aria-hidden="true" /> Wasiliana WhatsApp
                  </a>
                )}
                <button onClick={() => handleDelete(detailLead.id, false)}
                  className="py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">
                  Futa (soft)
                </button>
                <button onClick={() => handleDelete(detailLead.id, true)}
                  className="py-2.5 border border-red-100 bg-red-50 rounded-xl text-xs font-medium text-red-600 hover:bg-red-100">
                  Futa Kabisa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          IMPORT MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <i className="ti ti-table-import text-primary-500" aria-hidden="true" /> Import Leads
              </h3>
              <button onClick={() => setShowImportModal(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            {importing ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <div>
                  <p className="font-bold text-gray-800">Inasafisha na AI…</p>
                  <p className="text-sm text-gray-400 mt-1">Claude anachanganua kila lead. Inaweza chukua dakika 2-5.</p>
                </div>
              </div>
            ) : importResult ? (
              <div className="space-y-4">
                <div className={`rounded-2xl p-5 text-center ${importResult.stats.imported > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  <i className={`ti ${importResult.stats.imported > 0 ? 'ti-circle-check text-emerald-500' : 'ti-circle-x text-red-500'} text-5xl block mb-2`} aria-hidden="true" />
                  <p className="font-bold text-xl text-gray-800">{importResult.stats.imported.toLocaleString()} leads zimeingizwa</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Jumla', val: importResult.stats.total, bg: 'bg-gray-50' },
                    { label: 'Active', val: importResult.stats.activeLeads, bg: 'bg-emerald-50' },
                    { label: 'Duplicates', val: importResult.stats.duplicates, bg: 'bg-amber-50' },
                    { label: 'Dead leads', val: importResult.stats.deadLeads, bg: 'bg-red-50' },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                      <p className="text-2xl font-bold text-gray-800">{s.val}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Social verification results */}
                {importResult.stats.socialVerified > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                      <i className="ti ti-brand-facebook" aria-hidden="true" /> Social Media — Auto-Check ({importResult.stats.socialVerified} zimechekiwa)
                    </p>
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-gray-700 font-medium">{importResult.stats.socialActive} hai (active)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-xs text-gray-700 font-medium">{importResult.stats.socialInactive} zimefungwa</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gray-300" />
                        <span className="text-xs text-gray-500">{importResult.stats.imported - importResult.stats.socialVerified} hazijachekiwa</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setImportResult(null); setImportFile(null) }}
                    className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Import Nyingine</button>
                  <button onClick={() => setShowImportModal(false)}
                    className="py-3 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600">Angalia Leads →</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1.5">Safu wima zinazotambuliwa:</p>
                  <div className="flex flex-wrap gap-1">
                    {['jina / full_name','phone / simu','ward / mtaa','district','region','facebook','instagram','tiktok','whatsapp','email','notes'].map(h => (
                      <span key={h} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">{h}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-2">Aina ya Lead</label>
                  <div className="flex gap-2">
                    {[{id:'dalali',label:'Madalali'},{id:'mteja',label:'Wateja'},{id:'owner',label:'Wamiliki'}].map(t => (
                      <button key={t.id} type="button" onClick={() => setImportLeadType(t.id)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${importLeadType === t.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label htmlFor="lead-file-upload"
                  className={`flex flex-col items-center justify-center min-h-[140px] border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${importFile ? 'border-primary-400 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'}`}>
                  {importFile ? (
                    <div className="text-center px-4">
                      <i className="ti ti-file-spreadsheet text-primary-500 text-4xl block mb-2" aria-hidden="true" />
                      <p className="font-semibold text-primary-700 text-sm truncate max-w-[240px]">{importFile.name}</p>
                      <p className="text-xs text-primary-500 mt-1">{(importFile.size/1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="text-center px-4">
                      <i className="ti ti-cloud-upload text-gray-400 text-4xl block mb-2" aria-hidden="true" />
                      <p className="font-semibold text-gray-600 text-sm">Gusa kuchagua faili</p>
                      <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p>
                    </div>
                  )}
                  <input ref={fileRef} id="lead-file-upload" type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                    onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                </label>

                <button onClick={handleImport} disabled={!importFile || importing}
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 hover:bg-primary-600 flex items-center justify-center gap-2">
                  <i className="ti ti-brain" aria-hidden="true" />
                  {importFile ? `Safisha na AI — ${importFile.name}` : 'Chagua faili kwanza'}
                </button>

                <p className="text-[10px] text-center text-gray-400">
                  Claude AI itasafisha simu, kutambua social media, na kugundua nakala moja kwa moja
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ADD MANUAL MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <i className="ti ti-user-plus text-primary-500" aria-hidden="true" /> Ongeza Lead
              </h3>
              <button onClick={() => setShowAddModal(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                {[{id:'dalali',label:'Dalali'},{id:'mteja',label:'Mteja'},{id:'owner',label:'Mwenye nyumba'}].map(t => (
                  <button key={t.id} type="button" onClick={() => setAddForm(f => ({...f, lead_type: t.id}))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${addForm.lead_type === t.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {[
                { key:'full_name',  label:'Jina Kamili *', placeholder:'Juma Hassan', type:'text' },
                { key:'phone',      label:'Simu',          placeholder:'+255712345678', type:'tel' },
                { key:'phone_2',    label:'Simu 2 (hiari)',placeholder:'+255787654321', type:'tel' },
                { key:'email',      label:'Email (hiari)', placeholder:'juma@gmail.com', type:'email' },
                { key:'ward',       label:'Ward/Mtaa',     placeholder:'Sinza, Kariakoo…', type:'text' },
                { key:'district',   label:'Wilaya (hiari)',placeholder:'Kinondoni…', type:'text' },
                { key:'whatsapp_number', label:'WhatsApp', placeholder:'+255712345678', type:'tel' },
                { key:'facebook_url',   label:'Facebook URL', placeholder:'https://facebook.com/…', type:'url' },
                { key:'instagram_url',  label:'Instagram URL',placeholder:'https://instagram.com/…', type:'url' },
                { key:'tiktok_url',     label:'TikTok URL',  placeholder:'https://tiktok.com/@…', type:'url' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-600 font-medium block mb-1">{f.label}</label>
                  <input type={f.type} value={(addForm as any)[f.key]} placeholder={f.placeholder}
                    onChange={e => setAddForm(prev => ({...prev, [f.key]: e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              ))}

              <div>
                <label className="text-xs text-gray-600 font-medium block mb-1">Maelezo (hiari)</label>
                <textarea value={addForm.notes} rows={3} placeholder="Maelezo mengine yoyote…"
                  onChange={e => setAddForm(prev => ({...prev, notes: e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              </div>

              <button onClick={handleAddManual} disabled={!addForm.full_name.trim() || addLoading}
                className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold disabled:opacity-40 hover:bg-primary-600">
                {addLoading ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> Inaongeza…</> : 'Ongeza Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
