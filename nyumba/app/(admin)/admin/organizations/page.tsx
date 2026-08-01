'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Org {
  id:              string
  name:            string
  org_type:        string
  status:          string
  city:            string | null
  region:          string | null
  created_at:      string
  creator:         { id: string; full_name: string; phone: string | null } | null
  member_count:    [{ count: number }] | null
  agreement_count: [{ count: number }] | null
}

interface Summary {
  total:             number
  landlords:         number
  property_managers: number
  firms:             number
  active:            number
  pending:           number
}

const ORG_TYPE_LABEL: Record<string, string>  = {
  landlord:          'Mmiliki',
  property_manager:  'Msimamizi wa Mali',
  firm:              'Kampuni',
}
const STATUS_COLOR: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-700',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminOrganizationsPage() {
  const [orgs,    setOrgs]    = useState<Org[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [q,       setQ]       = useState('')
  const [type,    setType]    = useState('')
  const [status,  setStatus]  = useState('')
  const [offset,  setOffset]  = useState(0)

  const LIMIT = 30

  const load = useCallback(async (newOffset = offset) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(newOffset) })
    if (q)      params.set('q', q)
    if (type)   params.set('type', type)
    if (status) params.set('status', status)

    const res  = await fetch(`/api/v1/admin/organizations?${params}`)
    const json = await res.json()
    setOrgs(json.organizations ?? [])
    setTotal(json.count ?? 0)
    setSummary(json.summary ?? null)
    setLoading(false)
  }, [q, type, status, offset])

  useEffect(() => { load(0); setOffset(0) }, [q, type, status]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePageForward() {
    const next = offset + LIMIT
    setOffset(next)
    load(next)
  }
  function handlePageBack() {
    const prev = Math.max(0, offset - LIMIT)
    setOffset(prev)
    load(prev)
  }

  const pages = Math.ceil(total / LIMIT)
  const page  = Math.floor(offset / LIMIT) + 1

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mashirika</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} mashirika yaliyosajiliwa</p>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {[
            { label: 'Wote',         val: summary.total,             cls: 'bg-gray-50'         },
            { label: 'Wamiliki',     val: summary.landlords,         cls: 'bg-blue-50'         },
            { label: 'Wasimamizi',   val: summary.property_managers, cls: 'bg-purple-50'       },
            { label: 'Kampuni',      val: summary.firms,             cls: 'bg-indigo-50'       },
            { label: 'Hai',          val: summary.active,            cls: 'bg-green-50'        },
            { label: 'Wanasubiri',   val: summary.pending,           cls: 'bg-amber-50'        },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`${cls} rounded-xl p-3 text-center`}>
              <p className="text-xl font-bold text-gray-900 font-numeric">{val}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Tafuta jina la shirika..."
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          <option value="">Aina Zote</option>
          <option value="landlord">Mmiliki</option>
          <option value="property_manager">Msimamizi</option>
          <option value="firm">Kampuni</option>
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          <option value="">Hali Zote</option>
          <option value="active">Hai</option>
          <option value="pending">Wanasubiri</option>
          <option value="suspended">Imesimamishwa</option>
          <option value="cancelled">Imefutwa</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Inapakia...</div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Hakuna mashirika yanayolingana.</div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shirika</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aina</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hali</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Wanachama</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Makubaliano</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mwanzilishi</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarehe</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orgs.map(org => (
                    <tr key={org.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{org.name}</p>
                        {(org.city || org.region) && (
                          <p className="text-xs text-gray-400 mt-0.5">{[org.city, org.region].filter(Boolean).join(', ')}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {ORG_TYPE_LABEL[org.org_type] ?? org.org_type}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[org.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {org.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-numeric text-gray-700">
                        {org.member_count?.[0]?.count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center font-numeric text-gray-700">
                        {org.agreement_count?.[0]?.count ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        {org.creator ? (
                          <div>
                            <p className="text-gray-800">{org.creator.full_name}</p>
                            {org.creator.phone && (
                              <p className="text-xs text-gray-400">{org.creator.phone}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {fmtDate(org.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/organizations/${org.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 font-medium transition whitespace-nowrap"
                        >
                          Angalia →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={handlePageBack}
                disabled={offset === 0}
                className="text-sm px-4 py-2 rounded-xl border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                ← Iliyotangulia
              </button>
              <span className="text-sm text-gray-500">{page} / {pages}</span>
              <button
                onClick={handlePageForward}
                disabled={offset + LIMIT >= total}
                className="text-sm px-4 py-2 rounded-xl border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Inayofuata →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
