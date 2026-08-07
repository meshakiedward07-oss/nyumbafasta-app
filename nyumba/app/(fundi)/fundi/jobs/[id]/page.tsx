'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { MAINTENANCE_CATEGORY_LABELS, MAINTENANCE_PRIORITY_LABELS, MAINTENANCE_STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '@/lib/types/property'
import type { MaintenanceStatus, MaintenancePriority, MaintenanceCategory } from '@/lib/types/property'

interface Job {
  id: string; title: string; description: string | null
  category: string; priority: string; status: string
  created_at: string; resolved_at: string | null; scheduled_at: string | null; notes: string | null
  unit: { id: string; unit_number: string; unit_type: string } | null
  org:  { id: string; name: string; phone: string | null; email: string | null } | null
}

interface Update {
  id: string; message: string; created_at: string
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function FundiJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job,      setJob]      = useState<Job | null>(null)
  const [updates,  setUpdates]  = useState<Update[]>([])
  const [loading,  setLoading]  = useState(true)
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [sendErr,  setSendErr]  = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  async function load() {
    try {
      const res  = await fetch(`/api/v1/fundi/jobs/${id}/updates`)
      if (!res.ok) { setError('Kazi haipatikani.'); return }
      const data = await res.json()
      setJob(data.job ?? null)
      setUpdates(data.updates ?? [])
    } catch { setError('Hitilafu ya mtandao.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!message.trim()) return
    setSending(true); setSendErr(null)
    try {
      const res = await fetch(`/api/v1/fundi/jobs/${id}/updates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setSendErr(data.error ?? 'Kuna tatizo'); return }
      setMessage('')
      setUpdates(prev => [...prev, data.update])
    } catch { setSendErr('Haikuweza kutuma. Jaribu tena.') }
    finally { setSending(false) }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-medium">{error ?? 'Kazi haipatikani'}</p>
        <Link href="/fundi/dashboard" className="text-primary-600 text-sm mt-2 inline-block">← Rudi</Link>
      </div>
    )
  }

  const org = job.org

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <Link href="/fundi/dashboard" className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
          <i className="ti ti-arrow-left text-xl" aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{job.title}</p>
          <p className="text-xs text-gray-400">{org?.name ?? '—'}</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[job.status as MaintenanceStatus] ?? 'bg-gray-100 text-gray-500'}`}>
          {MAINTENANCE_STATUS_LABELS[job.status as MaintenanceStatus] ?? job.status}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 py-4 space-y-4">
        {/* Job details card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[job.priority as MaintenancePriority] ?? 'bg-gray-100 text-gray-500'}`}>
              {MAINTENANCE_PRIORITY_LABELS[job.priority as MaintenancePriority] ?? job.priority}
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-primary-50 text-primary-600 font-medium">
              {MAINTENANCE_CATEGORY_LABELS[job.category as MaintenanceCategory] ?? job.category}
            </span>
          </div>

          {job.description && <p className="text-sm text-gray-600">{job.description}</p>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {job.unit && (
              <>
                <dt className="text-gray-400">Kitengo</dt>
                <dd className="font-medium text-gray-700">{job.unit.unit_number}</dd>
              </>
            )}
            {job.scheduled_at && (
              <>
                <dt className="text-gray-400">Ratiba</dt>
                <dd className="font-medium text-gray-700">{fmt(job.scheduled_at)}</dd>
              </>
            )}
            <dt className="text-gray-400">Iliombwa</dt>
            <dd className="font-medium text-gray-700">{fmt(job.created_at)}</dd>
          </dl>

          {job.notes && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Maelezo ya Ziada</p>
              <p className="text-sm text-gray-700">{job.notes}</p>
            </div>
          )}
        </div>

        {/* Org contact */}
        {org && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mawasiliano na Shirika</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ti ti-building text-primary-600 text-lg" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{org.name}</p>
                {org.phone && <p className="text-xs text-gray-400">{org.phone}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {org.phone && (
                <a href={`tel:${org.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
                  <i className="ti ti-phone" aria-hidden="true" /> Piga Simu
                </a>
              )}
              {org.phone && (
                <a href={`https://wa.me/${org.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600 transition">
                  <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {/* Updates timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Taarifa za Kazi ({updates.length})</p>
          {updates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Bado hujatoa taarifa yoyote.</p>
          ) : (
            <div className="space-y-3">
              {updates.map(u => (
                <div key={u.id} className="flex gap-3">
                  <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ti ti-message text-primary-600 text-xs" aria-hidden="true" />
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-3">
                    <p className="text-sm text-gray-800">{u.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{fmt(u.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Message input — fixed at bottom */}
      <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0">
        {sendErr && <p className="text-xs text-red-500 mb-2">{sendErr}</p>}
        <div className="flex gap-2">
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Toa taarifa kuhusu kazi..."
            rows={2}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
          <button onClick={handleSend} disabled={sending || !message.trim()}
            className="bg-primary-500 text-white px-4 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-40 transition flex items-center">
            <i className={`ti ti-${sending ? 'loader-2 animate-spin' : 'send'} text-lg`} aria-hidden="true" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Taarifa yako itaonekana kwa shirika.</p>
      </div>
    </div>
  )
}
