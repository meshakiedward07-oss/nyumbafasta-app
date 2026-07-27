'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  MAINTENANCE_CATEGORY_LABELS,
  MAINTENANCE_CATEGORY_ICONS,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
} from '@/lib/types/property'

type MStatus   = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
type MPriority = 'low' | 'medium' | 'high' | 'urgent'
type MCategory = keyof typeof MAINTENANCE_CATEGORY_LABELS

interface AdminMaintRequest {
  id:             string
  org_id:         string
  title:          string
  category:       MCategory
  priority:       MPriority
  status:         MStatus
  estimated_cost: number | null
  scheduled_at:   string | null
  resolved_at:    string | null
  created_at:     string
  organization:   { id: string; name: string } | null
  reporter:       { id: string; full_name: string | null; phone: string | null } | null
  unit:           { id: string; unit_number: string } | null
}

interface Summary { open: number; in_progress: number; resolved: number; closed: number }

const STATUS_STYLE: Record<MStatus, { bg: string; color: string }> = {
  open:        { bg: '#fcebeb', color: '#a32d2d' },
  assigned:    { bg: '#e6f1fb', color: '#185fa5' },
  in_progress: { bg: '#faeeda', color: '#854f0b' },
  resolved:    { bg: '#eaf3de', color: '#3b6d11' },
  closed:      { bg: '#f4f4f0', color: '#999992' },
}
const PRIORITY_COLOR: Record<MPriority, string> = {
  urgent: 'bg-red-100 text-red-700 border border-red-200',
  high:   'bg-orange-100 text-orange-700 border border-orange-200',
  medium: 'bg-amber-50 text-amber-600 border border-amber-100',
  low:    'bg-gray-50 text-gray-500 border border-gray-100',
}

const STATUS_TRANSITIONS: Record<MStatus, { status: MStatus; label: string }[]> = {
  open:        [{ status: 'in_progress', label: 'Anza Kushughulikia' }, { status: 'closed', label: 'Funga' }],
  assigned:    [{ status: 'in_progress', label: 'Anza Kushughulikia' }],
  in_progress: [{ status: 'resolved',    label: 'Imeshughulikiwa'   }, { status: 'closed', label: 'Funga' }],
  resolved:    [{ status: 'closed',      label: 'Funga'             }],
  closed:      [],
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusDropdown({ req, onDone }: { req: AdminMaintRequest; onDone: () => void }) {
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const transitions = STATUS_TRANSITIONS[req.status] ?? []
  if (transitions.length === 0) return null

  async function update(status: MStatus) {
    setSaving(true)
    try {
      await fetch('/api/v1/admin/maintenance', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: req.id, status }),
      })
      onDone()
    } finally { setSaving(false); setOpen(false) }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={saving}
        className="text-xs px-2.5 py-1 rounded-lg transition flex items-center gap-1"
        style={{ border: '1px solid #e5e5e0', color: '#666660' }}>
        {saving ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> : <i className="ti ti-chevron-down" aria-hidden="true" />}
        Badilisha
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-xl shadow-lg p-1.5" style={{ border: '1px solid #e5e5e0' }}>
          {transitions.map(t => (
            <button key={t.status} onClick={() => update(t.status)}
              className="w-full text-left text-xs px-3 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
              style={{ color: '#1a1a18' }}>
              {t.label}
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="w-full text-left text-xs px-3 py-2 rounded-lg mt-0.5 hover:bg-gray-50" style={{ color: '#999992' }}>
            Ghairi
          </button>
        </div>
      )}
    </div>
  )
}

