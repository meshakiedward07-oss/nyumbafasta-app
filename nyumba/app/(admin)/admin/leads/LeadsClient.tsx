'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react'

/** Ensure social URLs stored without protocol open correctly as absolute links */
function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const t = url.trim()
  if (!t) return undefined
  return t.startsWith('http') ? t : `https://${t}`
}

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
  has_any_social: number
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
  active:    { icon: 'ti-circle-check',  color: 'text-emerald-500' },
  inactive:  { icon: 'ti-circle-x',     color: 'text-red-400' },
  not_found: { icon: 'ti-circle-x',     color: 'text-red-500' },
  unchecked: { icon: 'ti-circle-dashed', color: 'text-gray-300' },
  has_number:{ icon: 'ti-circle-check', color: 'text-emerald-400' },
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
  { id: 'new',        label: 'Mpya',          icon: 'ti-circle-dot' },
  { id: 'contacted',  label: 'Amewasiliana',  icon: 'ti-phone' },
  { id: 'interested', label: 'Ana nia',       icon: 'ti-heart' },
  { id: 'registered', label: 'Amesajili',     icon: 'ti-circle-check' },
  { id: 'inactive',   label: 'Haifanyi kazi', icon: 'ti-ban' },
  { id: 'rejected',   label: 'Amekataa',      icon: 'ti-x' },
]

// Pipeline view groups (ordered funnel stages)
const PIPELINE_STAGES = ['new', 'contacted', 'interested', 'registered']

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60)    return `${d}s`
  if (d < 3600)  return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

