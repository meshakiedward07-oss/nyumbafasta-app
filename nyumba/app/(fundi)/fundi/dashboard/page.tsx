'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MAINTENANCE_CATEGORY_LABELS, MAINTENANCE_PRIORITY_LABELS, MAINTENANCE_STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '@/lib/types/property'
import type { MaintenanceStatus, MaintenancePriority, MaintenanceCategory } from '@/lib/types/property'

interface Job {
  id: string; title: string; description: string | null
  category: string; priority: string; status: string
  created_at: string; resolved_at: string | null; scheduled_at: string | null
  notes: string | null
  unit: { id: string; unit_number: string } | null
  org:  { id: string; name: string; phone: string | null } | null
}

interface FundiProfile {
  kyc_status: string; business_name: string | null; category: string
  location: string | null; is_available: boolean
}

const STATUS_FILTER = ['all', 'open', 'assigned', 'in_progress', 'awaiting_parts', 'resolved', 'closed'] as const
type SF = (typeof STATUS_FILTER)[number]

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function FundiDashboardPage() {
  const [jobs,        setJobs]        = useState<Job[]>([])
  const [fundi,       setFundi]       = useState<FundiProfile | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState<SF>('all')

  useEffect(() => {
    async function load() {
      try {
        const [jobRes, meRes] = await Promise.all([
          fetch('/api/v1/fundi/jobs'),
          fetch('/api/v1/fundi/me'),
        ])
        const [jobData, meData] = await Promise.all([jobRes.json(), meRes.json()])
        setJobs(jobData.jobs ?? [])
        setFundi(meData.fundi ?? null)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = statusFilter === 'all' ? jobs : jobs.filter(j => j.status === statusFilter)

  const activeCount   = jobs.filter(j => !['resolved', 'closed'].includes(j.status)).length
  const resolvedCount = jobs.filter(j => ['resolved', 'closed'].includes(j.status)).length

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">

      {/* KYC banner */}
      {fundi && fundi.kyc_status !== 'approved' && (
        <div className={`rounded-2xl p-4 mb-5 flex items-start gap-3 ${
          fundi.kyc_status === 'rejected' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'
        }`}>
          <i className={`ti ti-id text-xl flex-shrink-0 mt-0.5 ${fundi.kyc_status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${fundi.kyc_status === 'rejected' ? 'text-red-800' : 'text-amber-800'}`}>
              {fundi.kyc_status === 'none'     && 'Tuma hati zako za KYC'}
              {fundi.kyc_status === 'pending'  && 'KYC Inakaguliwa...'}
              {fundi.kyc_status === 'rejected' && 'KYC Ilikataliwa — Tuma Tena'}
            </p>
            <p className={`text-xs mt-0.5 ${fundi.kyc_status === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
              {fundi.kyc_status === 'none'    && 'Hati zako lazima zithibitishwe ili mashirika yakupate.'}
              {fundi.kyc_status === 'pending' && 'Timu yetu inakagua hati zako. Utaarifiwa hivi karibuni.'}
              {fundi.kyc_status === 'rejected'&& 'Hati zako hazikukubaliwa. Tuma hati sahihi ili kuendelea.'}
            </p>
          </div>
          <Link href="/fundi/kyc"
            className={`text-xs px-3 py-1.5 rounded-xl font-semibold flex-shrink-0 ${
              fundi.kyc_status === 'rejected' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-amber-500 text-white hover:bg-amber-600'
            } transition`}>
            {fundi.kyc_status === 'none' ? 'Tuma KYC' : fundi.kyc_status === 'rejected' ? 'Tuma Tena' : 'Angalia'}
          </Link>
        </div>
      )}

      {/* Profile incomplete banner */}
      {fundi && !fundi.business_name && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5 flex items-center gap-3">
          <i className="ti ti-user-circle text-blue-500 text-xl flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-blue-700 flex-1 min-w-0">Kamilisha wasifu wako ili mashirika yakujue vyema.</p>
          <Link href="/fundi/profile" className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition flex-shrink-0">
            Wasifu
          </Link>
        </div>
      )}

      {/* Header stats */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kazi Zangu</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeCount} zinazoendelea · {resolvedCount} zilizokamilika</p>
        </div>
        {fundi?.is_available !== undefined && (
          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${fundi.is_available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fundi.is_available ? 'bg-green-500' : 'bg-gray-400'}`} aria-hidden="true" />
            {fundi.is_available ? 'Ninapatikana' : 'Sipatikani'}
          </span>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {STATUS_FILTER.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
              statusFilter === s ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {s === 'all' ? 'Zote' : MAINTENANCE_STATUS_LABELS[s as MaintenanceStatus] ?? s}
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-hammer text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">
            {jobs.length === 0 ? 'Huna kazi bado' : 'Hakuna kazi za aina hii'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {jobs.length === 0
              ? 'Kazi zitakuja baada ya shirika kukupangia kupitia mfumo.'
              : 'Badilisha kichujio kuona kazi nyingine.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => (
            <Link key={job.id} href={`/fundi/jobs/${job.id}`}>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:border-primary-100 transition">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-gray-900 text-sm leading-snug flex-1">{job.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[job.status as MaintenanceStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                    {MAINTENANCE_STATUS_LABELS[job.status as MaintenanceStatus] ?? job.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <i className="ti ti-building" aria-hidden="true" />
                    {job.org?.name ?? '—'}
                  </span>
                  {job.unit && (
                    <span className="flex items-center gap-1">
                      <i className="ti ti-door" aria-hidden="true" />
                      Kitengo {job.unit.unit_number}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full ${PRIORITY_COLORS[job.priority as MaintenancePriority] ?? 'bg-gray-100 text-gray-500'}`}>
                    {MAINTENANCE_PRIORITY_LABELS[job.priority as MaintenancePriority] ?? job.priority}
                  </span>
                  <span className="flex items-center gap-1 text-[10px]">
                    <i className="ti ti-tool" aria-hidden="true" />
                    {MAINTENANCE_CATEGORY_LABELS[job.category as MaintenanceCategory] ?? job.category}
                  </span>
                </div>
                {job.scheduled_at && (
                  <p className="text-xs text-primary-600 mt-1.5 flex items-center gap-1">
                    <i className="ti ti-calendar" aria-hidden="true" />
                    Ratiba: {fmt(job.scheduled_at)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
