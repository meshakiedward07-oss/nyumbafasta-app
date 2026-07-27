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

const STATUS_COLOR: Record<MStatus, string> = {
  open:        'bg-red-50 text-red-700',
  assigned:    'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  resolved:    'bg-green-50 text-green-700',
  closed:      'bg-gray-100 text-gray-500',
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
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
        className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1">
        {saving ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> : <i className="ti ti-chevron-down" aria-hidden="true" />}
        Badilisha
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg p-1.5">
          {transitions.map(t => (
            <button key={t.status} onClick={() => update(t.status)}
              className="w-full text-left text-xs px-3 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition">
              {t.label}
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="w-full text-left text-xs px-3 py-2 text-gray-400 hover:bg-gray-50 rounded-lg mt-0.5">
            Ghairi
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminMaintenancePage() {
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

  const statusChips: Array<{ value: MStatus | 'all'; label: string; count: number; color: string }> = [
    { value: 'all',         label: 'Zote',          count: summary.open + summary.in_progress + summary.resolved + summary.closed, color: 'bg-gray-100 text-gray-600' },
    { value: 'open',        label: 'Wazi',          count: summary.open,        color: 'bg-red-100 text-red-700'    },
    { value: 'in_progress', label: 'Inaendelea',    count: summary.in_progress, color: 'bg-amber-100 text-amber-700'},
    { value: 'resolved',    label: 'Imeshughulikiwa', count: summary.resolved,  color: 'bg-green-100 text-green-700'},
    { value: 'closed',      label: 'Imefungwa',     count: summary.closed,      color: 'bg-gray-100 text-gray-500'  },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Matengenezo — Mashirika Yote</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Maombi ya matengenezo kutoka mashirika yote kwenye mfumo
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Wazi',           value: summary.open,        icon: 'alert-circle',  color: 'text-red-500    bg-red-50'    },
          { label: 'Inaendelea',     value: summary.in_progress, icon: 'clock',         color: 'text-amber-500  bg-amber-50'  },
          { label: 'Imeshughulikiwa',value: summary.resolved,    icon: 'circle-check',  color: 'text-green-500  bg-green-50'  },
          { label: 'Imefungwa',      value: summary.closed,      icon: 'lock',          color: 'text-gray-400   bg-gray-100'  },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${c.color.split(' ')[1]}`}>
              <i className={`ti ti-${c.icon} text-base ${c.color.split(' ')[0]}`} aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {statusChips.map(chip => (
          <button key={chip.value} onClick={() => setStatusFilter(chip.value as typeof statusFilter)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === chip.value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {chip.label}
            <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 flex items-center justify-center ${
              statusFilter === chip.value ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
            }`}>{chip.count}</span>
          </button>
        ))}
      </div>

      {/* Secondary filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Priority */}
        <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
          <option value="all">Kipaumbele: Zote</option>
          {(Object.entries(MAINTENANCE_PRIORITY_LABELS) as [MPriority, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Category */}
        <select value={category} onChange={e => setCategory(e.target.value as typeof category)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
          <option value="all">Aina: Zote</option>
          {(Object.entries(MAINTENANCE_CATEGORY_LABELS) as [MCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Search */}
        <form onSubmit={e => { e.preventDefault(); load() }} className="flex gap-1 flex-1 min-w-[200px]">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta kichwa cha tatizo..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300" />
          <button type="submit"
            className="px-3 py-2 bg-primary-500 text-white rounded-xl text-xs font-semibold hover:bg-primary-600 transition">
            <i className="ti ti-search" aria-hidden="true" />
          </button>
        </form>
      </div>

      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <i className="ti ti-tool text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna maombi</p>
          <p className="text-sm text-gray-400 mt-1">Hakuna maombi yanayofanana na vichujio vilivyochaguliwa.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {requests.map(req => {
              const catLabel  = MAINTENANCE_CATEGORY_LABELS[req.category]  ?? req.category
              const catIcon   = MAINTENANCE_CATEGORY_ICONS[req.category]   ?? 'tool'
              const prioLabel = MAINTENANCE_PRIORITY_LABELS[req.priority]  ?? req.priority
              const statLabel = MAINTENANCE_STATUS_LABELS[req.status]      ?? req.status
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    {/* Category icon */}
                    <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className={`ti ti-${catIcon} text-primary-600 text-lg`} aria-hidden="true" />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      {/* Org name */}
                      <p className="text-[11px] text-blue-600 font-semibold mb-0.5 flex items-center gap-1">
                        <i className="ti ti-building" aria-hidden="true" />
                        {req.organization?.name ?? 'Shirika lisilojulikana'}
                        {req.unit && (
                          <span className="text-gray-400 font-normal ml-1">· Chumba {req.unit.unit_number}</span>
                        )}
                      </p>

                      {/* Title + badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{req.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[req.status]}`}>
                          {statLabel}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[req.priority]}`}>
                          {prioLabel}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                          {catLabel}
                        </span>
                      </div>

                      {/* Reporter & date */}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
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
                          {fmtDate(req.created_at)} {fmtTime(req.created_at)}
                        </span>
                        {req.estimated_cost && (
                          <span className="flex items-center gap-1">
                            <i className="ti ti-coin" aria-hidden="true" />
                            Gharama: TZS {req.estimated_cost.toLocaleString()}
                          </span>
                        )}
                        {req.scheduled_at && (
                          <span className="flex items-center gap-1">
                            <i className="ti ti-calendar-event" aria-hidden="true" />
                            Imepangwa: {fmtDate(req.scheduled_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <StatusDropdown req={req} onDone={load} />
                      {req.organization && (
                        <a
                          href={`/property/maintenance?org=${req.org_id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition flex items-center gap-1">
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
            <p className="text-center text-xs text-gray-400 mt-4">
              Inaonyesha {requests.length} ya {total} maombi
            </p>
          )}
        </>
      )}
    </div>
  )
}