export default function MaintenanceTab() {
  const [requests,     setRequests]     = useState<AdminMaintRequest[]>([])
  const [summary,      setSummary]      = useState<Summary>({ open: 0, in_progress: 0, resolved: 0, closed: 0 })
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState<MStatus | 'all'>('all')
  const [priority,     setPriority]     = useState<MPriority | 'all'>('all')
  const [category,     setCategory]     = useState<MCategory | 'all'>('all')
  const [search,       setSearch]       = useState('')
  const [err,          setErr]          = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (priority     !== 'all') params.set('priority', priority)
      if (category     !== 'all') params.set('category', category)
      if (search.trim())          params.set('q', search.trim())
      const res  = await fetch(`/api/v1/admin/maintenance?${params}`)
      const data = await res.json()
      setRequests(data.requests  ?? [])
      setTotal(data.count        ?? 0)
      if (data.summary) setSummary(data.summary)
    } catch { setErr('Imeshindwa kupakia data. Jaribu tena.') }
    finally   { setLoading(false) }
  }, [statusFilter, priority, category, search])

  useEffect(() => { load() }, [load])

  const statusChips = [
    { value: 'all'         as const, label: 'Zote',            count: summary.open + summary.in_progress + summary.resolved + summary.closed },
    { value: 'open'        as const, label: 'Wazi',            count: summary.open        },
    { value: 'in_progress' as const, label: 'Inaendelea',      count: summary.in_progress },
    { value: 'resolved'    as const, label: 'Imeshughulikiwa', count: summary.resolved    },
    { value: 'closed'      as const, label: 'Imefungwa',       count: summary.closed      },
  ]

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Wazi',            value: summary.open,        icon: 'alert-circle', bg: '#fcebeb', color: '#a32d2d' },
          { label: 'Inaendelea',      value: summary.in_progress, icon: 'clock',        bg: '#faeeda', color: '#854f0b' },
          { label: 'Imeshughulikiwa', value: summary.resolved,    icon: 'circle-check', bg: '#eaf3de', color: '#3b6d11' },
          { label: 'Imefungwa',       value: summary.closed,      icon: 'lock',         bg: '#f4f4f0', color: '#999992' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: c.bg }}>
              <i className={`ti ti-${c.icon} text-base`} style={{ color: c.color }} aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold" style={{ color: '#1a1a18' }}>{c.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#999992' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {statusChips.map(chip => (
          <button key={chip.value} onClick={() => setStatusFilter(chip.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === chip.value ? 'bg-primary-500 text-white' : ''
            }`}
            style={statusFilter !== chip.value ? { background: '#f4f4f0', color: '#666660' } : {}}>
            {chip.label}
            <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 flex items-center justify-center ${
              statusFilter === chip.value ? 'bg-white/20 text-white' : ''
            }`}
            style={statusFilter !== chip.value ? { background: '#e5e5e0', color: '#666660' } : {}}>{chip.count}</span>
          </button>
        ))}
      </div>

      {/* Secondary filters */}
      <div className="flex flex-wrap gap-2">
        <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}
          className="rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
          style={{ border: '1px solid #e5e5e0', color: '#666660', background: 'white' }}>
          <option value="all">Kipaumbele: Zote</option>
          {(Object.entries(MAINTENANCE_PRIORITY_LABELS) as [MPriority, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={category} onChange={e => setCategory(e.target.value as typeof category)}
          className="rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
          style={{ border: '1px solid #e5e5e0', color: '#666660', background: 'white' }}>
          <option value="all">Aina: Zote</option>
          {(Object.entries(MAINTENANCE_CATEGORY_LABELS) as [MCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <form onSubmit={e => { e.preventDefault(); load() }} className="flex gap-1 flex-1 min-w-[200px]">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta kichwa cha tatizo..."
            className="flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
            style={{ border: '1px solid #e5e5e0', color: '#1a1a18' }} />
          <button type="submit"
            className="px-3 py-2 bg-primary-500 text-white rounded-xl text-xs font-semibold hover:bg-primary-600 transition">
            <i className="ti ti-search" aria-hidden="true" />
          </button>
        </form>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: '#f4f4f0' }} />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center" style={{ border: '1px dashed #e5e5e0' }}>
          <i className="ti ti-tool text-5xl" style={{ color: '#e5e5e0' }} aria-hidden="true" />
          <p className="font-medium mt-3" style={{ color: '#666660' }}>Hakuna maombi</p>
          <p className="text-sm mt-1" style={{ color: '#999992' }}>Hakuna maombi yanayofanana na vichujio vilivyochaguliwa.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {requests.map(req => {
              const catLabel  = MAINTENANCE_CATEGORY_LABELS[req.category]  ?? req.category
              const catIcon   = MAINTENANCE_CATEGORY_ICONS[req.category]   ?? 'tool'
              const prioLabel = MAINTENANCE_PRIORITY_LABELS[req.priority]  ?? req.priority
              const statLabel = MAINTENANCE_STATUS_LABELS[req.status]      ?? req.status
              const ss        = STATUS_STYLE[req.status]

              return (
                <div key={req.id} className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className={`ti ti-${catIcon} text-primary-600 text-lg`} aria-hidden="true" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold mb-0.5 flex items-center gap-1" style={{ color: '#185fa5' }}>
                        <i className="ti ti-building" aria-hidden="true" />
                        {req.organization?.name ?? 'Shirika lisilojulikana'}
                        {req.unit && (
                          <span className="font-normal ml-1" style={{ color: '#999992' }}>· Chumba {req.unit.unit_number}</span>
                        )}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-sm" style={{ color: '#1a1a18' }}>{req.title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: ss.bg, color: ss.color }}>
                          {statLabel}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[req.priority]}`}>
                          {prioLabel}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#f4f4f0', color: '#666660' }}>
                          {catLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs" style={{ color: '#999992' }}>
                        {req.reporter?.full_name && (
                          <span className="flex items-center gap-1">
                            <i className="ti ti-user" aria-hidden="true" />
                            {req.reporter.full_name}
                            {req.reporter.phone && (
                              <a href={`tel:${req.reporter.phone}`} className="ml-0.5 hover:text-primary-500">
                                {req.reporter.phone}
                              </a>
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <i className="ti ti-calendar" aria-hidden="true" />
                          {fmtDate(req.created_at)}
                        </span>
                        {req.estimated_cost && (
                          <span className="flex items-center gap-1">
                            <i className="ti ti-coin" aria-hidden="true" />
                            TZS {req.estimated_cost.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <StatusDropdown req={req} onDone={load} />
                      {req.organization && (
                        <a href={`/property/maintenance?org=${req.org_id}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                          style={{ border: '1px solid #e5e5e0', color: '#999992' }}>
                          <i className="ti ti-external-link" aria-hidden="true" /> Org
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {total > requests.length && (
            <p className="text-center text-xs mt-4" style={{ color: '#999992' }}>
              Inaonyesha {requests.length} ya {total} maombi
            </p>
          )}
        </>
      )}
    </div>
  )
}
