'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'

function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const t = url.trim()
  return t.startsWith('http') ? t : `https://${t}`
}

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
  status: string
  contacted_at: string | null
  assigned_to: string | null
  created_at: string
}

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

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60)    return `${d}s`
  if (d < 3600)  return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

function waLink(num: string, name: string) {
  const clean = num.replace(/[^0-9]/g, '')
  const msg = encodeURIComponent(`Habari ${name}! Mimi ni kutoka NyumbaFasta Tanzania. Tungependa kukuomba ujisajili kwenye platform yetu. Je, una dakika?`)
  return `https://wa.me/${clean}?text=${msg}`
}

export default function StaffLeadsClient({
  isAdmin,
}: {
  currentUserId: string
  isAdmin: boolean
}) {
  const [leads, setLeads]           = useState<Lead[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [stats, setStats]           = useState({ total: 0, high: 0, contacted: 0, registered: 0 })

  // Filters
  const [page,          setPage]          = useState(1)
  const [searchInput,   setSearchInput]   = useState('')
  const [search,        setSearch]        = useState('')
  const [qualityFilter, setQualityFilter] = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')

  // Detail modal
  const [detailLead,   setDetailLead]   = useState<Lead | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue,   setNotesValue]   = useState('')
  const [savingNotes,  setSavingNotes]  = useState(false)

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        page: String(page), limit: '50',
        ...(search        && { search }),
        ...(qualityFilter && { quality: qualityFilter }),
        ...(statusFilter  && { status:  statusFilter }),
        // admin can see all assigned; staff auto-filtered server-side
      })
      const res  = await fetch(`/api/v1/staff/leads?${p}`)
      const data = await res.json()
      const rows: Lead[] = data.leads || []
      setLeads(rows)
      setTotal(data.pagination?.total || 0)
      setTotalPages(data.pagination?.totalPages || 1)
      // Derive stats from current page (approximate)
      setStats({
        total:      data.pagination?.total || 0,
        high:       rows.filter(l => l.contact_quality === 'high').length,
        contacted:  rows.filter(l => l.status === 'contacted').length,
        registered: rows.filter(l => l.status === 'registered').length,
      })
    } catch { /* silent */ } finally { setLoading(false) }
  }, [page, search, qualityFilter, statusFilter])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  useEffect(() => {
    if (detailLead) { setNotesValue(detailLead.notes ?? ''); setEditingNotes(false) }
  }, [detailLead?.id])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: string) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (detailLead?.id === id) setDetailLead(prev => prev ? { ...prev, status } : null)
    const body: Record<string, unknown> = { id, status }
    if (status === 'contacted') body.contacted_at = new Date().toISOString()
    try {
      await fetch('/api/v1/staff/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch { showToast('Imeshindwa kubadilisha status', false); fetchLeads() }
  }

  async function handleSaveNotes() {
    if (!detailLead) return
    setSavingNotes(true)
    try {
      await fetch('/api/v1/staff/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: detailLead.id, notes: notesValue }),
      })
      setDetailLead(prev => prev ? { ...prev, notes: notesValue } : null)
      setLeads(prev => prev.map(l => l.id === detailLead.id ? { ...l, notes: notesValue } : l))
      setEditingNotes(false)
      showToast('✅ Maelezo yamehifadhiwa')
    } catch { showToast('Imeshindwa kuhifadhi', false) }
    finally { setSavingNotes(false) }
  }

  const activeFilterCount = [qualityFilter, statusFilter].filter(Boolean).length

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ti ti-target text-white text-lg" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-sm leading-tight">
                {isAdmin ? 'Leads za Wafanyakazi Wote' : 'Leads Zangu'}
              </h1>
              <p className="text-xs text-gray-400 truncate">
                {loading ? '…' : `${total.toLocaleString()} leads zilizogawiwa`}
              </p>
            </div>
          </div>
          {isAdmin && (
            <a href="/admin/leads?tab=staff"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">
              <i className="ti ti-arrow-left" /> Rudi Leads Management
            </a>
          )}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex-1 w-full">

        {/* ── STATS CARDS ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {[
            { label: 'Jumla',       val: stats.total,      bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-800', small: 'text-slate-500',   f: null },
            { label: 'Ubora Juu',   val: stats.high,       bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', small: 'text-emerald-600', f: 'high' },
            { label: 'Amewasiliana',val: stats.contacted,  bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800', small: 'text-amber-600',   f: 'contacted' },
            { label: 'Amesajili',   val: stats.registered, bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800',  small: 'text-blue-600',    f: 'registered' },
          ].map(s => (
            <button key={s.label}
              onClick={() => { if (s.f) { setQualityFilter(q => q === s.f && s.f === 'high' ? '' : ''); setStatusFilter(q => q === s.f && s.f !== 'high' ? '' : (s.f && s.f !== 'high' ? s.f : q)); setPage(1) } }}
              className={`${s.bg} border ${s.border} rounded-2xl p-3 text-left`}>
              <p className={`text-xl font-extrabold tabular-nums ${s.text}`}>{loading ? '—' : s.val.toLocaleString()}</p>
              <p className={`text-[10px] font-semibold uppercase tracking-wide mt-0.5 ${s.small}`}>{s.label}</p>
            </button>
          ))}
        </div>

        {/* ── FILTER BAR ──────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 mb-4 shadow-sm">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input type="text" value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Tafuta jina, simu, ward…"
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="hidden sm:flex gap-2">
              <select value={qualityFilter} onChange={e => { setQualityFilter(e.target.value); setPage(1) }}
                className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Ubora wote</option>
                <option value="high">Juu</option>
                <option value="medium">Wastani</option>
                <option value="low">Chini</option>
              </select>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                className="px-2.5 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-none">
                <option value="">Status zote</option>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {activeFilterCount > 0 && (
                <button onClick={() => { setSearchInput(''); setSearch(''); setQualityFilter(''); setStatusFilter(''); setPage(1) }}
                  className="px-2.5 py-2 text-xs text-red-500 border border-red-100 rounded-xl hover:bg-red-50">
                  <i className="ti ti-x" /> Futa
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── DESKTOP TABLE ────────────────────────────────────────────────── */}
        <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-600">
              {loading
                ? <span className="flex items-center gap-1.5"><i className="ti ti-loader-2 animate-spin text-indigo-400" /> Inapakia…</span>
                : <>{total.toLocaleString()} lead{total !== 1 ? 's' : ''} zilizogawiwa kwangu</>
              }
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  {['Jina', 'Mawasiliano', 'Eneo', 'Social', 'Ubora', 'Status', 'Umri', ''].map((h, i) => (
                    <th key={i} className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-3 py-4"><div className="h-3 bg-gray-100 rounded-full animate-pulse" style={{ width: `${40 + j * 8}%`, maxWidth: '120px' }} /></td>)}</tr>
                    ))
                  : leads.map(lead => {
                      const q = QUALITY_CFG[lead.contact_quality] || QUALITY_CFG.unknown
                      const waNum = lead.whatsapp_number || lead.phone
                      return (
                        <tr key={lead.id} onClick={() => setDetailLead(lead)}
                          className="group cursor-pointer hover:bg-indigo-50/20 transition-colors">
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
                            {lead.phone
                              ? <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-600 hover:underline font-medium">{lead.phone}</a>
                              : <span className="text-gray-300 text-xs">—</span>}
                            {lead.phone_2 && <p className="text-[10px] text-gray-400">{lead.phone_2}</p>}
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-xs font-medium text-gray-700">{lead.ward || lead.district || lead.region || '—'}</p>
                            {lead.ward && (lead.district || lead.region) && <p className="text-[10px] text-gray-400">{lead.district || lead.region}</p>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              {lead.facebook_url  && <a href={safeUrl(lead.facebook_url)}  target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={`text-sm ${(SOCIAL_CFG[lead.facebook_status]  || SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-facebook" /></a>}
                              {lead.instagram_url && <a href={safeUrl(lead.instagram_url)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={`text-sm ${(SOCIAL_CFG[lead.instagram_status] || SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-instagram" /></a>}
                              {lead.tiktok_url    && <a href={safeUrl(lead.tiktok_url)}    target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={`text-sm ${(SOCIAL_CFG[lead.tiktok_status]    || SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-tiktok" /></a>}
                              {lead.whatsapp_number && <span className={`text-sm ${(SOCIAL_CFG[lead.whatsapp_status] || SOCIAL_CFG.unchecked).color}`}><i className="ti ti-brand-whatsapp" /></span>}
                              {!lead.has_any_social && <span className="text-gray-300 text-xs">—</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold ${q.pill}`}>{q.label}</span>
                          </td>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <select value={lead.status} onChange={e => handleStatusChange(lead.id, e.target.value)}
                              className={`text-[10px] px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer appearance-none ${STATUS_PILL[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-[10px] text-gray-400 tabular-nums">{timeAgo(lead.created_at)}</span>
                          </td>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
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
              <i className="ti ti-target text-5xl text-gray-300 block mb-3" />
              <p className="font-semibold text-gray-600">
                {activeFilterCount > 0 ? 'Hakuna leads zinazolingana na filter' : 'Hujagawiwa leads bado'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {activeFilterCount > 0 ? 'Badilisha filters' : 'Admin atakugawia leads kutoka Leads Management'}
              </p>
            </div>
          )}

          {!loading && total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Ukurasa <b>{page}</b> / {totalPages} · {total.toLocaleString()} jumla</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Iliyopita</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Inayofuata →</button>
              </div>
            </div>
          )}
        </div>

        {/* ── MOBILE CARDS ─────────────────────────────────────────────────── */}
        <div className="lg:hidden space-y-2.5">
          {loading && Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          {!loading && leads.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center shadow-sm">
              <i className="ti ti-target text-4xl text-gray-300 block mb-3" />
              <p className="font-semibold text-gray-600 text-sm">
                {activeFilterCount > 0 ? 'Hakuna leads zinazolingana' : 'Hujagawiwa leads bado'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Admin atakugawia leads kutoka Leads Management</p>
            </div>
          )}
          {!loading && leads.map(lead => {
            const q = QUALITY_CFG[lead.contact_quality] || QUALITY_CFG.unknown
            const waNum = lead.whatsapp_number || lead.phone
            return (
              <div key={lead.id} onClick={() => setDetailLead(lead)}
                className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${q.border} shadow-sm cursor-pointer active:scale-[0.99] transition-all`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{lead.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {lead.ward || lead.district || lead.region || '—'} · {timeAgo(lead.created_at)}
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
                      {lead.notes && <span className="w-6 h-6 bg-purple-50 rounded-lg flex items-center justify-center"><i className="ti ti-note text-purple-400 text-xs" /></span>}
                      {waNum && <a href={waLink(waNum, lead.full_name)} target="_blank" rel="noopener noreferrer" className="h-7 px-2.5 bg-[#25D366] text-white text-[10px] font-bold rounded-lg flex items-center gap-1"><i className="ti ti-brand-whatsapp" /> WA</a>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {!loading && total > 50 && (
            <div className="flex items-center justify-between py-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium disabled:opacity-40">← Iliyopita</button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium disabled:opacity-40">Inayofuata →</button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ LEAD DETAIL MODAL ════════════════════════════════════════════════ */}
      {detailLead && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-y-auto max-h-[92vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${(QUALITY_CFG[detailLead.contact_quality] || QUALITY_CFG.unknown).dot}`} />
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

              {/* Quick contact actions */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleStatusChange(detailLead.id, 'contacted')}
                  disabled={detailLead.status === 'contacted'}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-semibold hover:bg-amber-100 disabled:opacity-40">
                  <i className="ti ti-phone text-base" /> Amewasiliana
                </button>
                <button onClick={() => handleStatusChange(detailLead.id, 'interested')}
                  disabled={detailLead.status === 'interested'}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-semibold hover:bg-purple-100 disabled:opacity-40">
                  <i className="ti ti-heart text-base" /> Ana Nia
                </button>
                <button onClick={() => handleStatusChange(detailLead.id, 'registered')}
                  disabled={detailLead.status === 'registered'}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-100 disabled:opacity-40">
                  <i className="ti ti-circle-check text-base" /> Amesajili
                </button>
                <button onClick={() => handleStatusChange(detailLead.id, 'rejected')}
                  disabled={detailLead.status === 'rejected'}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[10px] font-semibold hover:bg-red-100 disabled:opacity-40">
                  <i className="ti ti-x text-base" /> Amekataa
                </button>
              </div>

              {/* Contact info */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                {[
                  { label: 'Simu',   val: detailLead.phone,   href: `tel:${detailLead.phone}` },
                  { label: 'Simu 2', val: detailLead.phone_2, href: `tel:${detailLead.phone_2}` },
                  { label: 'Email',  val: detailLead.email,   href: `mailto:${detailLead.email}` },
                  { label: 'Ward',   val: detailLead.ward },
                  { label: 'Wilaya', val: detailLead.district },
                  { label: 'Mkoa',   val: detailLead.region },
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
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.facebook_status] || SOCIAL_CFG.unchecked).color} bg-blue-50 border-blue-100`}>
                        <i className="ti ti-brand-facebook text-base" />
                        <div><p>Facebook</p><p className="text-[10px] opacity-70">{detailLead.facebook_status}</p></div>
                      </a>
                    )}
                    {detailLead.instagram_url && (
                      <a href={safeUrl(detailLead.instagram_url)} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.instagram_status] || SOCIAL_CFG.unchecked).color} bg-pink-50 border-pink-100`}>
                        <i className="ti ti-brand-instagram text-base" />
                        <div><p>Instagram</p><p className="text-[10px] opacity-70">{detailLead.instagram_status}</p></div>
                      </a>
                    )}
                    {detailLead.tiktok_url && (
                      <a href={safeUrl(detailLead.tiktok_url)} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.tiktok_status] || SOCIAL_CFG.unchecked).color} bg-gray-100 border-gray-200`}>
                        <i className="ti ti-brand-tiktok text-base" />
                        <div><p>TikTok</p><p className="text-[10px] opacity-70">{detailLead.tiktok_status}</p></div>
                      </a>
                    )}
                    {detailLead.whatsapp_number && (
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium ${(SOCIAL_CFG[detailLead.whatsapp_status] || SOCIAL_CFG.unchecked).color} bg-emerald-50 border-emerald-100`}>
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

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Maelezo / CRM Notes</p>
                  {!editingNotes
                    ? <button onClick={() => setEditingNotes(true)} className="text-[10px] text-indigo-600 font-semibold hover:underline"><i className="ti ti-edit mr-0.5" />Hariri</button>
                    : <div className="flex gap-2">
                        <button onClick={() => setEditingNotes(false)} className="text-[10px] text-gray-500 hover:underline">Ghairi</button>
                        <button onClick={handleSaveNotes} disabled={savingNotes} className="text-[10px] text-indigo-600 font-semibold hover:underline disabled:opacity-50">
                          {savingNotes ? 'Inahifadhi…' : 'Hifadhi'}
                        </button>
                      </div>
                  }
                </div>
                {editingNotes
                  ? <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={4}
                      placeholder="Andika maelezo, logi ya mawasiliano, au maelezo yoyote…"
                      className="w-full border border-indigo-300 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                  : <div className={`rounded-xl px-3 py-2.5 text-xs ${detailLead.notes ? 'bg-purple-50 text-purple-800 border border-purple-100' : 'bg-gray-50 text-gray-400 border border-dashed border-gray-200'}`}>
                      {detailLead.notes || 'Bonyeza Hariri kuongeza maelezo au logi ya mawasiliano…'}
                    </div>
                }
              </div>

              {/* Status grid */}
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

              {/* Primary WA button */}
              {(detailLead.whatsapp_number || detailLead.phone) && (
                <a href={waLink(detailLead.whatsapp_number || detailLead.phone!, detailLead.full_name)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-2xl font-bold hover:bg-green-600">
                  <i className="ti ti-brand-whatsapp text-xl" /> Wasiliana WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
