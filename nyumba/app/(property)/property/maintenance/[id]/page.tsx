'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  MAINTENANCE_CATEGORY_LABELS, MAINTENANCE_PRIORITY_LABELS, MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_STATUS_NEXT, PRIORITY_COLORS, STATUS_COLORS,
} from '@/lib/types/property'
import type {
  MaintenanceRequest, MaintenanceComment, MaintenanceStatus,
} from '@/lib/types/property'

type RichRequest = MaintenanceRequest & {
  reporter: { id: string; full_name: string | null; phone: string | null; avatar_url: string | null } | null
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null
  unit:     { id: string; unit_number: string; unit_type: string; monthly_rent: number } | null
  lease:    {
    id: string; start_date: string; end_date: string | null; monthly_rent: number
    tenant: { id: string; full_name: string | null; phone: string | null } | null
  } | null
}

type RichComment = MaintenanceComment & {
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
}

type OrgMember = {
  user_id: string
  role: string
  user: { id: string; full_name: string | null; avatar_url: string | null } | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCost(n: number | null) {
  if (!n) return '—'
  return `Tsh ${n.toLocaleString('en-TZ')}`
}

export default function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [orgId,   setOrgId]   = useState<string | null>(null)
  const [request, setRequest] = useState<RichRequest | null>(null)
  const [comments, setComments] = useState<RichComment[]>([])
  const [members,  setMembers]  = useState<OrgMember[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [comment,  setComment]  = useState('')
  const [addingComment, setAddingComment] = useState(false)

  // Inline edits
  const [editAssignee, setEditAssignee] = useState<string>('')
  const [editCost,     setEditCost]     = useState<string>('')
  const [editScheduled, setEditScheduled] = useState<string>('')
  const [editNotes,    setEditNotes]    = useState<string>('')
  const [showEditPanel, setShowEditPanel] = useState(false)

  async function load(oid: string) {
    const res  = await fetch(`/api/v1/organizations/${oid}/maintenance/${id}`)
    if (!res.ok) { setError('Ombi halipatikani.'); return }
    const data = await res.json()
    setRequest(data.request)
    setComments(data.comments ?? [])
    setMembers(data.members ?? [])
    setEditAssignee(data.request?.assigned_to ?? '')
    setEditCost(data.request?.actual_cost?.toString() ?? '')
    setEditScheduled(data.request?.scheduled_at
      ? new Date(data.request.scheduled_at).toISOString().slice(0, 16) : '')
    setEditNotes(data.request?.notes ?? '')
  }

  useEffect(() => {
    async function init() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) return
        const oid = primary.organization.id
        setOrgId(oid)
        await load(oid)
      } catch { setError('Hitilafu ya mtandao.') }
      finally { setLoading(false) }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleStatusChange(newStatus: MaintenanceStatus) {
    if (!orgId || !request) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/maintenance/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      setRequest(data.request)
      await load(orgId)
    } catch { setError('Haikuweza kuhifadhi.') }
    finally { setSaving(false) }
  }

  async function handleSaveDetails() {
    if (!orgId || !request) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (editAssignee !== (request.assigned_to ?? '')) body.assigned_to    = editAssignee || null
      if (editCost     !== (request.actual_cost?.toString() ?? '')) body.actual_cost = editCost ? parseFloat(editCost) : null
      if (editScheduled) body.scheduled_at = new Date(editScheduled).toISOString()
      body.notes = editNotes.trim() || null

      const res  = await fetch(`/api/v1/organizations/${orgId}/maintenance/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      setRequest(data.request)
      setShowEditPanel(false)
      await load(orgId)
    } catch { setError('Haikuweza kuhifadhi.') }
    finally { setSaving(false) }
  }

  async function handleAddComment() {
    if (!comment.trim() || !orgId) return
    setAddingComment(true)
    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/maintenance/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
      })
      if (!res.ok) return
      setComment('')
      await load(orgId)
    } catch { /* silent */ }
    finally { setAddingComment(false) }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-medium">{error ?? 'Ombi halipatikani'}</p>
        <Link href="/property/maintenance" className="text-primary-600 text-sm mt-2 inline-block">← Rudi</Link>
      </div>
    )
  }

  const nextStatuses = MAINTENANCE_STATUS_NEXT[request.status] ?? []

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <Link href="/property/maintenance" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <i className="ti ti-arrow-left text-xl" aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{request.title}</p>
          <p className="text-[10px] text-gray-400">{formatDateTime(request.created_at)}</p>
        </div>
        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status]}`}>
          {MAINTENANCE_STATUS_LABELS[request.status]}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Priority + category */}
        <div className="flex flex-wrap gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${PRIORITY_COLORS[request.priority]}`}>
            <i className="ti ti-alert-triangle mr-1" aria-hidden="true" />
            {MAINTENANCE_PRIORITY_LABELS[request.priority]}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <i className="ti ti-tool mr-1" aria-hidden="true" />
            {MAINTENANCE_CATEGORY_LABELS[request.category]}
          </span>
          {request.unit && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <i className="ti ti-door mr-1" aria-hidden="true" />
              {request.unit.unit_number}
            </span>
          )}
        </div>

        {/* Description */}
        {request.description && (
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">Maelezo</p>
            <p className="text-sm text-gray-700 leading-relaxed">{request.description}</p>
          </div>
        )}

        {/* Status actions */}
        {nextStatuses.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">Badilisha Hali</p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map(s => (
                <button key={s} onClick={() => handleStatusChange(s)} disabled={saving}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40">
                  {saving ? '...' : `→ ${MAINTENANCE_STATUS_LABELS[s]}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Details panel */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold text-gray-500">Maelezo ya Kina</p>
            <button onClick={() => setShowEditPanel(p => !p)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              {showEditPanel ? 'Ghairi' : 'Hariri'}
            </button>
          </div>

          {showEditPanel ? (
            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] text-gray-400 font-medium block mb-1">Mpewa</label>
                <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                  <option value="">Haijapewa</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {(m.user as unknown as { full_name: string | null } | null)?.full_name ?? m.user_id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-medium block mb-1">Gharama halisi (Tsh)</label>
                <input type="number" value={editCost} onChange={e => setEditCost(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-medium block mb-1">Ratiba</label>
                <input type="datetime-local" value={editScheduled} onChange={e => setEditScheduled(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-medium block mb-1">Maelezo ya ziada</label>
                <textarea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
              <button onClick={handleSaveDetails} disabled={saving}
                className="w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                {saving ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
              </button>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <dt className="text-[10px] text-gray-400 font-medium">Mripoti</dt>
                <dd className="text-gray-800 font-medium truncate">
                  {request.reporter?.full_name ?? 'Haijulikani'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-gray-400 font-medium">Mpewa</dt>
                <dd className="text-gray-800 font-medium truncate">
                  {request.assignee?.full_name ?? <span className="text-gray-400 font-normal">Haijapewa</span>}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-gray-400 font-medium">Gharama ya kadirio</dt>
                <dd className="text-gray-800">{formatCost(request.estimated_cost)}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-gray-400 font-medium">Gharama halisi</dt>
                <dd className="text-gray-800">{formatCost(request.actual_cost)}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-gray-400 font-medium">Ratiba</dt>
                <dd className="text-gray-800">{formatDate(request.scheduled_at)}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-gray-400 font-medium">Imeshughulikiwa</dt>
                <dd className="text-gray-800">{formatDate(request.resolved_at)}</dd>
              </div>
              {request.notes && (
                <div className="col-span-2">
                  <dt className="text-[10px] text-gray-400 font-medium">Maelezo ya ziada</dt>
                  <dd className="text-gray-700 text-xs mt-0.5 leading-relaxed">{request.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Tenant / Unit info */}
        {(request.unit || request.lease?.tenant) && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">Kitengo na Mpangaji</p>
            {request.unit && (
              <div className="flex items-center gap-2 mb-2">
                <i className="ti ti-door text-gray-400" aria-hidden="true" />
                <span className="text-sm text-gray-700">{request.unit.unit_number} · {request.unit.unit_type}</span>
              </div>
            )}
            {request.lease?.tenant && (
              <div className="flex items-center gap-2">
                <i className="ti ti-user text-gray-400" aria-hidden="true" />
                <span className="text-sm text-gray-700">{request.lease.tenant.full_name}</span>
                {request.lease.tenant.phone && (
                  <a href={`tel:${request.lease.tenant.phone}`}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium ml-1">
                    {request.lease.tenant.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Conversation link */}
        {request.conversation_id && (
          <Link href={`/property/mazungumzo/${request.conversation_id}`}
            className="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-2xl p-3.5 hover:bg-primary-100 transition">
            <i className="ti ti-message-circle text-primary-500 text-xl flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-primary-700">Fungua Mazungumzo</p>
              <p className="text-xs text-primary-500">Wasiliana moja kwa moja kuhusu tatizo hili</p>
            </div>
            <i className="ti ti-chevron-right text-primary-400 ml-auto" aria-hidden="true" />
          </Link>
        )}

        {/* Comments / Timeline */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Historia na Maoni</p>

          {comments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Hakuna maoni bado.</p>
          ) : (
            <div className="space-y-3">
              {comments.map(c => {
                const author = c.author as unknown as { full_name: string | null; avatar_url: string | null } | null
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex-shrink-0 flex items-center justify-center mt-0.5">
                      <span className="text-primary-600 font-bold text-xs">
                        {author?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-gray-700">
                          {author?.full_name ?? 'Mtumiaji'}
                        </span>
                        {c.status_change && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                            {c.status_change}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {formatDateTime(c.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add comment */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={1}
              placeholder="Ongeza maoni au habari..."
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
            <button onClick={handleAddComment} disabled={!comment.trim() || addingComment}
              className="w-9 h-9 bg-primary-500 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 disabled:opacity-40 transition flex-shrink-0">
              {addingComment
                ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                : <i className="ti ti-send text-sm" aria-hidden="true" />
              }
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>
    </div>
  )
}
