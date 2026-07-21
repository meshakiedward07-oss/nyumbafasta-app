'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from 'react'

function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const t = url.trim()
  if (!t) return undefined
  return t.startsWith('http') ? t : `https://${t}`
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Lead = {
  id: string; full_name: string; phone: string | null; phone_2: string | null
  email: string | null; ward: string | null; district: string | null; region: string | null
  lead_type: string; source: string; notes: string | null
  facebook_url: string | null; instagram_url: string | null; tiktok_url: string | null; whatsapp_number: string | null
  facebook_status: string; instagram_status: string; tiktok_status: string; whatsapp_status: string
  social_score: number; contact_quality: string; has_valid_phone: boolean; has_any_social: boolean
  is_dead_lead: boolean; is_duplicate: boolean; duplicate_reason: string | null
  status: string; contacted_at: string | null; assigned_to: string | null
  address: string | null; created_at: string
}

type Stats = {
  total: number; high: number; medium: number; low: number; dead: number; duplicates: number
  has_whatsapp: number; has_facebook: number; has_instagram: number; has_tiktok: number; has_any_social: number
  status_new: number; status_contacted: number; status_interested: number
  status_registered: number; status_inactive: number; status_rejected: number
  assigned: number
}

type ImportResult = {
  success: boolean; batchId: string
  stats: { total: number; imported: number; duplicates: number; deadLeads: number; activeLeads: number; socialVerified: number; socialActive: number; socialInactive: number }
}

type View = 'leads' | 'pipeline' | 'takwimu' | 'ripoti'
type ReportPeriod = 'today' | 'week' | 'month'

// ── Config ─────────────────────────────────────────────────────────────────────
const EMPTY_STATS: Stats = {
  total:0, high:0, medium:0, low:0, dead:0, duplicates:0,
  has_whatsapp:0, has_facebook:0, has_instagram:0, has_tiktok:0, has_any_social:0,
  status_new:0, status_contacted:0, status_interested:0, status_registered:0, status_inactive:0, status_rejected:0,
  assigned:0,
}

