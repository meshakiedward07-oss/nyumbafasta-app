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

const STATUS_META: Record<KycStatus, { label: string; bg: string; color: string }> = {
  pending:         { label: 'Inasubiri',      bg: '#faeeda', color: '#854f0b' },
  approved:        { label: 'Imeidhinishwa',  bg: '#eaf3de', color: '#3b6d11' },
  rejected:        { label: 'Imekataliwa',    bg: '#fcebeb', color: '#a32d2d' },
  needs_more_info: { label: 'Inahitaji Zaidi',bg: '#e6f1fb', color: '#185fa5' },
}

const FILTERS: { value: KycStatus | 'all'; label: string }[] = [
  { value: 'all',             label: 'Zote'           },
  { value: 'pending',         label: 'Inasubiri'      },
  { value: 'needs_more_info', label: 'Inahitaji Zaidi' },
  { value: 'approved',        label: 'Imeidhinishwa'  },
  { value: 'rejected',        label: 'Imekataliwa'    },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function docCount(row: KycRow) {
  return [row.id_document_url, row.title_deed_url, row.tax_cert_url].filter(Boolean).length
}

export default function KycTab() {
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

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { key: 'pending',        label: 'Inasubiri'      },
          { key: 'needs_more_info',label: 'Inahitaji Zaidi'},
          { key: 'approved',       label: 'Imeidhinishwa'  },
          { key: 'rejected',       label: 'Imekataliwa'    },
        ] as const).map(c => {
          const meta = STATUS_META[c.key]
          return (
            <button key={c.key} onClick={() => setTab(c.key)}
              className="rounded-xl p-4 text-left transition hover:shadow-sm"
              style={{
                background:  meta.bg,
                border: `1px solid ${tab === c.key ? meta.color : 'transparent'}`,
                outline: tab === c.key ? `2px solid ${meta.color}` : 'none',
                outlineOffset: '2px',
              }}>
              <p className="text-2xl font-bold" style={{ color: meta.color }}>{summary[c.key]}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: meta.color }}>{c.label}</p>
            </button>
          )
        })}
      </div>

      {/* Search + tabs + list */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e0' }}>
        <div className="p-4 flex flex-col sm:flex-row gap-3" style={{ borderBottom: '1px solid #e5e5e0' }}>
          <form onSubmit={e => { e.preventDefault(); load(tab, search) }} className="flex-1 flex gap-2">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tafuta jina, simu, au barua pepe..."
              className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              style={{ border: '1px solid #e5e5e0', color: '#1a1a18' }}
            />
            <button type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              Tafuta
            </button>
          </form>
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {FILTERS.map(f => (
              <button key={f.value} onClick={() => setTab(f.value)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition ${
                  tab === f.value ? 'bg-primary-500 text-white' : ''
                }`}
                style={tab !== f.value ? { background: '#f4f4f0', color: '#666660' } : {}}>
                {f.label}
                {f.value !== 'all' && (
                  <span className="ml-1 opacity-70">{summary[f.value as KycStatus] ?? 0}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#f4f4f0' }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <i className="ti ti-id text-5xl" style={{ color: '#e5e5e0' }} aria-hidden="true" />
            <p className="font-medium mt-3" style={{ color: '#666660' }}>Hakuna maombi ya KYC</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f4f4f0' }}>
            {rows.map(row => {
              const landlord = row.landlord
              const initials = landlord?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
              const docs     = docCount(row)
              const meta     = STATUS_META[row.status]

              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {landlord?.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={landlord.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-primary-600 font-bold text-xs">{initials}</span>
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate" style={{ color: '#1a1a18' }}>
                        {landlord?.full_name ?? 'Haijulikani'}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs" style={{ color: '#999992' }}>
                      <span>{landlord?.phone ?? landlord?.email ?? '—'}</span>
                      <span><i className="ti ti-file mr-0.5" aria-hidden="true" />{docs}/3 hati</span>
                      <span>Iliwasilishwa {fmtDate(row.submitted_at)}</span>
                      {row.reviewed_at && (
                        <span>
                          Ilikaguliwa {fmtDate(row.reviewed_at)}
                          {row.reviewer && ` na ${(row.reviewer as unknown as { full_name: string | null }).full_name}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/admin/property-management/kyc/${row.id}`}
                    className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition hover:bg-primary-50 hover:text-primary-700"
                    style={{ border: '1px solid #e5e5e0', color: '#666660' }}
                  >
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