function waLink(num: string, name: string) {
  const clean = num.replace(/[^0-9]/g, '')
  const msg = encodeURIComponent(`Habari ${name}! Mimi ni kutoka NyumbaFasta Tanzania. Tungependa kukuomba ujisajili kwenye platform yetu ya madalali. Je, una dakika?`)
  return `https://wa.me/${clean}?text=${msg}`
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LeadsClient() {
  const [leads, setLeads]           = useState<Lead[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [stats, setStats]           = useState<Stats>({ total:0,high:0,medium:0,low:0,dead:0,duplicates:0,has_whatsapp:0,has_facebook:0,has_instagram:0,has_tiktok:0,has_any_social:0 })
  const [statsLoading, setStatsLoading] = useState(true)

  // Filters
  const [page,          setPage]          = useState(1)
  const [searchInput,   setSearchInput]   = useState('')
  const [search,        setSearch]        = useState('')
  const [qualityFilter, setQualityFilter] = useState('')
  const [typeFilter,    setTypeFilter]    = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [socialFilter,  setSocialFilter]  = useState('')
  const [showDups,      setShowDups]      = useState(false)
  const [showDead,      setShowDead]      = useState(false)
  const [showFilters,   setShowFilters]   = useState(false)
  const [pipelineMode,  setPipelineMode]  = useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Lead detail
  const [detailLead, setDetailLead]         = useState<Lead | null>(null)
  const [editingNotes, setEditingNotes]     = useState(false)
  const [notesValue,   setNotesValue]       = useState('')
  const [savingNotes,  setSavingNotes]      = useState(false)
  const [mergingWith,  setMergingWith]      = useState<string | null>(null)

  // Import
  const [importing,       setImporting]       = useState(false)
  const [importResult,    setImportResult]    = useState<ImportResult | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile,      setImportFile]      = useState<File | null>(null)
  const [importLeadType,  setImportLeadType]  = useState('dalali')
  const fileRef = useRef<HTMLInputElement>(null)

  // Verify social
  const [verifying, setVerifying] = useState(false)
  const [revalidatingWa, setRevalidatingWa] = useState(false)

  // Broadcast
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({ target: 'has_whatsapp', tone: 'personal', message: '' })
  const [broadcasting,     setBroadcasting]     = useState(false)
  const [broadcastResult,  setBroadcastResult]  = useState<{ sent: number; failed: number; total: number; failedNames: string[] } | null>(null)

  // Add manual
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ full_name:'', phone:'', phone_2:'', email:'', ward:'', district:'', region:'Dar es Salaam', lead_type:'dalali', facebook_url:'', instagram_url:'', tiktok_url:'', whatsapp_number:'', notes:'' })
  const [addLoading, setAddLoading] = useState(false)

  // Duplicate management
  const [deletingAllDups, setDeletingAllDups]   = useState(false)

  // Staff assign
  const [staffList, setStaffList]               = useState<{id:string;full_name:string;staff_title:string|null}[]>([])
  const [assigningLeadId, setAssigningLeadId]   = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId]   = useState('')
  const [assigningStaff,  setAssigningStaff]    = useState(false)

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

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchStats() }, [fetchStats])

  // Fetch active staff for assignment dropdown (lazy — once on mount)
  useEffect(() => {
    fetch('/api/v1/admin/staff')
      .then(r => r.json())
      .then(d => setStaffList((d.staff ?? []).filter((s: any) => s.staff_active)))
      .catch(() => {})
  }, [])

  // Sync notes editor when detail changes
  useEffect(() => {
    if (detailLead) { setNotesValue(detailLead.notes ?? ''); setEditingNotes(false) }
  }, [detailLead?.id])

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

  // ── Re-validate all WhatsApp numbers (format check, no HTTP) ─────────────
  async function handleRevalidateWhatsapp() {
    setRevalidatingWa(true)
    try {
      const res  = await fetch('/api/v1/admin/leads/revalidate-whatsapp', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`✅ WhatsApp: ${data.active} sahihi, ${data.inactive} batili (${data.total} jumla)`)
      fetchLeads()
    } catch { showToast('Imeshindwa kufanya re-validate', false) }
    finally { setRevalidatingWa(false) }
  }

  // ── Status change ──────────────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: string) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (detailLead?.id === id) setDetailLead(prev => prev ? { ...prev, status } : null)
    try {
      const body: Record<string, unknown> = { id, status }
      if (status === 'contacted') body.contacted_at = new Date().toISOString()
      await fetch('/api/v1/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch { showToast('Imeshindwa kubadilisha status', false); fetchLeads() }
  }

  // ── Mark contacted ─────────────────────────────────────────────────────────
  async function handleMarkContacted(id: string) {
    await handleStatusChange(id, 'contacted')
    showToast('✅ Imewekwa kama amewasiliana')
  }

  // ── Save notes ─────────────────────────────────────────────────────────────
  async function handleSaveNotes() {
    if (!detailLead) return
    setSavingNotes(true)
    try {
      await fetch('/api/v1/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: detailLead.id, notes: notesValue }),
      })
      setDetailLead(prev => prev ? { ...prev, notes: notesValue } : null)
      setLeads(prev => prev.map(l => l.id === detailLead.id ? { ...l, notes: notesValue } : l))
      setEditingNotes(false)
      showToast('✅ Maelezo yamehifadhiwa')
    } catch { showToast('Imeshindwa kuhifadhi maelezo', false) }
    finally { setSavingNotes(false) }
  }

  // ── Assign to me ───────────────────────────────────────────────────────────
  async function handleAssignToMe(leadId: string) {
    try {
      const meRes  = await fetch('/api/v1/auth/me')
      const meData = await meRes.json()
      const userId = meData?.user?.id
      if (!userId) { showToast('Hujaingia kwenye akaunti', false); return }
      await fetch('/api/v1/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, assigned_to: userId }),
      })
      setDetailLead(prev => prev ? { ...prev, assigned_to: userId } : null)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: userId } : l))
      showToast('✅ Lead imekukabidhiwa')
    } catch { showToast('Imeshindwa kukabidhi lead', false) }
  }

  // ── Assign to specific staff ───────────────────────────────────────────────
  async function handleAssignToStaff(leadId: string, staffId: string) {
    if (!staffId) return
    setAssigningStaff(true)
    try {
      await fetch('/api/v1/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, assigned_to: staffId }),
      })
      const s = staffList.find(x => x.id === staffId)
      setDetailLead(prev => prev ? { ...prev, assigned_to: staffId } : null)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: staffId } : l))
      setAssigningLeadId(null); setSelectedStaffId('')
      showToast(`✅ Lead imepewa ${s?.full_name ?? 'mfanyakazi'}`)
    } catch { showToast('Imeshindwa kukabidhi lead', false) }
    finally { setAssigningStaff(false) }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string, hard = false) {
    if (!confirm(hard ? 'Futa kabisa?' : 'Futa hii lead?')) return
    try {
      const res = await fetch(`/api/v1/leads?id=${id}&type=${hard ? 'hard' : 'soft'}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setLeads(prev => prev.filter(l => l.id !== id))
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
      setDetailLead(null)
      fetchStats()
    } catch { showToast('Imeshindwa kufuta lead', false) }
  }

  // ── Merge duplicate into another lead ──────────────────────────────────────
  async function handleMerge(duplicateId: string, primaryId: string) {
    if (!confirm('Unganisha lead hizi? Duplicate itafutwa na data yake itahamia kwenye lead ya msingi.')) return
    setMergingWith(duplicateId)
    try {
      const res  = await fetch('/api/v1/leads/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, duplicateId }),
      })
      const data = await res.json()
      if (data.success) {
        setLeads(prev => prev.filter(l => l.id !== duplicateId))
        setDetailLead(null)
        fetchStats()
        showToast(`✅ Leads zimeuganishwa (fields ${data.fieldsMerged?.length ?? 0})`)
      } else {
        showToast(data.error || 'Imeshindwa kuunganisha', false)
      }
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setMergingWith(null) }
  }

  // ── Delete ALL duplicates ──────────────────────────────────────────────────
  async function handleDeleteAllDuplicates() {
    if (!confirm(`Futa kabisa duplicates ${stats.duplicates} zote? Hii haiwezi kutenduliwa.`)) return
    setDeletingAllDups(true)
    try {
      const res  = await fetch('/api/v1/leads/merge?type=all', { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showToast(`✅ Duplicates ${data.deleted} zimefutwa`)
        fetchLeads(); fetchStats()
      } else {
        showToast(data.error || 'Imeshindwa kufuta', false)
      }
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setDeletingAllDups(false) }
  }

  // ── Add manual ─────────────────────────────────────────────────────────────
  async function handleAddManual() {
    if (!addForm.full_name.trim()) { showToast('Jina linahitajika', false); return }
    setAddLoading(true)
    try {
      const res  = await fetch('/api/v1/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) })
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
    const p = new URLSearchParams({
      limit: '5000', duplicates: String(showDups), dead: String(showDead),
      ...(search        && { search }),
      ...(qualityFilter && { quality: qualityFilter }),
      ...(typeFilter    && { type:    typeFilter }),
      ...(statusFilter  && { status:  statusFilter }),
      ...(socialFilter  && { social:  socialFilter }),
    })
    const res  = await fetch(`/api/v1/leads?${p}`)
    const data = await res.json()
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet((data.leads || []).map((l: Lead) => ({
      'Jina': l.full_name, 'Simu': l.phone, 'Simu 2': l.phone_2, 'Email': l.email,
      'Ward': l.ward, 'Wilaya': l.district, 'Mkoa': l.region, 'Aina': l.lead_type,
      'Ubora': l.contact_quality, 'Status': l.status, 'Imeteuliwa': l.assigned_to ?? '',
      'Facebook': l.facebook_url, 'FB Status': l.facebook_status,
      'Instagram': l.instagram_url, 'IG Status': l.instagram_status,
      'TikTok': l.tiktok_url, 'TT Status': l.tiktok_status,
      'WhatsApp': l.whatsapp_number, 'WA Status': l.whatsapp_status,
      'Social Score': l.social_score,
      'Duplicate': l.is_duplicate ? 'Ndiyo' : 'Hapana',
      'Dead': l.is_dead_lead ? 'Ndiyo' : 'Hapana',
      'Maelezo': l.notes, 'Tarehe': l.created_at,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── Broadcast ──────────────────────────────────────────────────────────────
  async function handleBroadcast() {
    if (!broadcastForm.message.trim()) { showToast('Andika ujumbe kwanza', false); return }
    setBroadcasting(true); setBroadcastResult(null)
    try {
      const body: Record<string, unknown> = { message: broadcastForm.message, tone: broadcastForm.tone, target: broadcastForm.target }
      if (broadcastForm.target === 'selected') {
        if (!selectedIds.size) { showToast('Chagua leads kwanza', false); setBroadcasting(false); return }
        body.leadIds = [...selectedIds]
      }
      const res  = await fetch('/api/v1/leads/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.ok) {
        setBroadcastResult({ sent: data.sent_count, failed: data.failed_count, total: data.recipients_count, failedNames: data.failed_names || [] })
        showToast(`✅ Ujumbe umetumwa kwa ${data.sent_count} leads`)
      } else showToast(data.error || 'Imeshindwa', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setBroadcasting(false) }
  }

  const activeFilterCount = [qualityFilter, typeFilter, statusFilter, socialFilter].filter(Boolean).length + (showDups ? 1 : 0) + (showDead ? 1 : 0)

  // ── Pipeline view (leads grouped by funnel stage) ──────────────────────────
  const pipelineGroups = PIPELINE_STAGES.map(stage => ({
    stage,
    label: STATUSES.find(s => s.id === stage)?.label ?? stage,
    icon:  STATUSES.find(s => s.id === stage)?.icon ?? 'ti-circle',
    pill:  STATUS_PILL[stage] ?? 'bg-gray-100 text-gray-600',
    leads: leads.filter(l => l.status === stage),
  }))

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
              <i className="ti ti-users text-white text-lg" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-sm leading-tight">Leads Management</h1>
              <p className="text-xs text-gray-400 truncate">
                {statsLoading ? '…' : `${stats.total.toLocaleString()} leads · ${stats.high.toLocaleString()} ubora juu`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Pipeline toggle */}
            <button onClick={() => setPipelineMode(p => !p)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-medium transition-colors ${pipelineMode ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <i className="ti ti-layout-columns" /> Pipeline
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50">
              <i className="ti ti-plus" /> Ongeza
            </button>
            <button onClick={handleVerify} disabled={verifying}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {verifying ? <i className="ti ti-loader-2 animate-spin" /> : <i className="ti ti-brand-tiktok" />}
              {verifying ? 'Inacheki…' : 'Check Social'}
            </button>
            <button onClick={handleRevalidateWhatsapp} disabled={revalidatingWa}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-green-200 rounded-xl text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50">
              {revalidatingWa ? <i className="ti ti-loader-2 animate-spin" /> : <i className="ti ti-brand-whatsapp" />}
              {revalidatingWa ? 'Inafanya…' : 'Fix WA'}
            </button>
            <button onClick={() => { setShowBroadcastModal(true); setBroadcastResult(null) }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white text-xs font-bold rounded-xl hover:bg-green-600">
              <i className="ti ti-brand-whatsapp" /> Tuma WA
            </button>
            <button onClick={handleExport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">
              <i className="ti ti-download" /> Export
            </button>
            <button onClick={() => { setShowImportModal(true); setImportResult(null); setImportFile(null) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-xs font-bold rounded-xl hover:bg-primary-600">
              <i className="ti ti-table-import" />
              <span className="hidden sm:inline">Import Excel</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex-1 w-full">

        {/* ═══ STATS CARDS ═══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-4">
          {[
            { label:'Zote',       val: stats.total,          bg:'bg-slate-50',   border:'border-slate-200',   text:'text-slate-800',   small:'text-slate-500',  filter: null },
            { label:'Ubora Juu',  val: stats.high,           bg:'bg-emerald-50', border:'border-emerald-200', text:'text-emerald-800', small:'text-emerald-600',filter: 'high' },
            { label:'Wastani',    val: stats.medium,         bg:'bg-amber-50',   border:'border-amber-200',   text:'text-amber-800',   small:'text-amber-600',  filter: 'medium' },
            { label:'Chini',      val: stats.low,            bg:'bg-orange-50',  border:'border-orange-200',  text:'text-orange-800',  small:'text-orange-600', filter: 'low' },
            { label:'Amekufa',    val: stats.dead,           bg:'bg-red-50',     border:'border-red-200',     text:'text-red-700',     small:'text-red-500',    filter: 'dead' },
            { label:'Duplicates', val: stats.duplicates,     bg:'bg-gray-50',    border:'border-gray-200',    text:'text-gray-700',    small:'text-gray-500',   filter: 'dup' },
            { label:'WhatsApp',   val: stats.has_whatsapp,   bg:'bg-green-50',   border:'border-green-200',   text:'text-green-800',   small:'text-green-600',  filter: 'whatsapp' },
            { label:'Social',     val: stats.has_any_social, bg:'bg-purple-50',  border:'border-purple-200',  text:'text-purple-800',  small:'text-purple-600', filter: 'active_social' },
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
                  if (s.filter === 'dup')               { setShowDups(p => !p) }
                  else if (s.filter === 'dead')         { setShowDead(p => !p); setQualityFilter('') }
                  else if (s.filter === 'whatsapp')     { setSocialFilter(p => p === 'has_whatsapp' ? '' : 'has_whatsapp') }
                  else if (s.filter === 'active_social'){ setSocialFilter(p => p === 'active_social' ? '' : 'active_social') }
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

        {/* ═══ DUPLICATE BANNER ════════════════════════════════════════════ */}
        {showDups && stats.duplicates > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-800 font-medium">
              <i className="ti ti-copy mr-1.5" />
              <b>{stats.duplicates}</b> leads zilizo nakala — chagua mbili ili kuunganisha, au futa zote mara moja
            </p>
            <button onClick={handleDeleteAllDuplicates} disabled={deletingAllDups}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 flex-shrink-0">
              {deletingAllDups ? <i className="ti ti-loader-2 animate-spin" /> : <i className="ti ti-trash" />}
              Futa Zote
            </button>
          </div>
        )}

        {/* Merge action when 2 duplicates selected */}
        {showDups && selectedIds.size === 2 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-blue-800 font-medium"><i className="ti ti-git-merge mr-1.5" />Leads 2 zimechaguliwa — unganisha?</p>
            <button
              disabled={mergingWith !== null}
              onClick={() => {
                const [a, b] = [...selectedIds]
                handleMerge(b, a)
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 flex-shrink-0 disabled:opacity-50">
              <i className={mergingWith ? 'ti ti-loader-2 animate-spin' : 'ti ti-git-merge'} />
              {mergingWith ? 'Inaunganisha...' : 'Unganisha'}
            </button>
          </div>
        )}

        {/* ═══ FILTER BAR ════════════════════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 shadow-sm">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input type="text" value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Tafuta jina, simu, ward…"
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button onClick={() => setShowFilters(f => !f)}
              className={`relative sm:hidden flex items-center gap-1 px-3 py-2 border rounded-xl text-xs font-medium transition-colors ${activeFilterCount > 0 || showFilters ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
              <i className="ti ti-adjustments-horizontal" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>

            <div className="hidden sm:flex gap-2 flex-wrap">
              <select value={typeFilter}   onChange={e => { setTypeFilter(e.target.value);   setPage(1) }} className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Aina zote</option>
                <option value="dalali">Madalali</option>
                <option value="mteja">Wateja</option>
                <option value="owner">Wamiliki</option>
              </select>
              <select value={socialFilter} onChange={e => { setSocialFilter(e.target.value); setPage(1) }} className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Social zote</option>
                <option value="active_social">Wana social yoyote</option>
                <option value="has_facebook">Wana Facebook</option>
                <option value="has_instagram">Wana Instagram</option>
                <option value="has_tiktok">Wana TikTok</option>
                <option value="has_whatsapp">Wana WhatsApp</option>
                <option value="none">Hawana social</option>
              </select>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Status zote</option>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {activeFilterCount > 0 && (
                <button onClick={() => { setSearchInput(''); setSearch(''); setQualityFilter(''); setTypeFilter(''); setStatusFilter(''); setSocialFilter(''); setShowDups(false); setShowDead(false); setPage(1) }}
                  className="px-2.5 py-2 text-xs text-red-500 border border-red-100 rounded-xl hover:bg-red-50">
                  <i className="ti ti-x" /> Futa
                </button>
              )}
            </div>
            <button onClick={() => setShowAddModal(true)}
              className="sm:hidden w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200">
              <i className="ti ti-plus" />
            </button>
          </div>

          {showFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
              <select value={typeFilter}   onChange={e => { setTypeFilter(e.target.value);   setPage(1) }} className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Aina zote</option><option value="dalali">Madalali</option><option value="mteja">Wateja</option><option value="owner">Wamiliki</option>
              </select>
              <select value={socialFilter} onChange={e => { setSocialFilter(e.target.value); setPage(1) }} className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Social zote</option><option value="active_social">Social yoyote</option><option value="has_facebook">Facebook</option><option value="has_instagram">Instagram</option><option value="has_tiktok">TikTok</option><option value="has_whatsapp">WhatsApp</option>
              </select>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white col-span-2 focus:outline-none">
                <option value="">Status zote</option>{STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ═══ PIPELINE VIEW ═════════════════════════════════════════════════ */}
        {pipelineMode && !showDups && (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {pipelineGroups.map(group => (
                <div key={group.stage} className="w-72 flex-shrink-0">
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${group.pill}`}>
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <i className={`ti ${group.icon}`} /> {group.label}
                    </span>
                    <span className="text-xs font-bold">{group.leads.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                    {loading
                      ? Array.from({length:3}).map((_,i) => <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />)
                      : group.leads.length === 0
                      ? <div className="bg-white/60 rounded-xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400">Hakuna leads</div>
                      : group.leads.map(lead => {
                          const q = QUALITY_CFG[lead.contact_quality] || QUALITY_CFG.unknown
                          const waNum = lead.whatsapp_number || lead.phone
                          return (
                            <div key={lead.id} onClick={() => setDetailLead(lead)}
                              className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 cursor-pointer hover:border-primary-300 transition-colors">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 truncate">{lead.full_name}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{lead.ward || lead.district || '—'} · {timeAgo(lead.created_at)}</p>
                                </div>
                                <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1 ${q.dot}`} />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex gap-1">
                                  {lead.facebook_url  && <i className={`ti ti-brand-facebook text-xs ${(SOCIAL_CFG[lead.facebook_status]||SOCIAL_CFG.unchecked).color}`} />}
                                  {lead.instagram_url && <i className={`ti ti-brand-instagram text-xs ${(SOCIAL_CFG[lead.instagram_status]||SOCIAL_CFG.unchecked).color}`} />}
                                  {lead.tiktok_url    && <i className={`ti ti-brand-tiktok text-xs ${(SOCIAL_CFG[lead.tiktok_status]||SOCIAL_CFG.unchecked).color}`} />}
                                  {lead.whatsapp_number && <i className={`ti ti-brand-whatsapp text-xs ${(SOCIAL_CFG[lead.whatsapp_status]||SOCIAL_CFG.unchecked).color}`} />}
                                </div>
                                <div className="flex gap-1">
                                  {waNum && (
                                    <a href={waLink(waNum, lead.full_name)} target="_blank" rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="w-6 h-6 bg-[#25D366] rounded-lg flex items-center justify-center">
                                      <i className="ti ti-brand-whatsapp text-white text-[10px]" />
                                    </a>
                                  )}
                                  <button onClick={e => { e.stopPropagation(); handleStatusChange(lead.id, group.stage === 'new' ? 'contacted' : group.stage === 'contacted' ? 'interested' : group.stage === 'interested' ? 'registered' : 'registered') }}
                                    className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-primary-100" title="Hamia hatua inayofuata">
                                    <i className="ti ti-arrow-right text-gray-500 text-[10px]" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })
                    }
                  </div>
                </div>
              ))}

              {/* Inactive / rejected columns */}
              {['inactive','rejected'].map(stage => {
                const stageLeads = leads.filter(l => l.status === stage)
                const cfg = STATUSES.find(s => s.id === stage)!
                return (
                  <div key={stage} className="w-56 flex-shrink-0">
                    <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${STATUS_PILL[stage]}`}>
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <i className={`ti ${cfg.icon}`} /> {cfg.label}
                      </span>
                      <span className="text-xs font-bold">{stageLeads.length}</span>
                    </div>
                    <div className="space-y-1 max-h-[65vh] overflow-y-auto">
                      {stageLeads.map(lead => (
                        <div key={lead.id} onClick={() => setDetailLead(lead)}
                          className="bg-white/70 rounded-xl border border-gray-100 px-3 py-2 cursor-pointer hover:border-gray-300 text-xs text-gray-500 truncate">
                          {lead.full_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ DESKTOP TABLE ═════════════════════════════════════════════════ */}
        {!pipelineMode && (
        <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">
              {loading
                ? <span className="flex items-center gap-1.5"><i className="ti ti-loader-2 animate-spin text-primary-400" /> Inapakia…</span>
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
                      const isSelected = selectedIds.has(lead.id)
                      return (
                        <tr key={lead.id} onClick={() => setDetailLead(lead)}
                          className={`group cursor-pointer hover:bg-blue-50/30 transition-colors ${lead.is_duplicate ? 'opacity-60 bg-amber-50/30' : ''} ${lead.is_dead_lead ? 'opacity-50' : ''} ${isSelected ? 'bg-primary-50/30' : ''}`}>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected}
                              onChange={e => { const n = new Set(selectedIds); if (e.target.checked) n.add(lead.id); else n.delete(lead.id); setSelectedIds(n) }}
                              className="rounded" />
                          </td>
                          <td className="px-3 py-3 max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${q.dot}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">{lead.full_name}</p>
                                <p className="text-[10px] text-gray-400 capitalize">{lead.lead_type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {lead.phone
                              ? <a href={`tel:${lead.phone}`} onClick={e=>e.stopPropagation()} className="text-xs text-blue-600 hover:underline font-medium">{lead.phone}</a>
                              : <span className="text-gray-300 text-xs">—</span>}
                            {lead.phone_2 && <p className="text-[10px] text-gray-400">{lead.phone_2}</p>}
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-xs font-medium text-gray-700">{lead.ward || lead.district || lead.region || '—'}</p>
                            {lead.ward && (lead.district || lead.region) && <p className="text-[10px] text-gray-400">{lead.district || lead.region}</p>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              {lead.facebook_url && (
                                <a href={safeUrl(lead.facebook_url)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} title={`Facebook: ${lead.facebook_status}`}
                                  className={`text-sm ${(SOCIAL_CFG[lead.facebook_status]||SOCIAL_CFG.unchecked).color}`}>
                                  <i className="ti ti-brand-facebook" />
                                </a>
                              )}
                              {lead.instagram_url && (
                                <a href={safeUrl(lead.instagram_url)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} title={`Instagram: ${lead.instagram_status}`}
                                  className={`text-sm ${(SOCIAL_CFG[lead.instagram_status]||SOCIAL_CFG.unchecked).color}`}>
                                  <i className="ti ti-brand-instagram" />
                                </a>
                              )}
                              {lead.tiktok_url && (
                                <a href={safeUrl(lead.tiktok_url)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} title={`TikTok: ${lead.tiktok_status}`}
                                  className={`text-sm ${(SOCIAL_CFG[lead.tiktok_status]||SOCIAL_CFG.unchecked).color}`}>
                                  <i className="ti ti-brand-tiktok" />
                                </a>
                              )}
                              {lead.whatsapp_number && (
                                <span title={`WhatsApp: ${lead.whatsapp_status}`}
                                  className={`text-sm ${(SOCIAL_CFG[lead.whatsapp_status]||SOCIAL_CFG.unchecked).color}`}>
                                  <i className="ti ti-brand-whatsapp" />
                                </span>
                              )}
                              {lead.social_score > 0 && <span className="text-[10px] text-gray-400 font-mono">{lead.social_score}</span>}
                              {!lead.has_any_social && <span className="text-gray-300 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold ${q.pill}`}>{q.label}</span>
                          </td>
                          <td className="px-3 py-3" onClick={e=>e.stopPropagation()}>
                            <select value={lead.status} onChange={e => handleStatusChange(lead.id, e.target.value)}
                              className={`text-[10px] px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer appearance-none ${STATUS_PILL[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-[10px] text-gray-400 tabular-nums">{timeAgo(lead.created_at)}</span>
                            {lead.is_duplicate && <p className="text-[10px] text-amber-600 font-medium">Duplicate</p>}
                            {lead.assigned_to && <p className="text-[10px] text-primary-600 font-medium flex items-center gap-0.5"><i className="ti ti-user-check" /> Assigned</p>}
                          </td>
                          <td className="px-3 py-3" onClick={e=>e.stopPropagation()}>
                            {waNum && (
                              <a href={waLink(waNum, lead.full_name)} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[10px] px-2 py-1.5 rounded-lg font-bold hover:bg-green-600">
                                <i className="ti ti-brand-whatsapp text-sm" /> WA
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

          {!loading && leads.length === 0 && (
            <div className="py-20 text-center">
              <i className="ti ti-users text-5xl text-gray-300 block mb-3" />
              <p className="font-semibold text-gray-600">{activeFilterCount > 0 ? 'Hakuna leads zinazolingana' : 'Hakuna leads bado'}</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">{activeFilterCount > 0 ? 'Badilisha filters' : 'Import Excel au ongeza lead moja kwa moja'}</p>
              <button onClick={() => setShowImportModal(true)} className="bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600">
                <i className="ti ti-table-import" /> Import Excel
              </button>
            </div>
          )}

          {!loading && total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Ukurasa <b>{page}</b> / {totalPages} · {total.toLocaleString()} jumla</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Iliyopita</button>
                {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                  const pn = Math.max(1, Math.min(totalPages-4, page-2)) + i
                  return <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-lg text-xs font-medium ${pn===page ? 'bg-primary-500 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>{pn}</button>
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Inayofuata →</button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ═══ MOBILE CARDS ══════════════════════════════════════════════════ */}
        {!pipelineMode && (
        <div className="lg:hidden space-y-2.5">
          {loading && Array.from({length:5}).map((_,i) => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          {!loading && leads.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center shadow-sm">
              <i className="ti ti-users text-4xl text-gray-300 block mb-3" />
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
                      {lead.facebook_url && <a href={safeUrl(lead.facebook_url)} target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.facebook_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-facebook" /></a>}
                      {lead.instagram_url && <a href={safeUrl(lead.instagram_url)} target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.instagram_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-instagram" /></a>}
                      {lead.tiktok_url && <a href={safeUrl(lead.tiktok_url)} target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.tiktok_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-tiktok" /></a>}
                      {waNum && <a href={waLink(waNum, lead.full_name)} target="_blank" rel="noopener noreferrer" className="h-7 px-2.5 bg-[#25D366] text-white text-[10px] font-bold rounded-lg flex items-center gap-1"><i className="ti ti-brand-whatsapp" /> WA</a>}
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
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          LEAD DETAIL MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {detailLead && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-y-auto max-h-[92vh]">
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
                <i className="ti ti-x" />
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Duplicate warning + merge helper */}
              {detailLead.is_duplicate && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  <p className="font-bold mb-1.5"><i className="ti ti-copy mr-1" />Duplicate: {detailLead.duplicate_reason}</p>
                  <p className="mb-2 opacity-80">Chagua lead nyingine kwenye orodha (bonyeza checkbox) pamoja na hii, kisha bonyeza Unganisha.</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(detailLead.id, true)}
                      className="flex-1 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600">
                      <i className="ti ti-trash mr-1" />Futa Duplicate
                    </button>
                  </div>
                </div>
              )}

              {/* ── CRM Quick Actions ─────────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleMarkContacted(detailLead.id)}
                  disabled={detailLead.status === 'contacted'}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 disabled:opacity-40">
                  <i className="ti ti-phone text-base" />
                  Amewasiliana
                </button>
                <button onClick={() => handleAssignToMe(detailLead.id)}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-semibold hover:bg-blue-100">
                  <i className="ti ti-user-check text-base" />
                  Kwangu
                </button>
                <button
                  onClick={() => { setAssigningLeadId(detailLead.id); setSelectedStaffId('') }}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 text-[10px] font-semibold hover:bg-primary-100">
                  <i className="ti ti-users text-base" />
                  Gawa Staff
                </button>
              </div>

              {/* Assign to staff inline panel */}
              {assigningLeadId === detailLead.id && (
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    <i className="ti ti-user-plus" /> Gawa kwa Mfanyakazi
                  </p>
                  {staffList.length === 0 ? (
                    <p className="text-xs text-gray-400">Hakuna wafanyakazi wanaofaa. Ongeza staff kwenye <a href="/admin/staff" className="text-primary-600 underline">ukurasa wa Wafanyakazi</a>.</p>
                  ) : (
                    <>
                      <select
                        value={selectedStaffId}
                        onChange={e => setSelectedStaffId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 mb-2"
                      >
                        <option value="">— Chagua mfanyakazi —</option>
                        {staffList.map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}{s.staff_title ? ` (${s.staff_title})` : ''}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setAssigningLeadId(null); setSelectedStaffId('') }}
                          className="flex-1 border border-gray-200 py-1.5 rounded-xl text-xs font-medium text-gray-500"
                        >
                          Ghairi
                        </button>
                        <button
                          onClick={() => handleAssignToStaff(detailLead.id, selectedStaffId)}
                          disabled={!selectedStaffId || assigningStaff}
                          className="flex-1 bg-primary-500 text-white py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
                        >
                          {assigningStaff ? 'Inatuma…' : 'Kabidhi'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Check Social */}
              <div className="grid grid-cols-1">
                <button onClick={() => handleVerify()}
                  disabled={verifying || !detailLead.has_any_social}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-semibold hover:bg-purple-100 disabled:opacity-40">
                  {verifying ? <i className="ti ti-loader-2 animate-spin text-base" /> : <i className="ti ti-refresh text-base" />}
                  Check Social Media
                </button>
              </div>

              {/* Contact info */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                {[
                  { label: 'Simu',    val: detailLead.phone,    href: `tel:${detailLead.phone}` },
                  { label: 'Simu 2',  val: detailLead.phone_2,  href: `tel:${detailLead.phone_2}` },
                  { label: 'Email',   val: detailLead.email,    href: `mailto:${detailLead.email}` },
                  { label: 'Ward',    val: detailLead.ward },
                  { label: 'Wilaya',  val: detailLead.district },
                  { label: 'Mkoa',    val: detailLead.region },
                  { label: 'Anwani', val: detailLead.address },
                  { label: 'Imewasiliana', val: detailLead.contacted_at ? new Date(detailLead.contacted_at).toLocaleString('sw-TZ') : null },
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
                      <a href={safeUrl(detailLead.facebook_url)} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.facebook_status]||SOCIAL_CFG.unchecked).color} bg-blue-50 border-blue-100`}>
                        <i className="ti ti-brand-facebook text-base" />
                        <div><p>Facebook</p><p className="text-[10px] opacity-70">{detailLead.facebook_status}</p></div>
                      </a>
                    )}
                    {detailLead.instagram_url && (
                      <a href={safeUrl(detailLead.instagram_url)} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.instagram_status]||SOCIAL_CFG.unchecked).color} bg-pink-50 border-pink-100`}>
                        <i className="ti ti-brand-instagram text-base" />
                        <div><p>Instagram</p><p className="text-[10px] opacity-70">{detailLead.instagram_status}</p></div>
                      </a>
                    )}
                    {detailLead.tiktok_url && (
                      <a href={safeUrl(detailLead.tiktok_url)} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.tiktok_status]||SOCIAL_CFG.unchecked).color} bg-gray-100 border-gray-200`}>
                        <i className="ti ti-brand-tiktok text-base" />
                        <div><p>TikTok</p><p className="text-[10px] opacity-70">{detailLead.tiktok_status}</p></div>
                      </a>
                    )}
                    {detailLead.whatsapp_number && (
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.whatsapp_status]||SOCIAL_CFG.unchecked).color} bg-emerald-50 border-emerald-100`}>
                        <i className="ti ti-brand-whatsapp text-base" />
                        <div>
                          <p>WhatsApp</p>
                          <p className="text-[10px] opacity-70">{detailLead.whatsapp_number} · {detailLead.whatsapp_status}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Notes / Maelezo ──────────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Maelezo / CRM Notes</p>
                  {!editingNotes
                    ? <button onClick={() => setEditingNotes(true)} className="text-[10px] text-primary-600 font-semibold hover:underline"><i className="ti ti-edit mr-0.5" />Hariri</button>
                    : <div className="flex gap-2">
                        <button onClick={() => setEditingNotes(false)} className="text-[10px] text-gray-500 hover:underline">Ghairi</button>
                        <button onClick={handleSaveNotes} disabled={savingNotes} className="text-[10px] text-primary-600 font-semibold hover:underline disabled:opacity-50">
                          {savingNotes ? 'Inahifadhi…' : 'Hifadhi'}
                        </button>
                      </div>
                  }
                </div>
                {editingNotes
                  ? <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={4}
                      placeholder="Andika maelezo, logi ya mawasiliano, au maelezo yoyote…"
                      className="w-full border border-primary-300 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                  : <div className={`rounded-xl px-3 py-2.5 text-xs ${detailLead.notes ? 'bg-purple-50 text-purple-800 border border-purple-100' : 'bg-gray-50 text-gray-400 border border-dashed border-gray-200'}`}>
                      {detailLead.notes || 'Bonyeza Hariri kuongeza maelezo au logi ya mawasiliano…'}
                    </div>
                }
              </div>

              {/* Status change */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hatua ya Pipeline</p>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map(s => (
                    <button key={s.id} onClick={() => handleStatusChange(detailLead.id, s.id)}
                      className={`py-2 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${STATUS_PILL[s.id] || 'bg-gray-100 text-gray-600'} ${detailLead.status === s.id ? 'ring-2 ring-offset-1 ring-gray-400 scale-95' : 'hover:opacity-80'}`}>
                      <i className={`ti ${s.icon} text-base`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary WhatsApp action */}
              {(detailLead.whatsapp_number || detailLead.phone) && (
                <a href={waLink(detailLead.whatsapp_number || detailLead.phone!, detailLead.full_name)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-2xl font-bold hover:bg-green-600">
                  <i className="ti ti-brand-whatsapp text-xl" /> Wasiliana WhatsApp
                </a>
              )}

              {/* Delete actions */}
              <div className="grid grid-cols-2 gap-3">
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

      {/* ═══ IMPORT MODAL ═══════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2"><i className="ti ti-table-import text-primary-500" /> Import Leads</h3>
              <button onClick={() => setShowImportModal(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><i className="ti ti-x" /></button>
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
                  <i className={`ti ${importResult.stats.imported > 0 ? 'ti-circle-check text-emerald-500' : 'ti-circle-x text-red-500'} text-5xl block mb-2`} />
                  <p className="font-bold text-xl text-gray-800">{importResult.stats.imported.toLocaleString()} leads zimeingizwa</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Jumla',      val: importResult.stats.total,       bg: 'bg-gray-50' },
                    { label: 'Active',     val: importResult.stats.activeLeads, bg: 'bg-emerald-50' },
                    { label: 'Duplicates', val: importResult.stats.duplicates,  bg: 'bg-amber-50' },
                    { label: 'Dead leads', val: importResult.stats.deadLeads,   bg: 'bg-red-50' },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                      <p className="text-2xl font-bold text-gray-800">{s.val}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {importResult.stats.socialVerified > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5"><i className="ti ti-brand-tiktok" /> Social Media — Auto-Check ({importResult.stats.socialVerified} zimechekiwa)</p>
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{importResult.stats.socialActive} hai</span>
                      <span className="flex items-center gap-1.5 text-xs"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{importResult.stats.socialInactive} zimefungwa</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setImportResult(null); setImportFile(null) }} className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Import Nyingine</button>
                  <button onClick={() => setShowImportModal(false)} className="py-3 bg-primary-500 text-white rounded-xl text-sm font-bold hover:bg-primary-600">Angalia Leads →</button>
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
                      <i className="ti ti-file-spreadsheet text-primary-500 text-4xl block mb-2" />
                      <p className="font-semibold text-primary-700 text-sm truncate max-w-[240px]">{importFile.name}</p>
                      <p className="text-xs text-primary-500 mt-1">{(importFile.size/1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="text-center px-4">
                      <i className="ti ti-cloud-upload text-gray-400 text-4xl block mb-2" />
                      <p className="font-semibold text-gray-600 text-sm">Gusa kuchagua faili</p>
                      <p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p>
                    </div>
                  )}
                  <input ref={fileRef} id="lead-file-upload" type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                    onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                </label>
                <button onClick={handleImport} disabled={!importFile || importing}
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 hover:bg-primary-600 flex items-center justify-center gap-2">
                  <i className="ti ti-brain" />
                  {importFile ? `Safisha na AI — ${importFile.name}` : 'Chagua faili kwanza'}
                </button>
                <p className="text-[10px] text-center text-gray-400">Claude AI itasafisha simu, kutambua social media, na kugundua nakala moja kwa moja</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ADD MANUAL MODAL ════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2"><i className="ti ti-user-plus text-primary-500" /> Ongeza Lead</h3>
              <button onClick={() => setShowAddModal(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><i className="ti ti-x" /></button>
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
                { key:'full_name',       label:'Jina Kamili *', placeholder:'Juma Hassan',         type:'text' },
                { key:'phone',           label:'Simu',          placeholder:'+255712345678',        type:'tel' },
                { key:'phone_2',         label:'Simu 2 (hiari)',placeholder:'+255787654321',        type:'tel' },
                { key:'email',           label:'Email (hiari)', placeholder:'juma@gmail.com',       type:'email' },
                { key:'ward',            label:'Ward/Mtaa',     placeholder:'Sinza, Kariakoo…',     type:'text' },
                { key:'district',        label:'Wilaya (hiari)',placeholder:'Kinondoni…',           type:'text' },
                { key:'whatsapp_number', label:'WhatsApp',      placeholder:'+255712345678',        type:'tel' },
                { key:'facebook_url',    label:'Facebook URL',  placeholder:'https://facebook.com/…',type:'url' },
                { key:'instagram_url',   label:'Instagram URL', placeholder:'https://instagram.com/…',type:'url' },
                { key:'tiktok_url',      label:'TikTok URL',    placeholder:'https://tiktok.com/@…',type:'url' },
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
                {addLoading ? <><i className="ti ti-loader-2 animate-spin" /> Inaongeza…</> : 'Ongeza Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BROADCAST MODAL ════════════════════════════════════════════════ */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center"><i className="ti ti-brand-whatsapp text-white text-base" /></span>
                Tuma Ujumbe WA kwa Leads
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><i className="ti ti-x" /></button>
            </div>

            {broadcastResult ? (
              <div className="space-y-4">
                <div className={`rounded-2xl p-6 text-center ${broadcastResult.failed === broadcastResult.total ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <i className={`ti ${broadcastResult.failed === broadcastResult.total ? 'ti-circle-x text-red-500' : 'ti-circle-check text-emerald-500'} text-5xl block mb-2`} />
                  <p className="font-bold text-2xl text-gray-800">{broadcastResult.sent.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">ujumbe umetumwa</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[{label:'Waliokusudiwa',val:broadcastResult.total,bg:'bg-gray-50'},{label:'Imefanikiwa',val:broadcastResult.sent,bg:'bg-emerald-50'},{label:'Imeshindwa',val:broadcastResult.failed,bg:'bg-red-50'}].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                      <p className="text-xl font-bold text-gray-800">{s.val}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {broadcastResult.failedNames.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Walishindwa kupokea:</p>
                    <p className="text-xs text-red-600">{broadcastResult.failedNames.join(', ')}{broadcastResult.failed > broadcastResult.failedNames.length ? `… (+${broadcastResult.failed - broadcastResult.failedNames.length} wengine)` : ''}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setBroadcastResult(null)} className="py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Tuma Tena</button>
                  <button onClick={() => setShowBroadcastModal(false)} className="py-3 bg-[#25D366] text-white rounded-xl text-sm font-bold hover:bg-green-600">Imekamilika ✓</button>
                </div>
              </div>
            ) : broadcasting ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="font-bold text-gray-800">Inatuma ujumbe…</p>
                <p className="text-sm text-gray-400">200ms kati ya kila ujumbe. Tafadhali subiri.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Watumie Nani?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'has_whatsapp', label: 'Wana WhatsApp',   icon: 'ti-brand-whatsapp', count: stats.has_whatsapp },
                      { id: 'high',         label: 'Ubora Juu',       icon: 'ti-star',            count: stats.high },
                      { id: 'medium',       label: 'Ubora Wastani',   icon: 'ti-star-half',       count: stats.medium },
                      { id: 'dalali',       label: 'Madalali tu',     icon: 'ti-building',        count: null },
                      { id: 'mteja',        label: 'Wateja tu',       icon: 'ti-user',            count: null },
                      { id: 'new_status',   label: 'Status: Mpya',    icon: 'ti-clock',           count: null },
                      { id: 'all',          label: 'Wote (wana namba)',icon: 'ti-users',           count: stats.total },
                      { id: 'selected',     label: `Waliochaguliwa (${selectedIds.size})`, icon: 'ti-checkbox', count: selectedIds.size },
                    ].map(t => (
                      <button key={t.id} type="button"
                        onClick={() => setBroadcastForm(f => ({ ...f, target: t.id }))}
                        disabled={t.id === 'selected' && selectedIds.size === 0}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all disabled:opacity-40 ${broadcastForm.target === t.id ? 'bg-[#25D366] text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        <i className={`ti ${t.icon} text-sm`} />
                        <span className="flex-1 text-left">{t.label}</span>
                        {t.count !== null && t.count > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${broadcastForm.target === t.id ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Mtindo wa Ujumbe</label>
                  <div className="flex gap-2">
                    {[{id:'personal',label:'Kirafiki 😊'},{id:'formal',label:'Rasmi 📝'},{id:'urgent',label:'Haraka ⚡'}].map(t => (
                      <button key={t.id} type="button" onClick={() => setBroadcastForm(f => ({ ...f, tone: t.id }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${broadcastForm.tone === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ujumbe Wako</label>
                    <span className={`text-[10px] font-mono ${broadcastForm.message.length > 900 ? 'text-red-500' : 'text-gray-400'}`}>{broadcastForm.message.length}/1000</span>
                  </div>
                  <textarea value={broadcastForm.message}
                    onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value.slice(0, 1000) }))}
                    rows={5} placeholder={`Andika ujumbe wako hapa…\n\nTumia {jina} kuingiza jina la mpokeaji.`}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none font-mono" />
                </div>
                {broadcastForm.message && (
                  <div className="bg-[#DCF8C6] rounded-2xl p-4 rounded-tl-sm border border-green-200">
                    <p className="text-[10px] text-gray-500 mb-1.5 font-semibold">MFANO — Jinsi itakavyoonekana kwa Juma Hassan:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {(() => {
                        const first = 'Juma'
                        let prefix = ''
                        if (broadcastForm.tone === 'personal') prefix = `Habari ${first}! 😊\n\n`
                        else if (broadcastForm.tone === 'formal') prefix = `Kwa heshima, ${first},\n\n`
                        else if (broadcastForm.tone === 'urgent') prefix = `⚡ MUHIMU — ${first},\n\n`
                        return (prefix + broadcastForm.message).replace(/\{jina\}/gi, first).replace(/\{name\}/gi, first)
                      })()}
                    </p>
                  </div>
                )}
                <button onClick={handleBroadcast}
                  disabled={!broadcastForm.message.trim() || broadcasting || (broadcastForm.target === 'selected' && selectedIds.size === 0)}
                  className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 hover:bg-green-600 flex items-center justify-center gap-2">
                  <i className="ti ti-send" />
                  Tuma kwa {broadcastForm.target === 'selected' ? `${selectedIds.size} waliochaguliwa` : broadcastForm.target === 'high' ? 'ubora juu' : broadcastForm.target === 'medium' ? 'ubora wastani' : broadcastForm.target === 'has_whatsapp' ? 'wenye WhatsApp' : broadcastForm.target === 'dalali' ? 'madalali' : broadcastForm.target === 'mteja' ? 'wateja' : broadcastForm.target === 'new_status' ? 'wapya' : 'leads zote'}
                </button>
                <p className="text-[10px] text-center text-gray-400">Kiwango cha juu ni leads 200 kwa broadcast moja · 200ms kati ya kila ujumbe</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