const QUALITY_CFG: Record<string, { label: string; pill: string; dot: string; border: string }> = {
  high:    { label: 'Juu',         pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', border: 'border-l-emerald-400' },
  medium:  { label: 'Wastani',     pill: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400',   border: 'border-l-amber-400' },
  low:     { label: 'Chini',       pill: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-400',  border: 'border-l-orange-400' },
  dead:    { label: 'Amekufa',     pill: 'bg-red-100 text-red-600',         dot: 'bg-red-500',     border: 'border-l-red-300' },
  unknown: { label: 'Haijulikani', pill: 'bg-gray-100 text-gray-500',       dot: 'bg-gray-300',    border: 'border-l-gray-200' },
}

const SOCIAL_CFG: Record<string, { color: string }> = {
  active:    { color: 'text-emerald-500' },
  inactive:  { color: 'text-red-400' },
  not_found: { color: 'text-red-500' },
  unchecked: { color: 'text-gray-300' },
  has_number:{ color: 'text-emerald-400' },
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

const PIPELINE_STAGES = ['new', 'contacted', 'interested', 'registered']

const TABS: { id: View; label: string; icon: string }[] = [
  { id: 'leads',    label: 'Leads',    icon: 'ti-database' },
  { id: 'pipeline', label: 'Pipeline', icon: 'ti-layout-columns' },
  { id: 'takwimu',  label: 'Takwimu',  icon: 'ti-chart-bar' },
  { id: 'ripoti',   label: 'Ripoti',   icon: 'ti-file-analytics' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function BarChart({ items }: { items: { label: string; value: number; color: string; sub?: string }[] }) {
  const max = Math.max(...items.map(i => i.value), 1)
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 font-medium">
              {item.label}
              {item.sub && <span className="text-gray-400 ml-1 font-normal">{item.sub}</span>}
            </span>
            <span className="text-xs font-bold text-gray-800 tabular-nums">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${item.color}`}
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function LeadsClient() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [leads, setLeads]           = useState<Lead[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [stats, setStats]           = useState<Stats>(EMPTY_STATS)
  const [statsLoading, setStatsLoading] = useState(true)

  const [view, setView] = useState<View>('leads')

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

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Lead detail modal
  const [detailLead,    setDetailLead]    = useState<Lead | null>(null)
  const [editingNotes,  setEditingNotes]  = useState(false)
  const [notesValue,    setNotesValue]    = useState('')
  const [savingNotes,   setSavingNotes]   = useState(false)
  const [mergingWith,   setMergingWith]   = useState<string | null>(null)

  // Import
  const [importing,       setImporting]       = useState(false)
  const [importResult,    setImportResult]    = useState<ImportResult | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile,      setImportFile]      = useState<File | null>(null)
  const [importLeadType,  setImportLeadType]  = useState('dalali')
  const fileRef = useRef<HTMLInputElement>(null)

  // Social verify
  const [verifying,     setVerifying]     = useState(false)
  const [revalidatingWa,setRevalidatingWa]= useState(false)

  // Broadcast
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({ target: 'has_whatsapp', tone: 'personal', message: '' })
  const [broadcasting,    setBroadcasting]    = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; failed: number; total: number; failedNames: string[] } | null>(null)

  // Add manual
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ full_name:'', phone:'', phone_2:'', email:'', ward:'', district:'', region:'Dar es Salaam', lead_type:'dalali', facebook_url:'', instagram_url:'', tiktok_url:'', whatsapp_number:'', notes:'' })
  const [addLoading, setAddLoading] = useState(false)

  // Duplicates
  const [deletingAllDups, setDeletingAllDups] = useState(false)

  // Staff / Assign
  const [staffList,       setStaffList]       = useState<{ id: string; full_name: string; staff_title: string | null }[]>([])
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [assigningStaff,  setAssigningStaff]  = useState(false)

  // Bulk distribute (manual count)
  const [showDistributeModal, setShowDistributeModal] = useState(false)
  const [distributeStaffId,   setDistributeStaffId]   = useState('')
  const [distributeCount,     setDistributeCount]     = useState<number | ''>('')
  const [distributeQuality,   setDistributeQuality]   = useState('')
  const [distributing,        setDistributing]        = useState(false)

  // Bulk delete
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [deletingAll,      setDeletingAll]      = useState(false)

  // Ripoti
  const [reportPeriod,  setReportPeriod]  = useState<ReportPeriod>('week')
  const [reportStats,   setReportStats]   = useState<Stats | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    if (view === 'takwimu' || view === 'ripoti') return
    setLoading(true)
    try {
      // Pipeline loads all leads (no pagination) so kanban shows full journey
      const limit = view === 'pipeline' ? '1000' : '50'
      const p = new URLSearchParams({
        page: String(view === 'pipeline' ? 1 : page), limit,
        duplicates: String(showDups), dead: String(showDead),
        ...(search        && { search }),
        ...(qualityFilter && { quality: qualityFilter }),
        ...(typeFilter    && { type: typeFilter }),
        ...(statusFilter  && { status: statusFilter }),
        ...(socialFilter  && { social: socialFilter }),
      })
      const res  = await fetch(`/api/v1/leads?${p}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setTotal(data.pagination?.total || 0)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [view, page, search, qualityFilter, typeFilter, statusFilter, socialFilter, showDups, showDead])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await fetch('/api/v1/leads/stats').then(r => r.json())
      setStats(data)
    } catch { /* silent */ } finally { setStatsLoading(false) }
  }, [])

  const fetchReportStats = useCallback(async () => {
    setReportLoading(true)
    try {
      const now = new Date()
      let since = ''
      if (reportPeriod === 'today') { const d = new Date(now); d.setHours(0,0,0,0); since = d.toISOString() }
      else if (reportPeriod === 'week')  since = new Date(Date.now() - 7  * 86400000).toISOString()
      else                               since = new Date(Date.now() - 30 * 86400000).toISOString()
      const data = await fetch(`/api/v1/leads/stats?since=${encodeURIComponent(since)}`).then(r => r.json())
      setReportStats(data)
    } catch { /* silent */ } finally { setReportLoading(false) }
  }, [reportPeriod])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchStats()  }, [fetchStats])
  useEffect(() => { if (view === 'ripoti') fetchReportStats() }, [view, fetchReportStats])

  useEffect(() => {
    fetch('/api/v1/admin/staff').then(r => r.json())
      .then(d => setStaffList((d.staff ?? []).filter((s: any) => s.staff_active)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (detailLead) { setNotesValue(detailLead.notes ?? ''); setEditingNotes(false) }
  }, [detailLead?.id])

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!importFile) return
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData(); fd.append('file', importFile); fd.append('leadType', importLeadType)
      const data = await fetch('/api/v1/leads/import', { method: 'POST', body: fd }).then(r => r.json())
      if (data.success) { setImportResult(data); fetchLeads(); fetchStats(); showToast(`✅ ${data.stats.imported} leads zimeingizwa!`) }
      else showToast(data.error || 'Imeshindwa', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setImporting(false) }
  }

  async function handleVerify() {
    const ids = selectedIds.size > 0 ? [...selectedIds] : leads.filter(l => l.has_any_social).map(l => l.id)
    if (!ids.length) { showToast('Chagua leads zenye social media kwanza', false); return }
    setVerifying(true)
    try {
      const data = await fetch('/api/v1/leads/verify-social', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadIds: ids.slice(0, 20) }) }).then(r => r.json())
      showToast(`✅ Leads ${data.verified} zimecheckiwa`); fetchLeads()
    } catch { showToast('Hitilafu wakati wa kucheki', false) }
    finally { setVerifying(false) }
  }

  async function handleRevalidateWhatsapp() {
    setRevalidatingWa(true)
    try {
      const res  = await fetch('/api/v1/admin/leads/revalidate-whatsapp', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`✅ WhatsApp: ${data.active} sahihi, ${data.inactive} batili`); fetchLeads()
    } catch { showToast('Imeshindwa kufanya re-validate', false) }
    finally { setRevalidatingWa(false) }
  }

  async function handleStatusChange(id: string, status: string) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (detailLead?.id === id) setDetailLead(prev => prev ? { ...prev, status } : null)
    try {
      const body: Record<string, unknown> = { id, status }
      if (status === 'contacted') body.contacted_at = new Date().toISOString()
      await fetch('/api/v1/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch { showToast('Imeshindwa kubadilisha status', false); fetchLeads() }
  }

  async function handleMarkContacted(id: string) { await handleStatusChange(id, 'contacted'); showToast('✅ Imewekwa kama amewasiliana') }

  async function handleSaveNotes() {
    if (!detailLead) return
    setSavingNotes(true)
    try {
      await fetch('/api/v1/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: detailLead.id, notes: notesValue }) })
      setDetailLead(prev => prev ? { ...prev, notes: notesValue } : null)
      setLeads(prev => prev.map(l => l.id === detailLead.id ? { ...l, notes: notesValue } : l))
      setEditingNotes(false); showToast('✅ Maelezo yamehifadhiwa')
    } catch { showToast('Imeshindwa kuhifadhi maelezo', false) }
    finally { setSavingNotes(false) }
  }

  async function handleAssignToMe(leadId: string) {
    try {
      const userId = (await fetch('/api/v1/auth/me').then(r => r.json()))?.user?.id
      if (!userId) { showToast('Hujaingia kwenye akaunti', false); return }
      await fetch('/api/v1/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: leadId, assigned_to: userId }) })
      setDetailLead(prev => prev ? { ...prev, assigned_to: userId } : null)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: userId } : l))
      showToast('✅ Lead imekukabidhiwa')
    } catch { showToast('Imeshindwa kukabidhi lead', false) }
  }

  async function handleAssignToStaff(leadId: string, staffId: string) {
    if (!staffId) return
    setAssigningStaff(true)
    try {
      await fetch('/api/v1/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: leadId, assigned_to: staffId }) })
      const s = staffList.find(x => x.id === staffId)
      setDetailLead(prev => prev ? { ...prev, assigned_to: staffId } : null)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: staffId } : l))
      setAssigningLeadId(null); setSelectedStaffId('')
      showToast(`✅ Lead imepewa ${s?.full_name ?? 'mfanyakazi'}`)
    } catch { showToast('Imeshindwa kukabidhi lead', false) }
    finally { setAssigningStaff(false) }
  }

  async function handleBulkDistribute() {
    if (!distributeStaffId) { showToast('Chagua mfanyakazi kwanza', false); return }
    setDistributing(true)
    try {
      let body: Record<string, unknown>
      if (selectedIds.size > 0) {
        // Use explicit selection
        body = { staffId: distributeStaffId, leadIds: [...selectedIds] }
      } else if (distributeCount && Number(distributeCount) > 0) {
        // Manual count — let API pick unassigned leads
        body = { staffId: distributeStaffId, count: Number(distributeCount), quality: distributeQuality || undefined }
      } else {
        showToast('Andika idadi ya leads au chagua leads kwanza', false)
        setDistributing(false); return
      }
      const data = await fetch('/api/v1/leads/distribute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }).then(r => r.json())
      if (data.success) {
        showToast(`✅ Leads ${data.distributed} zimepewa ${data.staffName}`)
        setShowDistributeModal(false); setDistributeStaffId(''); setDistributeCount(''); setDistributeQuality(''); setSelectedIds(new Set()); fetchLeads(); fetchStats()
      } else showToast(data.error || 'Imeshindwa kugawa', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setDistributing(false) }
  }

  async function handleDeleteSelected() {
    if (!selectedIds.size) return
    if (!confirm(`Futa kabisa leads ${selectedIds.size} zilizochaguliwa?`)) return
    setDeletingSelected(true)
    try {
      const ids = [...selectedIds].join(',')
      const res = await fetch(`/api/v1/leads?ids=${encodeURIComponent(ids)}&type=hard`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showToast(`✅ Leads ${data.deleted} zimefutwa`)
        setLeads(prev => prev.filter(l => !selectedIds.has(l.id)))
        setSelectedIds(new Set()); fetchStats()
      } else showToast(data.error || 'Imeshindwa kufuta', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setDeletingSelected(false) }
  }

  async function handleDeleteAll() {
    const msg = `HATARI: Futa leads ZOTE ${total.toLocaleString()} kabisa? Hii haiwezi kurudishwa!`
    if (!confirm(msg)) return
    if (!confirm('Una uhakika? Data yote ya leads itafutwa.')) return
    setDeletingAll(true)
    try {
      const p = new URLSearchParams({ all: 'true', type: 'hard', ...(qualityFilter && { quality: qualityFilter }), ...(statusFilter && { status: statusFilter }) })
      const res = await fetch(`/api/v1/leads?${p}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showToast(`✅ Leads ${data.deleted} zote zimefutwa`)
        setLeads([]); setTotal(0); setSelectedIds(new Set()); fetchStats()
      } else showToast(data.error || 'Imeshindwa kufuta', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setDeletingAll(false) }
  }

  async function handleDelete(id: string, hard = false) {
    if (!confirm(hard ? 'Futa kabisa?' : 'Futa hii lead?')) return
    try {
      const res = await fetch(`/api/v1/leads?id=${id}&type=${hard ? 'hard' : 'soft'}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setLeads(prev => prev.filter(l => l.id !== id))
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
      setDetailLead(null); fetchStats()
    } catch { showToast('Imeshindwa kufuta lead', false) }
  }

  async function handleMerge(duplicateId: string, primaryId: string) {
    if (!confirm('Unganisha lead hizi? Duplicate itafutwa.')) return
    setMergingWith(duplicateId)
    try {
      const data = await fetch('/api/v1/leads/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ primaryId, duplicateId }) }).then(r => r.json())
      if (data.success) { setLeads(prev => prev.filter(l => l.id !== duplicateId)); setDetailLead(null); fetchStats(); showToast(`✅ Leads zimeuganishwa`) }
      else showToast(data.error || 'Imeshindwa kuunganisha', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setMergingWith(null) }
  }

  async function handleDeleteAllDuplicates() {
    if (!confirm(`Futa duplicates ${stats.duplicates} zote kabisa?`)) return
    setDeletingAllDups(true)
    try {
      const data = await fetch('/api/v1/leads/merge?type=all', { method: 'DELETE' }).then(r => r.json())
      if (data.success) { showToast(`✅ Duplicates ${data.deleted} zimefutwa`); fetchLeads(); fetchStats() }
      else showToast(data.error || 'Imeshindwa kufuta', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setDeletingAllDups(false) }
  }

  async function handleAddManual() {
    if (!addForm.full_name.trim()) { showToast('Jina linahitajika', false); return }
    setAddLoading(true)
    try {
      const data = await fetch('/api/v1/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm) }).then(r => r.json())
      if (data.success) {
        showToast('Lead imeongezwa!'); setShowAddModal(false)
        setAddForm({ full_name:'', phone:'', phone_2:'', email:'', ward:'', district:'', region:'Dar es Salaam', lead_type:'dalali', facebook_url:'', instagram_url:'', tiktok_url:'', whatsapp_number:'', notes:'' })
        fetchLeads(); fetchStats()
      } else showToast(data.error || 'Imeshindwa', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setAddLoading(false) }
  }

  async function handleExport() {
    const p = new URLSearchParams({ limit: '5000', duplicates: String(showDups), dead: String(showDead), ...(search && { search }), ...(qualityFilter && { quality: qualityFilter }), ...(typeFilter && { type: typeFilter }), ...(statusFilter && { status: statusFilter }), ...(socialFilter && { social: socialFilter }) })
    const data = await fetch(`/api/v1/leads?${p}`).then(r => r.json())
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet((data.leads || []).map((l: Lead) => ({ 'Jina': l.full_name, 'Simu': l.phone, 'Simu 2': l.phone_2, 'Email': l.email, 'Ward': l.ward, 'Wilaya': l.district, 'Mkoa': l.region, 'Aina': l.lead_type, 'Ubora': l.contact_quality, 'Status': l.status, 'Imeteuliwa': l.assigned_to ?? '', 'Facebook': l.facebook_url, 'Instagram': l.instagram_url, 'TikTok': l.tiktok_url, 'WhatsApp': l.whatsapp_number, 'Social Score': l.social_score, 'Duplicate': l.is_duplicate ? 'Ndiyo' : 'Hapana', 'Dead': l.is_dead_lead ? 'Ndiyo' : 'Hapana', 'Maelezo': l.notes, 'Tarehe': l.created_at })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Leads'); XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  async function handleBroadcast() {
    if (!broadcastForm.message.trim()) { showToast('Andika ujumbe kwanza', false); return }
    setBroadcasting(true); setBroadcastResult(null)
    try {
      const body: Record<string, unknown> = { message: broadcastForm.message, tone: broadcastForm.tone, target: broadcastForm.target }
      if (broadcastForm.target === 'selected') { if (!selectedIds.size) { showToast('Chagua leads kwanza', false); setBroadcasting(false); return }; body.leadIds = [...selectedIds] }
      const data = await fetch('/api/v1/leads/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
      if (data.ok) { setBroadcastResult({ sent: data.sent_count, failed: data.failed_count, total: data.recipients_count, failedNames: data.failed_names || [] }); showToast(`✅ Ujumbe umetumwa kwa ${data.sent_count} leads`) }
      else showToast(data.error || 'Imeshindwa', false)
    } catch { showToast('Hitilafu ya mtandao', false) }
    finally { setBroadcasting(false) }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeFilterCount = [qualityFilter, typeFilter, statusFilter, socialFilter].filter(Boolean).length + (showDups ? 1 : 0) + (showDead ? 1 : 0)

  const pipelineGroups = PIPELINE_STAGES.map(stage => ({
    stage,
    label: STATUSES.find(s => s.id === stage)?.label ?? stage,
    icon:  STATUSES.find(s => s.id === stage)?.icon ?? 'ti-circle',
    pill:  STATUS_PILL[stage] ?? 'bg-gray-100 text-gray-600',
    leads: leads.filter(l => l.status === stage),
  }))

  function switchView(v: View) {
    setView(v); setPage(1); setSelectedIds(new Set())
    if (v !== 'leads') { setShowDups(false); setShowDead(false) }
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs transition-all ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        {/* Row 1 — Title + single universal action */}
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ti ti-users text-white text-lg" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-sm leading-tight">Leads Management</h1>
              <p className="text-xs text-gray-400 truncate hidden sm:block">
                {statsLoading ? '…' : `${stats.total.toLocaleString()} leads · ${stats.high.toLocaleString()} ubora juu · ${stats.assigned.toLocaleString()} assigned`}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowImportModal(true); setImportResult(null); setImportFile(null) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white text-xs font-bold rounded-xl hover:bg-primary-600 flex-shrink-0">
            <i className="ti ti-table-import text-sm" />
            <span className="hidden sm:inline">Import Excel</span>
          </button>
        </div>

        {/* Row 2 — Tab nav */}
        <div className="px-2 sm:px-4">
          <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => switchView(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                  view === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}>
                <i className={`ti ${tab.icon} text-sm`} />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
                <span className="xs:hidden sm:hidden">{tab.label.slice(0, 4)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex-1 w-full">

        {/* ═══ TAB 1 — LEADS ════════════════════════════════════════════════ */}
        {view === 'leads' && (
          <>
            {/* Stats cards — 2 cols mobile, 4 cols sm+, scrollable on tiny screens */}
            <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4 overflow-x-auto">
              {[
                { label:'Zote',       val: stats.total,          bg:'bg-slate-50',   border:'border-slate-200',   text:'text-slate-800',   small:'text-slate-500',  f: null },
                { label:'Ubora Juu',  val: stats.high,           bg:'bg-emerald-50', border:'border-emerald-200', text:'text-emerald-800', small:'text-emerald-600',f: 'high' },
                { label:'Wastani',    val: stats.medium,         bg:'bg-amber-50',   border:'border-amber-200',   text:'text-amber-800',   small:'text-amber-600',  f: 'medium' },
                { label:'Chini',      val: stats.low,            bg:'bg-orange-50',  border:'border-orange-200',  text:'text-orange-800',  small:'text-orange-600', f: 'low' },
                { label:'Amekufa',    val: stats.dead,           bg:'bg-red-50',     border:'border-red-200',     text:'text-red-700',     small:'text-red-500',    f: 'dead' },
                { label:'Duplicates', val: stats.duplicates,     bg:'bg-gray-50',    border:'border-gray-200',    text:'text-gray-700',    small:'text-gray-500',   f: 'dup' },
                { label:'WhatsApp',   val: stats.has_whatsapp,   bg:'bg-green-50',   border:'border-green-200',   text:'text-green-800',   small:'text-green-600',  f: 'whatsapp' },
                { label:'Social',     val: stats.has_any_social, bg:'bg-purple-50',  border:'border-purple-200',  text:'text-purple-800',  small:'text-purple-600', f: 'active_social' },
              ].map((s) => {
                const isActive =
                  (s.f === 'high' && qualityFilter === 'high') || (s.f === 'medium' && qualityFilter === 'medium') ||
                  (s.f === 'low'  && qualityFilter === 'low')  || (s.f === 'dead' && showDead) ||
                  (s.f === 'dup'  && showDups) || (s.f === 'whatsapp' && socialFilter === 'has_whatsapp') ||
                  (s.f === 'active_social' && socialFilter === 'active_social')
                return (
                  <button key={s.label}
                    onClick={() => {
                      if (!s.f) return; setPage(1)
                      if (s.f === 'dup')                setShowDups(p => !p)
                      else if (s.f === 'dead')          { setShowDead(p => !p); setQualityFilter('') }
                      else if (s.f === 'whatsapp')      setSocialFilter(p => p === 'has_whatsapp' ? '' : 'has_whatsapp')
                      else if (s.f === 'active_social') setSocialFilter(p => p === 'active_social' ? '' : 'active_social')
                      else                              setQualityFilter(p => p === s.f ? '' : s.f!)
                    }}
                    className={`${s.bg} border ${s.border} rounded-xl p-2.5 sm:p-3 text-left transition-all min-w-0 ${s.f ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'} ${isActive ? 'ring-2 ring-offset-1 ring-primary-400' : ''}`}>
                    <p className={`text-base sm:text-lg font-extrabold tabular-nums leading-none ${s.text}`}>{statsLoading ? '—' : s.val.toLocaleString()}</p>
                    <p className={`text-[9px] sm:text-[10px] font-semibold mt-1 truncate ${s.small}`}>{s.label}</p>
                  </button>
                )
              })}
            </div>

            {/* Action toolbar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
                <i className="ti ti-plus text-sm" /> Ongeza
              </button>
              <button onClick={() => { setShowDistributeModal(true) }}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm">
                <i className="ti ti-users-group text-sm" /> Gawa
              </button>
              <button onClick={() => { setShowBroadcastModal(true); setBroadcastResult(null) }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white rounded-xl text-xs font-semibold hover:bg-green-600 shadow-sm">
                <i className="ti ti-brand-whatsapp text-sm" /> Broadcast
              </button>
              <button onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 shadow-sm">
                <i className="ti ti-download text-sm" /> Export
              </button>
              <button onClick={handleVerify} disabled={verifying}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 shadow-sm disabled:opacity-50">
                {verifying ? <i className="ti ti-loader-2 animate-spin text-sm" /> : <i className="ti ti-refresh text-sm" />}
                <span className="hidden sm:inline">{verifying ? 'Inacheki…' : 'Check Social'}</span>
              </button>
              <button onClick={handleRevalidateWhatsapp} disabled={revalidatingWa}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-green-200 rounded-xl text-xs font-semibold text-green-700 hover:bg-green-50 shadow-sm disabled:opacity-50">
                {revalidatingWa ? <i className="ti ti-loader-2 animate-spin text-sm" /> : <i className="ti ti-brand-whatsapp text-sm" />}
                <span className="hidden sm:inline">{revalidatingWa ? 'Inafanya…' : 'Fix WA'}</span>
              </button>

              {/* Delete actions — always visible */}
              <div className="ml-auto flex items-center gap-2">
                {selectedIds.size > 0 ? (
                  <>
                    <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1.5 rounded-xl">
                      <i className="ti ti-check mr-1" />{selectedIds.size} zimechaguliwa
                    </span>
                    <button onClick={handleDeleteSelected} disabled={deletingSelected}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-600 shadow-sm disabled:opacity-50">
                      {deletingSelected ? <i className="ti ti-loader-2 animate-spin text-sm" /> : <i className="ti ti-trash text-sm" />}
                      Futa {selectedIds.size}
                    </button>
                    <button onClick={() => setSelectedIds(new Set())}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-xl hover:bg-gray-100">Ghairi</button>
                  </>
                ) : (
                  <button onClick={handleDeleteAll} disabled={deletingAll || total === 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 shadow-sm disabled:opacity-40">
                    {deletingAll ? <i className="ti ti-loader-2 animate-spin text-sm" /> : <i className="ti ti-trash text-sm" />}
                    <span className="hidden sm:inline">Futa Zote</span>
                  </button>
                )}
              </div>
            </div>

            {/* Duplicate banner */}
            {showDups && stats.duplicates > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-amber-800 font-medium">
                  <i className="ti ti-copy mr-1.5" /><b>{stats.duplicates}</b> nakala — chagua 2 kuunganisha, au futa zote
                </p>
                <button onClick={handleDeleteAllDuplicates} disabled={deletingAllDups}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 flex-shrink-0">
                  {deletingAllDups ? <i className="ti ti-loader-2 animate-spin" /> : <i className="ti ti-trash" />} Futa Zote
                </button>
              </div>
            )}

            {/* Merge banner */}
            {showDups && selectedIds.size === 2 && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-blue-800 font-medium"><i className="ti ti-git-merge mr-1.5" />Leads 2 zimechaguliwa — unganisha?</p>
                <button disabled={mergingWith !== null} onClick={() => { const [a, b] = [...selectedIds]; handleMerge(b, a) }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 flex-shrink-0 disabled:opacity-50">
                  <i className={mergingWith ? 'ti ti-loader-2 animate-spin' : 'ti ti-git-merge'} />
                  {mergingWith ? 'Inaunganisha...' : 'Unganisha'}
                </button>
              </div>
            )}

            {/* Filter bar */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 shadow-sm space-y-2">
              {/* Search row */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    placeholder="Tafuta jina, simu, ward…"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40" />
                </div>
                <button onClick={() => setShowFilters(f => !f)}
                  className={`relative flex items-center gap-1 px-3 py-2 border rounded-xl text-xs font-semibold transition-colors ${activeFilterCount > 0 || showFilters ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <i className="ti ti-adjustments-horizontal text-sm" />
                  <span className="hidden sm:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 bg-primary-500 text-white text-[9px] font-bold rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setSearchInput(''); setSearch(''); setQualityFilter(''); setTypeFilter(''); setStatusFilter(''); setSocialFilter(''); setShowDups(false); setShowDead(false); setPage(1) }}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-500 border border-red-200 rounded-xl hover:bg-red-50">
                    <i className="ti ti-x text-sm" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}
              </div>
              {/* Expanded filters */}
              {showFilters && (
                <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                    <option value="">Aina zote</option>
                    <option value="dalali">Madalali</option>
                    <option value="mteja">Wateja</option>
                    <option value="owner">Wamiliki</option>
                  </select>
                  <select value={socialFilter} onChange={e => { setSocialFilter(e.target.value); setPage(1) }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                    <option value="">Social zote</option>
                    <option value="active_social">Wana social</option>
                    <option value="has_facebook">Facebook</option>
                    <option value="has_instagram">Instagram</option>
                    <option value="has_tiktok">TikTok</option>
                    <option value="has_whatsapp">WhatsApp</option>
                    <option value="none">Hawana social</option>
                  </select>
                  <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40">
                    <option value="">Status zote</option>
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  {loading
                    ? <><i className="ti ti-loader-2 animate-spin text-primary-400" /> Inapakia…</>
                    : <>{total.toLocaleString()} leads{activeFilterCount > 0 && <span className="text-primary-500">(imechujwa)</span>}</>}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: '700px' }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="w-9 px-3 py-3">
                        <input type="checkbox" className="rounded"
                          onChange={e => setSelectedIds(e.target.checked ? new Set(leads.map(l => l.id)) : new Set())}
                          checked={selectedIds.size === leads.length && leads.length > 0} />
                      </th>
                      {['Jina & Aina','Simu','Eneo','Social','Ubora','Status','Tarehe',''].map((h,i) => (
                        <th key={i} className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading
                      ? Array.from({length:8}).map((_,i) => (
                          <tr key={i}>{Array.from({length:9}).map((_,j) => <td key={j} className="px-3 py-4"><div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{width:`${40+j*8}%`,maxWidth:'120px'}} /></td>)}</tr>
                        ))
                      : leads.map(lead => {
                          const q = QUALITY_CFG[lead.contact_quality] || QUALITY_CFG.unknown
                          const waNum = lead.whatsapp_number || lead.phone
                          const isSelected = selectedIds.has(lead.id)
                          return (
                            <tr key={lead.id} onClick={() => setDetailLead(lead)}
                              className={`group cursor-pointer hover:bg-blue-50/30 transition-colors ${lead.is_duplicate ? 'opacity-60 bg-amber-50/30' : ''} ${lead.is_dead_lead ? 'opacity-50' : ''} ${isSelected ? 'bg-primary-50/30' : ''}`}>
                              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={isSelected} className="rounded"
                                  onChange={e => { const n = new Set(selectedIds); if (e.target.checked) n.add(lead.id); else n.delete(lead.id); setSelectedIds(n) }} />
                              </td>
                              <td className="px-3 py-3 max-w-[180px]">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${q.dot}`} />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 truncate">{lead.full_name}</p>
                                    <p className="text-[10px] text-gray-400 capitalize">{lead.lead_type}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                {lead.phone ? <a href={`tel:${lead.phone}`} onClick={e=>e.stopPropagation()} className="text-xs text-blue-600 hover:underline font-medium">{lead.phone}</a> : <span className="text-gray-300 text-xs">—</span>}
                                {lead.phone_2 && <p className="text-[10px] text-gray-400">{lead.phone_2}</p>}
                              </td>
                              <td className="px-3 py-3">
                                <p className="text-xs font-medium text-gray-700">{lead.ward || lead.district || lead.region || '—'}</p>
                                {lead.ward && (lead.district || lead.region) && <p className="text-[10px] text-gray-400">{lead.district || lead.region}</p>}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1.5">
                                  {lead.facebook_url  && <a href={safeUrl(lead.facebook_url)}  target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className={`text-sm ${(SOCIAL_CFG[lead.facebook_status]||SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-facebook" /></a>}
                                  {lead.instagram_url && <a href={safeUrl(lead.instagram_url)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className={`text-sm ${(SOCIAL_CFG[lead.instagram_status]||SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-instagram" /></a>}
                                  {lead.tiktok_url    && <a href={safeUrl(lead.tiktok_url)}    target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className={`text-sm ${(SOCIAL_CFG[lead.tiktok_status]||SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-tiktok" /></a>}
                                  {lead.whatsapp_number && <span className={`text-sm ${(SOCIAL_CFG[lead.whatsapp_status]||SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-whatsapp" /></span>}
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

            {/* Mobile cards */}
            <div className="md:hidden space-y-2.5">
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
                          {lead.facebook_url  && <a href={safeUrl(lead.facebook_url)}  target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.facebook_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-facebook" /></a>}
                          {lead.instagram_url && <a href={safeUrl(lead.instagram_url)} target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.instagram_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-instagram" /></a>}
                          {lead.tiktok_url    && <a href={safeUrl(lead.tiktok_url)}    target="_blank" rel="noopener noreferrer" className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${(SOCIAL_CFG[lead.tiktok_status]||SOCIAL_CFG.unchecked).color} bg-gray-50`}><i className="ti ti-brand-tiktok" /></a>}
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
          </>
        )}

        {/* ═══ TAB 2 — PIPELINE ═══ */}
        {view === 'pipeline' && (
          <>
            {/* Pipeline search bar */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 shadow-sm flex gap-2">
              <div className="flex-1 relative">
                <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="Tafuta leads kwenye pipeline…"
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
                className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Aina zote</option>
                <option value="dalali">Madalali</option>
                <option value="mteja">Wateja</option>
                <option value="owner">Wamiliki</option>
              </select>
            </div>

            {/* Funnel summary bar */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {pipelineGroups.map((g, idx) => {
                const pct = stats.total > 0 ? Math.round((g.leads.length / Math.max(1, pipelineGroups[0].leads.length)) * 100) : 0
                const colors = ['bg-blue-500','bg-amber-400','bg-purple-500','bg-emerald-500']
                return (
                  <div key={g.stage} className="bg-white border border-gray-200 rounded-2xl px-3 py-2.5 flex items-center gap-2.5">
                    <div className={`w-2 h-10 rounded-full ${colors[idx]} opacity-80 flex-shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold text-gray-800 tabular-nums leading-tight">{loading ? '—' : g.leads.length.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-500 font-semibold truncate">{g.label}</p>
                      {idx > 0 && !loading && <p className="text-[10px] text-gray-300 font-mono">{pct}%</p>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Kanban board — horizontal scroll on mobile */}
            <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
              <div className="flex gap-3 min-w-[760px]">
                {pipelineGroups.map((group) => (
                  <div key={group.stage} className="flex-1 min-w-[200px]">
                    {/* Column header */}
                    <div className={`flex items-center justify-between px-3 py-2 rounded-2xl mb-2 ${group.pill}`}>
                      <div className="flex items-center gap-1.5">
                        <i className={`ti ${group.icon} text-sm`} />
                        <span className="text-xs font-bold">{group.label}</span>
                      </div>
                      <span className="text-xs font-extrabold tabular-nums">{group.leads.length}</span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {loading && Array.from({length:3}).map((_,i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 animate-pulse">
                          <div className="h-3 bg-gray-100 rounded-full w-3/4 mb-2" />
                          <div className="h-2.5 bg-gray-50 rounded-full w-1/2" />
                        </div>
                      ))}
                      {!loading && group.leads.length === 0 && (
                        <div className="bg-white/60 border border-dashed border-gray-200 rounded-2xl py-8 text-center">
                          <i className={`ti ${group.icon} text-2xl text-gray-300 block mb-1`} />
                          <p className="text-[10px] text-gray-400">Hakuna leads</p>
                        </div>
                      )}
                      {!loading && group.leads.map(lead => {
                        const q = QUALITY_CFG[lead.contact_quality] || QUALITY_CFG.unknown
                        const waNum = lead.whatsapp_number || lead.phone
                        return (
                          <div key={lead.id} onClick={() => setDetailLead(lead)}
                            className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${q.border} shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all p-3`}>
                            {/* Name row */}
                            <div className="flex items-start gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${q.dot} mt-1 flex-shrink-0`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-900 leading-tight truncate">{lead.full_name}</p>
                                <p className="text-[10px] text-gray-400 capitalize mt-0.5">{lead.lead_type}</p>
                              </div>
                              <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${q.pill}`}>{q.label}</span>
                            </div>

                            {/* Location + time */}
                            {(lead.ward || lead.district) && (
                              <p className="text-[10px] text-gray-400 mb-2 truncate">
                                <i className="ti ti-map-pin mr-0.5" />{lead.ward || lead.district}
                              </p>
                            )}

                            {/* Social icons */}
                            {lead.has_any_social && (
                              <div className="flex items-center gap-1 mb-2">
                                {lead.facebook_url  && <span className={`text-xs ${(SOCIAL_CFG[lead.facebook_status] ||SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-facebook" /></span>}
                                {lead.instagram_url && <span className={`text-xs ${(SOCIAL_CFG[lead.instagram_status]||SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-instagram" /></span>}
                                {lead.tiktok_url    && <span className={`text-xs ${(SOCIAL_CFG[lead.tiktok_status]   ||SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-tiktok" /></span>}
                                {lead.whatsapp_number && <span className={`text-xs ${(SOCIAL_CFG[lead.whatsapp_status]||SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-whatsapp" /></span>}
                              </div>
                            )}

                            {/* Footer row */}
                            <div className="flex items-center justify-between gap-1 mt-1">
                              <span className="text-[9px] text-gray-400 tabular-nums">{timeAgo(lead.created_at)}</span>
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                {/* Move left / right */}
                                {PIPELINE_STAGES.indexOf(group.stage) > 0 && (
                                  <button onClick={() => handleStatusChange(lead.id, PIPELINE_STAGES[PIPELINE_STAGES.indexOf(group.stage)-1])}
                                    title="Rudisha nyuma"
                                    className="w-5 h-5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                                    <i className="ti ti-chevron-left text-[10px] text-gray-500" />
                                  </button>
                                )}
                                {PIPELINE_STAGES.indexOf(group.stage) < PIPELINE_STAGES.length - 1 && (
                                  <button onClick={() => handleStatusChange(lead.id, PIPELINE_STAGES[PIPELINE_STAGES.indexOf(group.stage)+1])}
                                    title="Endelea mbele"
                                    className="w-5 h-5 rounded-lg bg-primary-50 border border-primary-200 flex items-center justify-center hover:bg-primary-100">
                                    <i className="ti ti-chevron-right text-[10px] text-primary-600" />
                                  </button>
                                )}
                                {waNum && (
                                  <a href={waLink(waNum, lead.full_name)} target="_blank" rel="noopener noreferrer"
                                    className="w-5 h-5 rounded-lg bg-[#25D366] flex items-center justify-center hover:bg-green-600">
                                    <i className="ti ti-brand-whatsapp text-[10px] text-white" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline total note */}
            {!loading && (
              <div className="mt-2 text-center">
                <p className="text-xs text-gray-400">
                  <i className="ti ti-layout-columns mr-1" />
                  Inaonyesha leads {leads.length.toLocaleString()} {total > leads.length ? `kati ya ${total.toLocaleString()} · (zaidi zinapatikana kwenye tab ya Leads)` : 'zote'}
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══ TAB 3 — TAKWIMU ═══ */}
        {view === 'takwimu' && (
          <>
            {/* 4 KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {[
                { label:'Leads Zote',     val: stats.total,          sub: 'katika mfumo',       bg:'bg-slate-800',   icon:'ti-database',      textVal:'text-white',    textSub:'text-slate-400' },
                { label:'Ubora Juu',      val: stats.high,           sub: `${stats.total ? Math.round((stats.high/stats.total)*100) : 0}% ya jumla`,   bg:'bg-emerald-600',  icon:'ti-star',          textVal:'text-white',    textSub:'text-emerald-200' },
                { label:'Wana Social',    val: stats.has_any_social, sub: `${stats.total ? Math.round((stats.has_any_social/stats.total)*100) : 0}% ya jumla`, bg:'bg-purple-600',  icon:'ti-brand-instagram', textVal:'text-white', textSub:'text-purple-200' },
                { label:'Assigned',       val: stats.assigned,       sub: `${stats.total ? Math.round((stats.assigned/stats.total)*100) : 0}% ya jumla`,  bg:'bg-indigo-600',  icon:'ti-user-check',    textVal:'text-white',    textSub:'text-indigo-200' },
              ].map(k => (
                <div key={k.label} className={`${k.bg} rounded-2xl p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <i className={`ti ${k.icon} text-white/60 text-lg`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${k.textSub}`}>{k.label}</span>
                  </div>
                  <p className={`text-3xl font-extrabold tabular-nums ${k.textVal}`}>
                    {statsLoading ? <span className="inline-block w-16 h-7 bg-white/10 rounded-lg animate-pulse" /> : k.val.toLocaleString()}
                  </p>
                  <p className={`text-xs mt-1 ${k.textSub}`}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Status funnel */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-1">Funnel ya Pipeline</h3>
                <p className="text-xs text-gray-400 mb-4">Usambazaji wa status za leads zote</p>
                {statsLoading
                  ? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="h-7 bg-gray-100 rounded-lg animate-pulse" />)}</div>
                  : <BarChart items={[
                      { label:'Mpya',          value: stats.status_new,        color:'bg-blue-400',    sub:`(${stats.total ? Math.round((stats.status_new/stats.total)*100) : 0}%)` },
                      { label:'Amewasiliana',  value: stats.status_contacted,  color:'bg-amber-400',   sub:`(${stats.total ? Math.round((stats.status_contacted/stats.total)*100) : 0}%)` },
                      { label:'Ana nia',       value: stats.status_interested, color:'bg-purple-500',  sub:`(${stats.total ? Math.round((stats.status_interested/stats.total)*100) : 0}%)` },
                      { label:'Amesajili',     value: stats.status_registered, color:'bg-emerald-500', sub:`(${stats.total ? Math.round((stats.status_registered/stats.total)*100) : 0}%)` },
                      { label:'Hana shughuli', value: stats.status_inactive,   color:'bg-gray-300' },
                      { label:'Amekataa',      value: stats.status_rejected,   color:'bg-red-400' },
                    ]} />
                }
              </div>

              {/* Quality breakdown */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-1">Ubora wa Leads</h3>
                <p className="text-xs text-gray-400 mb-4">Mgawanyo wa ubora na hali ya leads</p>
                {statsLoading
                  ? <div className="space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-7 bg-gray-100 rounded-lg animate-pulse" />)}</div>
                  : <BarChart items={[
                      { label:'Ubora Juu',    value: stats.high,     color:'bg-emerald-500', sub:`(${stats.total ? Math.round((stats.high/stats.total)*100) : 0}%)` },
                      { label:'Wastani',      value: stats.medium,   color:'bg-amber-400',   sub:`(${stats.total ? Math.round((stats.medium/stats.total)*100) : 0}%)` },
                      { label:'Chini',        value: stats.low,      color:'bg-orange-400',  sub:`(${stats.total ? Math.round((stats.low/stats.total)*100) : 0}%)` },
                      { label:'Wamekufa',     value: stats.dead,     color:'bg-red-400' },
                      { label:'Duplicates',   value: stats.duplicates,color:'bg-gray-300' },
                    ]} />
                }
                {/* Mini stats below chart */}
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-extrabold text-red-700 tabular-nums">{stats.dead.toLocaleString()}</p>
                    <p className="text-[10px] text-red-500 font-semibold mt-0.5">Dead Leads</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-extrabold text-amber-700 tabular-nums">{stats.duplicates.toLocaleString()}</p>
                    <p className="text-[10px] text-amber-500 font-semibold mt-0.5">Nakala (Dups)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social media breakdown */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-4">
              <h3 className="text-sm font-bold text-gray-800 mb-1">Social Media</h3>
              <p className="text-xs text-gray-400 mb-4">Idadi ya leads kwenye kila platform</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { platform:'WhatsApp',  val: stats.has_whatsapp,   icon:'ti-brand-whatsapp',  bg:'bg-[#25D366]',   text:'text-white', prog:'bg-white/40' },
                  { platform:'Facebook',  val: stats.has_facebook,   icon:'ti-brand-facebook',  bg:'bg-blue-600',    text:'text-white', prog:'bg-white/40' },
                  { platform:'Instagram', val: stats.has_instagram,  icon:'ti-brand-instagram', bg:'bg-pink-600',    text:'text-white', prog:'bg-white/40' },
                  { platform:'TikTok',    val: stats.has_tiktok,     icon:'ti-brand-tiktok',    bg:'bg-gray-900',    text:'text-white', prog:'bg-white/30' },
                ].map(s => {
                  const pct = stats.total > 0 ? Math.round((s.val / stats.total) * 100) : 0
                  return (
                    <div key={s.platform} className={`${s.bg} rounded-2xl p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <i className={`ti ${s.icon} ${s.text} text-xl`} />
                        <span className={`text-xs font-bold ${s.text}`}>{s.platform}</span>
                      </div>
                      <p className={`text-2xl font-extrabold tabular-nums ${s.text}`}>
                        {statsLoading ? '—' : s.val.toLocaleString()}
                      </p>
                      <div className="mt-3 h-1.5 bg-black/20 rounded-full overflow-hidden">
                        <div className={`h-full ${s.prog} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className={`text-[10px] mt-1 ${s.text} opacity-70`}>{pct}% ya leads zote</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Refresh hint */}
            <div className="text-center pb-2">
              <button onClick={fetchStats} disabled={statsLoading} className="text-xs text-gray-400 hover:text-primary-500 transition-colors">
                {statsLoading ? <><i className="ti ti-loader-2 animate-spin mr-1" />Inapakia…</> : <><i className="ti ti-refresh mr-1" />Onyesha data mpya</>}
              </button>
            </div>
          </>
        )}

        {/* ═══ TAB 4 — RIPOTI ═══ */}
        {view === 'ripoti' && (
          <>
            {/* Period selector + export */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center bg-white border border-gray-200 rounded-2xl p-1 shadow-sm gap-1">
                {([{ id:'today' as ReportPeriod, label:'Leo' },{ id:'week' as ReportPeriod, label:'Wiki' },{ id:'month' as ReportPeriod, label:'Mwezi' }]).map(p => (
                  <button key={p.id} onClick={() => setReportPeriod(p.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${reportPeriod === p.id ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <button onClick={() => {
                if (!reportStats) return
                import('xlsx').then(XLSX => {
                  const ws = XLSX.utils.json_to_sheet([{
                    'Kipindi': reportPeriod === 'today' ? 'Leo' : reportPeriod === 'week' ? 'Wiki hii' : 'Mwezi huu',
                    'Leads Zote':    reportStats.total,
                    'Ubora Juu':     reportStats.high,
                    'Assigned':      reportStats.assigned,
                    'WhatsApp':      reportStats.has_whatsapp,
                    'Mpya':          reportStats.status_new,
                    'Amewasiliana':  reportStats.status_contacted,
                    'Ana nia':       reportStats.status_interested,
                    'Amesajili':     reportStats.status_registered,
                    'Dead':          reportStats.dead,
                    'Duplicates':    reportStats.duplicates,
                  }])
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'Ripoti')
                  XLSX.writeFile(wb, `ripoti-${reportPeriod}-${new Date().toISOString().slice(0,10)}.xlsx`)
                })
              }} disabled={!reportStats}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-500 text-white text-xs font-bold rounded-xl hover:bg-primary-600 disabled:opacity-40">
                <i className="ti ti-download" /> Export Excel
              </button>
            </div>

            {/* Loading state */}
            {reportLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-14 h-14 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-gray-500">Inapakia takwimu…</p>
              </div>
            )}

            {/* Report content */}
            {!reportLoading && reportStats && (
              <>
                {/* 4 KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                  {[
                    { label:'Leads Mpya',   val: reportStats.total,        bg:'bg-primary-500',  icon:'ti-users-plus',        sub:'katika kipindi hiki' },
                    { label:'Ubora Juu',    val: reportStats.high,         bg:'bg-emerald-600',  icon:'ti-star',              sub:`ya ${reportStats.total} zilizowadia` },
                    { label:'Assigned',     val: reportStats.assigned,     bg:'bg-indigo-600',   icon:'ti-user-check',        sub:'zimepewa wafanyakazi' },
                    { label:'Wana WA',      val: reportStats.has_whatsapp, bg:'bg-[#25D366]',    icon:'ti-brand-whatsapp',    sub:'wana WhatsApp' },
                  ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-2xl p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <i className={`ti ${k.icon} text-white/60 text-lg`} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{k.label}</span>
                      </div>
                      <p className="text-3xl font-extrabold tabular-nums text-white">{k.val.toLocaleString()}</p>
                      <p className="text-xs mt-1 text-white/60">{k.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  {/* Pipeline stages */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">Hatua za Pipeline</h3>
                    <p className="text-xs text-gray-400 mb-4">Leads zilizoingia kwenye kila hatua</p>
                    <BarChart items={[
                      { label:'Mpya',          value: reportStats.status_new,        color:'bg-blue-400' },
                      { label:'Amewasiliana',  value: reportStats.status_contacted,  color:'bg-amber-400' },
                      { label:'Ana nia',       value: reportStats.status_interested, color:'bg-purple-500' },
                      { label:'Amesajili',     value: reportStats.status_registered, color:'bg-emerald-500' },
                      { label:'Amekataa',      value: reportStats.status_rejected,   color:'bg-red-400' },
                      { label:'Hana shughuli', value: reportStats.status_inactive,   color:'bg-gray-300' },
                    ]} />
                    {/* Conversion rate */}
                    {reportStats.total > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Kiwango cha usajili</span>
                          <span className="text-sm font-bold text-emerald-600 tabular-nums">
                            {Math.round((reportStats.status_registered / reportStats.total) * 100)}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.round((reportStats.status_registered / reportStats.total) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quality breakdown */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-1">Ubora wa Leads</h3>
                    <p className="text-xs text-gray-400 mb-4">Aina ya leads zilizokuja</p>
                    <BarChart items={[
                      { label:'Ubora Juu',  value: reportStats.high,     color:'bg-emerald-500', sub:`(${reportStats.total ? Math.round((reportStats.high/reportStats.total)*100) : 0}%)` },
                      { label:'Wastani',    value: reportStats.medium,   color:'bg-amber-400',   sub:`(${reportStats.total ? Math.round((reportStats.medium/reportStats.total)*100) : 0}%)` },
                      { label:'Chini',      value: reportStats.low,      color:'bg-orange-400',  sub:`(${reportStats.total ? Math.round((reportStats.low/reportStats.total)*100) : 0}%)` },
                      { label:'Wamekufa',   value: reportStats.dead,     color:'bg-red-400' },
                      { label:'Duplicates', value: reportStats.duplicates, color:'bg-gray-300' },
                    ]} />
                    {/* Social breakdown */}
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
                      {[
                        { platform:'WhatsApp', val: reportStats.has_whatsapp,  color:'text-[#25D366]', icon:'ti-brand-whatsapp' },
                        { platform:'Facebook', val: reportStats.has_facebook,  color:'text-blue-600',  icon:'ti-brand-facebook' },
                        { platform:'Instagram',val: reportStats.has_instagram, color:'text-pink-600',  icon:'ti-brand-instagram' },
                        { platform:'TikTok',   val: reportStats.has_tiktok,    color:'text-gray-800',  icon:'ti-brand-tiktok' },
                      ].map(s => (
                        <div key={s.platform} className="bg-gray-50 rounded-xl p-2.5 flex items-center gap-2">
                          <i className={`ti ${s.icon} ${s.color} text-base`} />
                          <div>
                            <p className="text-sm font-bold text-gray-800 tabular-nums">{s.val.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400">{s.platform}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Period footnote */}
                <p className="text-center text-xs text-gray-400 pb-2">
                  <i className="ti ti-clock mr-1" />
                  {reportPeriod === 'today' ? 'Kuanzia saa sifuri leo asubuhi' : reportPeriod === 'week' ? 'Siku 7 zilizopita' : 'Siku 30 zilizopita'} · Imesasishwa {new Date().toLocaleTimeString('sw-TZ', { hour:'2-digit', minute:'2-digit' })}
                </p>
              </>
            )}

            {/* Empty state */}
            {!reportLoading && !reportStats && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <i className="ti ti-file-analytics text-5xl text-gray-300" />
                <p className="font-semibold">Ripoti haijapatikana</p>
                <button onClick={fetchReportStats} className="text-xs px-4 py-2 bg-primary-500 text-white rounded-xl font-bold">Jaribu tena</button>
              </div>
            )}
          </>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          LEAD DETAIL MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {detailLead && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-y-auto max-h-[92vh]">
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
              {detailLead.is_duplicate && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  <p className="font-bold mb-1.5"><i className="ti ti-copy mr-1" />Duplicate: {detailLead.duplicate_reason}</p>
                  <button onClick={() => handleDelete(detailLead.id, true)} className="w-full py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600">
                    <i className="ti ti-trash mr-1" />Futa Duplicate
                  </button>
                </div>
              )}
              {/* Quick actions */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleMarkContacted(detailLead.id)} disabled={detailLead.status === 'contacted'}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 disabled:opacity-40">
                  <i className="ti ti-phone text-base" />Amewasiliana
                </button>
                <button onClick={() => handleAssignToMe(detailLead.id)}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-semibold hover:bg-blue-100">
                  <i className="ti ti-user-check text-base" />Kwangu
                </button>
                <button onClick={() => { setAssigningLeadId(detailLead.id); setSelectedStaffId('') }}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 text-[10px] font-semibold hover:bg-primary-100">
                  <i className="ti ti-users text-base" />Gawa Staff
                </button>
              </div>
              {/* Assign to staff panel */}
              {assigningLeadId === detailLead.id && (
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-2"><i className="ti ti-user-plus" /> Gawa kwa Mfanyakazi</p>
                  {staffList.length === 0
                    ? <p className="text-xs text-gray-400">Hakuna wafanyakazi. <a href="/admin/staff" className="text-primary-600 underline">Ongeza wafanyakazi</a></p>
                    : <>
                        <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 mb-2">
                          <option value="">— Chagua mfanyakazi —</option>
                          {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}{s.staff_title ? ` (${s.staff_title})` : ''}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => { setAssigningLeadId(null); setSelectedStaffId('') }} className="flex-1 border border-gray-200 py-1.5 rounded-xl text-xs font-medium text-gray-500">Ghairi</button>
                          <button onClick={() => handleAssignToStaff(detailLead.id, selectedStaffId)} disabled={!selectedStaffId || assigningStaff}
                            className="flex-1 bg-primary-500 text-white py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40">
                            {assigningStaff ? 'Inatuma…' : 'Kabidhi'}
                          </button>
                        </div>
                      </>
                  }
                </div>
              )}
              {/* Check social */}
              <button onClick={() => handleVerify()} disabled={verifying || !detailLead.has_any_social}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 text-xs font-semibold hover:bg-purple-100 disabled:opacity-40">
                {verifying ? <i className="ti ti-loader-2 animate-spin" /> : <i className="ti ti-refresh" />}
                Check Social Media
              </button>
              {/* Contact info */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                {([
                  { label:'Simu',    val: detailLead.phone,    href: `tel:${detailLead.phone}` },
                  { label:'Simu 2',  val: detailLead.phone_2,  href: `tel:${detailLead.phone_2}` },
                  { label:'Email',   val: detailLead.email,    href: `mailto:${detailLead.email}` },
                  { label:'Ward',    val: detailLead.ward },
                  { label:'Wilaya',  val: detailLead.district },
                  { label:'Mkoa',    val: detailLead.region },
                  { label:'Anwani',  val: detailLead.address },
                  { label:'Imewasiliana', val: detailLead.contacted_at ? new Date(detailLead.contacted_at).toLocaleString('sw-TZ') : null },
                ] as { label: string; val: string | null; href?: string }[]).filter(r => r.val).map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    {row.href
                      ? <a href={row.href} className="text-xs font-semibold text-blue-600 hover:underline">{row.val}</a>
                      : <span className="text-xs font-semibold text-gray-800">{row.val}</span>}
                  </div>
                ))}
              </div>
              {/* Social media */}
              {detailLead.has_any_social && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Social Media</p>
                  <div className="grid grid-cols-2 gap-2">
                    {detailLead.facebook_url && <a href={safeUrl(detailLead.facebook_url)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.facebook_status]||SOCIAL_CFG.unchecked).color} bg-blue-50 border-blue-100`}><i className="ti ti-brand-facebook text-base" /><div><p>Facebook</p><p className="text-[10px] opacity-70">{detailLead.facebook_status}</p></div></a>}
                    {detailLead.instagram_url && <a href={safeUrl(detailLead.instagram_url)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.instagram_status]||SOCIAL_CFG.unchecked).color} bg-pink-50 border-pink-100`}><i className="ti ti-brand-instagram text-base" /><div><p>Instagram</p><p className="text-[10px] opacity-70">{detailLead.instagram_status}</p></div></a>}
                    {detailLead.tiktok_url && <a href={safeUrl(detailLead.tiktok_url)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.tiktok_status]||SOCIAL_CFG.unchecked).color} bg-gray-100 border-gray-200`}><i className="ti ti-brand-tiktok text-base" /><div><p>TikTok</p><p className="text-[10px] opacity-70">{detailLead.tiktok_status}</p></div></a>}
                    {detailLead.whatsapp_number && <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.whatsapp_status]||SOCIAL_CFG.unchecked).color} bg-emerald-50 border-emerald-100`}><i className="ti ti-brand-whatsapp text-base" /><div><p>WhatsApp</p><p className="text-[10px] opacity-70">{detailLead.whatsapp_number} · {detailLead.whatsapp_status}</p></div></div>}
                  </div>
                </div>
              )}
              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Maelezo</p>
                  {!editingNotes
                    ? <button onClick={() => setEditingNotes(true)} className="text-[10px] text-primary-600 font-semibold hover:underline"><i className="ti ti-edit mr-0.5" />Hariri</button>
                    : <div className="flex gap-2">
                        <button onClick={() => setEditingNotes(false)} className="text-[10px] text-gray-500 hover:underline">Ghairi</button>
                        <button onClick={handleSaveNotes} disabled={savingNotes} className="text-[10px] text-primary-600 font-semibold hover:underline disabled:opacity-50">{savingNotes ? 'Inahifadhi…' : 'Hifadhi'}</button>
                      </div>
                  }
                </div>
                {editingNotes
                  ? <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={4} placeholder="Andika maelezo, logi ya mawasiliano…" className="w-full border border-primary-300 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                  : <div className={`rounded-xl px-3 py-2.5 text-xs ${detailLead.notes ? 'bg-purple-50 text-purple-800 border border-purple-100' : 'bg-gray-50 text-gray-400 border border-dashed border-gray-200'}`}>
                      {detailLead.notes || 'Bonyeza Hariri kuongeza maelezo…'}
                    </div>
                }
              </div>
              {/* Pipeline status */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hatua ya Pipeline</p>
                <div className="grid grid-cols-3 gap-2">
                  {STATUSES.map(s => (
                    <button key={s.id} onClick={() => handleStatusChange(detailLead.id, s.id)}
                      className={`py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 ${STATUS_PILL[s.id] || 'bg-gray-100 text-gray-600'} ${detailLead.status === s.id ? 'ring-2 ring-offset-1 ring-gray-400 scale-95' : 'hover:opacity-80'}`}>
                      <i className={`ti ${s.icon} text-base`} />{s.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* WhatsApp CTA */}
              {(detailLead.whatsapp_number || detailLead.phone) && (
                <a href={waLink(detailLead.whatsapp_number || detailLead.phone!, detailLead.full_name)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-2xl font-bold hover:bg-green-600">
                  <i className="ti ti-brand-whatsapp text-xl" /> Wasiliana WhatsApp
                </a>
              )}
              {/* Delete */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleDelete(detailLead.id, false)} className="py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">Futa (soft)</button>
                <button onClick={() => handleDelete(detailLead.id, true)}  className="py-2.5 border border-red-100 bg-red-50 rounded-xl text-xs font-medium text-red-600 hover:bg-red-100">Futa Kabisa</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          IMPORT MODAL
      ══════════════════════════════════════════════════════════════════════ */}
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
                <div><p className="font-bold text-gray-800">Inasafisha na AI…</p><p className="text-sm text-gray-400 mt-1">Claude anachanganua kila lead. Inaweza chukua dakika 2-5.</p></div>
              </div>
            ) : importResult ? (
              <div className="space-y-4">
                <div className={`rounded-2xl p-5 text-center ${importResult.stats.imported > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  <i className={`ti ${importResult.stats.imported > 0 ? 'ti-circle-check text-emerald-500' : 'ti-circle-x text-red-500'} text-5xl block mb-2`} />
                  <p className="font-bold text-xl text-gray-800">{importResult.stats.imported.toLocaleString()} leads zimeingizwa</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[{label:'Jumla',val:importResult.stats.total,bg:'bg-gray-50'},{label:'Active',val:importResult.stats.activeLeads,bg:'bg-emerald-50'},{label:'Duplicates',val:importResult.stats.duplicates,bg:'bg-amber-50'},{label:'Dead leads',val:importResult.stats.deadLeads,bg:'bg-red-50'}].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}><p className="text-2xl font-bold text-gray-800">{s.val}</p><p className="text-xs text-gray-500 mt-0.5">{s.label}</p></div>
                  ))}
                </div>
                {importResult.stats.socialVerified > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-800 mb-2"><i className="ti ti-brand-tiktok" /> Social ({importResult.stats.socialVerified} zimechekiwa)</p>
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
                <label htmlFor="lead-file-upload" className={`flex flex-col items-center justify-center min-h-[140px] border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${importFile ? 'border-primary-400 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'}`}>
                  {importFile
                    ? <div className="text-center px-4"><i className="ti ti-file-spreadsheet text-primary-500 text-4xl block mb-2" /><p className="font-semibold text-primary-700 text-sm truncate max-w-[240px]">{importFile.name}</p><p className="text-xs text-primary-500 mt-1">{(importFile.size/1024).toFixed(1)} KB</p></div>
                    : <div className="text-center px-4"><i className="ti ti-cloud-upload text-gray-400 text-4xl block mb-2" /><p className="font-semibold text-gray-600 text-sm">Gusa kuchagua faili</p><p className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</p></div>
                  }
                  <input ref={fileRef} id="lead-file-upload" type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                </label>
                <button onClick={handleImport} disabled={!importFile || importing}
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 hover:bg-primary-600 flex items-center justify-center gap-2">
                  <i className="ti ti-brain" />{importFile ? `Safisha na AI — ${importFile.name}` : 'Chagua faili kwanza'}
                </button>
                <p className="text-[10px] text-center text-gray-400">Claude AI itasafisha simu, kutambua social media, na kugundua nakala</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ADD MANUAL MODAL
      ══════════════════════════════════════════════════════════════════════ */}
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
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${addForm.lead_type === t.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {([
                {key:'full_name',label:'Jina Kamili *',placeholder:'Juma Hassan',type:'text'},
                {key:'phone',label:'Simu',placeholder:'+255712345678',type:'tel'},
                {key:'phone_2',label:'Simu 2 (hiari)',placeholder:'+255787654321',type:'tel'},
                {key:'email',label:'Email (hiari)',placeholder:'juma@gmail.com',type:'email'},
                {key:'ward',label:'Ward/Mtaa',placeholder:'Sinza, Kariakoo…',type:'text'},
                {key:'district',label:'Wilaya (hiari)',placeholder:'Kinondoni…',type:'text'},
                {key:'whatsapp_number',label:'WhatsApp',placeholder:'+255712345678',type:'tel'},
                {key:'facebook_url',label:'Facebook URL',placeholder:'https://facebook.com/…',type:'url'},
                {key:'instagram_url',label:'Instagram URL',placeholder:'https://instagram.com/…',type:'url'},
                {key:'tiktok_url',label:'TikTok URL',placeholder:'https://tiktok.com/@…',type:'url'},
              ] as {key:string;label:string;placeholder:string;type:string}[]).map(f => (
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

      {/* ══════════════════════════════════════════════════════════════════════
          BULK DISTRIBUTE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showDistributeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center"><i className="ti ti-users-group text-white text-base" /></span>
                Gawa Leads kwa Mfanyakazi
              </h3>
              <button onClick={() => setShowDistributeModal(false)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"><i className="ti ti-x" /></button>
            </div>
            <div className="space-y-4">

              {/* Mode indicator */}
              {selectedIds.size > 0 ? (
                <div className="bg-primary-50 border border-primary-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <i className="ti ti-checkbox text-primary-600 text-xl flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-primary-800">{selectedIds.size.toLocaleString()} leads zimechaguliwa</p>
                    <p className="text-xs text-primary-600">Leads hizi ndizo zitakazogawiwa</p>
                  </div>
                </div>
              ) : (
                /* Manual count entry */
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                    <label className="text-xs font-bold text-indigo-700 uppercase tracking-wide block mb-2">
                      <i className="ti ti-hash mr-1" />Idadi ya leads za kugawa
                    </label>
                    <input
                      type="number" min="1" max="500"
                      value={distributeCount}
                      onChange={e => setDistributeCount(e.target.value === '' ? '' : Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                      placeholder="Andika idadi (mf. 50)"
                      className="w-full border-2 border-indigo-200 rounded-xl px-4 py-3 text-2xl font-bold text-indigo-800 text-center focus:outline-none focus:border-indigo-500 bg-white"
                    />
                    <p className="text-xs text-indigo-500 mt-2 text-center">
                      Mfumo utachagua leads {distributeCount || '?'} bila assignment kutoka kwenye database · max 500
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Chuja kwa ubora (hiari)</label>
                    <select value={distributeQuality} onChange={e => setDistributeQuality(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
                      <option value="">Ubora wote</option>
                      <option value="high">Ubora Juu tu</option>
                      <option value="medium">Wastani tu</option>
                      <option value="low">Chini tu</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Staff selector */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Chagua Mfanyakazi</label>
                {staffList.length === 0
                  ? <p className="text-sm text-gray-400 py-3 text-center bg-gray-50 rounded-xl">Hakuna wafanyakazi. <a href="/admin/staff" className="text-primary-600 underline">Ongeza</a></p>
                  : <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {staffList.map(s => (
                        <button key={s.id} type="button" onClick={() => setDistributeStaffId(s.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${distributeStaffId === s.id ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-gray-100 bg-white hover:border-gray-200 text-gray-700'}`}>
                          <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">{s.full_name.charAt(0)}</div>
                          <div className="min-w-0"><p className="font-semibold truncate">{s.full_name}</p>{s.staff_title && <p className="text-xs text-gray-400">{s.staff_title}</p>}</div>
                          {distributeStaffId === s.id && <i className="ti ti-check ml-auto text-indigo-600 text-base" />}
                        </button>
                      ))}
                    </div>
                }
              </div>

              <button onClick={handleBulkDistribute}
                disabled={!distributeStaffId || distributing || staffList.length === 0 || (selectedIds.size === 0 && !distributeCount)}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm disabled:opacity-40 hover:bg-indigo-700 flex items-center justify-center gap-2">
                {distributing ? <><i className="ti ti-loader-2 animate-spin" /> Inagawa…</> : <><i className="ti ti-send" /> Gawa {selectedIds.size > 0 ? `${selectedIds.size} Leads` : distributeCount ? `Leads ${distributeCount}` : 'Leads'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          BROADCAST MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span className="w-8 h-8 bg-[#25D366] rounded-xl flex items-center justify-center"><i className="ti ti-brand-whatsapp text-white text-base" /></span>
                Tuma Ujumbe WA
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
                    <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}><p className="text-xl font-bold text-gray-800">{s.val}</p><p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p></div>
                  ))}
                </div>
                {broadcastResult.failedNames.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-3"><p className="text-xs font-semibold text-red-700 mb-1">Walishindwa:</p><p className="text-xs text-red-600">{broadcastResult.failedNames.join(', ')}</p></div>
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
                      {id:'has_whatsapp',label:'Wana WhatsApp',icon:'ti-brand-whatsapp',count:stats.has_whatsapp},
                      {id:'high',label:'Ubora Juu',icon:'ti-star',count:stats.high},
                      {id:'medium',label:'Ubora Wastani',icon:'ti-star-half',count:stats.medium},
                      {id:'dalali',label:'Madalali tu',icon:'ti-building',count:null},
                      {id:'mteja',label:'Wateja tu',icon:'ti-user',count:null},
                      {id:'new_status',label:'Status: Mpya',icon:'ti-clock',count:null},
                      {id:'all',label:'Wote (wana namba)',icon:'ti-users',count:stats.total},
                      {id:'selected',label:`Waliochaguliwa (${selectedIds.size})`,icon:'ti-checkbox',count:selectedIds.size},
                    ].map(t => (
                      <button key={t.id} type="button" onClick={() => setBroadcastForm(f => ({...f, target: t.id}))} disabled={t.id === 'selected' && selectedIds.size === 0}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium disabled:opacity-40 ${broadcastForm.target === t.id ? 'bg-[#25D366] text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        <i className={`ti ${t.icon} text-sm`} />
                        <span className="flex-1 text-left">{t.label}</span>
                        {t.count !== null && t.count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${broadcastForm.target === t.id ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Mtindo wa Ujumbe</label>
                  <div className="flex gap-2">
                    {[{id:'personal',label:'Kirafiki 😊'},{id:'formal',label:'Rasmi 📝'},{id:'urgent',label:'Haraka ⚡'}].map(t => (
                      <button key={t.id} type="button" onClick={() => setBroadcastForm(f => ({...f, tone: t.id}))}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${broadcastForm.tone === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
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
                  <textarea value={broadcastForm.message} onChange={e => setBroadcastForm(f => ({...f, message: e.target.value.slice(0,1000)}))} rows={5}
                    placeholder={`Andika ujumbe wako hapa…\n\nTumia {jina} kuingiza jina la mpokeaji.`}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none font-mono" />
                </div>
                {broadcastForm.message && (
                  <div className="bg-[#DCF8C6] rounded-2xl p-4 rounded-tl-sm border border-green-200">
                    <p className="text-[10px] text-gray-500 mb-1.5 font-semibold">MFANO — Jinsi itakavyoonekana:</p>
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
                <button onClick={handleBroadcast} disabled={!broadcastForm.message.trim() || broadcasting || (broadcastForm.target === 'selected' && selectedIds.size === 0)}
                  className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 hover:bg-green-600 flex items-center justify-center gap-2">
                  <i className="ti ti-send" /> Tuma ujumbe
                </button>
                <p className="text-[10px] text-center text-gray-400">Kiwango cha juu: leads 200 kwa broadcast · 200ms kati ya ujumbe</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
