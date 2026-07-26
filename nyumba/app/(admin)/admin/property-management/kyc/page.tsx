'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type KycStatus = 'pending' | 'approved' | 'rejected' | 'needs_more_info'

interface KycRow {
  id:               string
  status:           KycStatus
  submitted_at:     string
  reviewed_at:      string | null
  id_document_url:  string | null
  title_deed_url:   string | null
  tax_cert_url:     string | null
  notes:            string | null
  rejection_reason: string | null
  landlord: { id: string; full_name: string | null; phone: string | null; email: string | null; avatar_url: string | null } | null
  reviewer: { id: string; full_name: string | null } | null
  service_request: {
    id: string; request_type: string; status: string
    listing: { id: string; title: string; region: string; district: string } | null
  } | null
}

interface Summary { pending: number; approved: number; rejected: number; needs_more_info: number }

const STATUS_LABELS: Record<KycStatus, string> = {
  pending:        'Inasubiri',
  approved:       'Imeidhinishwa',
  rejected:       'Imekataliwa',
  needs_more_info:'Inahitaji Zaidi',
}
const STATUS_COLORS: Record<KycStatus, string> = {
  pending:        'bg-amber-100 text-amber-700',
  approved:       'bg-green-100 text-green-700',
  rejected:       'bg-red-100 text-red-700',
  needs_more_info:'bg-blue-100 text-blue-700',
}

const FILTERS: { value: KycStatus | 'all'; label: string }[] = [
  { value: 'all',            label: 'Zote'          },
  { value: 'pending',        label: 'Inasubiri'     },
  { value: 'needs_more_info',label: 'Inahitaji Zaidi'},
  { value: 'approved',       label: 'Imeidhinishwa' },
  { value: 'rejected',       label: 'Imekataliwa'   },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function docCount(row: KycRow) {
  return [row.id_document_url, row.title_deed_url, row.tax_cert_url].filter(Boolean).length
}

export default function AdminKycPage() {
  const [rows,    setRows]    = useState<KycRow[]>([])
  const [summary, setSummary] = useState<Summary>({ pending: 0, approved: 0, rejected: 0, needs_more_info: 0 })
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<KycStatus | 'all'>('pending')
  const [search,  setSearch]  = useState('')

  async function load(status: KycStatus | 'all', q: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (q.trim()) params.set('search', q.trim())
      const res  = await fetch(`/api/v1/admin/kyc?${params}`)
      const data = await res.json()
      setRows(data.submissions ?? [])
      if (data.summary) setSummary(data.summary)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load(tab, search) }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load(tab, search)
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">KYC — Uthibitisho wa Wamiliki</h1>
        <p className="text-sm text-gray-400 mt-0.5">Kagua na thibitisha hati za wamiliki wa mali</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {([
          { key: 'pending',        label: 'Inasubiri',      color: 'bg-amber-50 text-amber-600 border-amber-100' },
          { key: 'needs_more_info',label: 'Inahitaji Zaidi',color: 'bg-blue-50  text-blue-600  border-blue-100'  },
          { key: 'approved',       label: 'Imeidhinishwa',  color: 'bg-green-50 text-green-600 border-green-100' },
          { key: 'rejected',       label: 'Imekataliwa',    color: 'bg-red-50   text-red-600   border-red-100'   },
        ] as const).map(c => (
          <button key={c.key} onClick={() => setTab(c.key)}
            className={`border rounded-2xl p-4 text-left transition hover:shadow-sm ${c.color} ${tab === c.key ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
            <p className="text-2xl font-bold">{summary[c.key]}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Search + tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tafuta jina, simu, au barua pepe..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              Tafuta
            </button>
          </form>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button key={f.value} onClick={() => setTab(f.value)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition ${
                  tab === f.value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {f.label}
                {f.value !== 'all' && (
                  <span className="ml-1 opacity-70">{summary[f.value as KycStatus] ?? 0}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <i className="ti ti-id text-5xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-500 font-medium mt-3">Hakuna maombi ya KYC</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map(row => {
              const landlord = row.landlord as unknown as typeof row.landlord
              const initials = landlord?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
              const docs = docCount(row)

              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {landlord?.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={landlord.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-primary-600 font-bold text-xs">{initials}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {landlord?.full_name ?? 'Haijulikani'}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{landlord?.phone ?? landlord?.email ?? '—'}</span>
                      <span className="text-xs text-gray-400">
                        <i className="ti ti-file mr-0.5" aria-hidden="true" />{docs}/3 hati
                      </span>
                      <span className="text-xs text-gray-400">
                        Iliwasilishwa {fmtDate(row.submitted_at)}
                      </span>
                      {row.reviewed_at && (
                        <span className="text-xs text-gray-400">
                          Ilikaguliwa {fmtDate(row.reviewed_at)}
                          {row.reviewer && ` na ${(row.reviewer as unknown as { full_name: string | null }).full_name}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <Link href={`/admin/property-management/kyc/${row.id}`}
                    className="flex-shrink-0 px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 transition">
                    {row.status === 'pending' || row.status === 'needs_more_info' ? 'Kagua' : 'Angalia'}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
