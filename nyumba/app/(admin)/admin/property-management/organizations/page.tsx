'use client'
import { useEffect, useState, useCallback } from 'react'

type OrgType   = 'landlord' | 'property_manager' | 'firm'
type OrgStatus = 'active' | 'suspended' | 'pending'

interface Org {
  id:           string
  name:         string
  org_type:     OrgType
  status:       OrgStatus
  region:       string | null
  district:     string | null
  phone:        string | null
  email:        string | null
  created_at:   string
  creator:      { id: string; full_name: string | null; phone: string | null } | null
  member_count: [{ count: number }] | null
  agreement_count: [{ count: number }] | null
}

interface Summary {
  total: number
  landlords: number
  property_managers: number
  firms: number
  active: number
  pending: number
}

const TYPE_LABELS: Record<OrgType, string> = {
  landlord:         'Mmiliki wa Nyumba',
  property_manager: 'Msimamizi wa Mali',
  firm:             'Kampuni ya Mali',
}
const TYPE_ICONS: Record<OrgType, string> = {
  landlord:         'home',
  property_manager: 'building',
  firm:             'briefcase',
}
const STATUS_META: Record<OrgStatus, { label: string; color: string }> = {
  active:    { label: 'Hai',       color: 'bg-green-100 text-green-700'  },
  pending:   { label: 'Inasubiri', color: 'bg-amber-100 text-amber-700' },
  suspended: { label: 'Imezuiwa', color: 'bg-red-100 text-red-600'     },
}

const TYPE_FILTERS: Array<{ value: OrgType | 'all'; label: string }> = [
  { value: 'all',              label: 'Aina Zote'          },
  { value: 'landlord',         label: 'Wamiliki'           },
  { value: 'property_manager', label: 'Wasimamizi'         },
  { value: 'firm',             label: 'Kampuni'            },
]
const STATUS_FILTERS: Array<{ value: OrgStatus | 'all'; label: string }> = [
  { value: 'all',       label: 'Zote'       },
  { value: 'active',    label: 'Hai'        },
  { value: 'pending',   label: 'Inasubiri'  },
  { value: 'suspended', label: 'Imezuiwa'  },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusToggle({ org, onDone }: { org: Org; onDone: () => void }) {
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const next: Array<{ status: OrgStatus; label: string; color: string }> = []
  if (org.status !== 'active')    next.push({ status: 'active',    label: 'Washa (Active)',   color: 'text-green-700 hover:bg-green-50 border-green-200' })
  if (org.status !== 'pending')   next.push({ status: 'pending',   label: 'Rudisha Kusubiri', color: 'text-amber-700 hover:bg-amber-50 border-amber-200' })
  if (org.status !== 'suspended') next.push({ status: 'suspended', label: 'Zuia Shirika',     color: 'text-red-700 hover:bg-red-50 border-red-200'       })

  async function update(status: OrgStatus) {
    setSaving(true)
    await fetch('/api/v1/admin/organizations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: org.id, status }),
    })
    setSaving(false)
    setOpen(false)
    onDone()
  }

  return (
    <div className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)} disabled={saving}
        className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition">
        {saving ? '...' : 'Badilisha'}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg p-1.5">
          {next.map(n => (
            <button key={n.status} onClick={() => update(n.status)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg border border-transparent font-medium transition ${n.color}`}>
              {n.label}
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

export default function OrganizationsPage() {
  const [orgs,     setOrgs]     = useState<Org[]>([])
  const [summary,  setSummary]  = useState<Summary>({ total: 0, landlords: 0, property_managers: 0, firms: 0, active: 0, pending: 0 })
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [typeTab,  setTypeTab]  = useState<OrgType | 'all'>('all')
  const [statusTab,setStatusTab]= useState<OrgStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async (q: string, type: OrgType | 'all', status: OrgStatus | 'all') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '60' })
      if (q.trim())          params.set('q', q.trim())
      if (type !== 'all')    params.set('type', type)
      if (status !== 'all')  params.set('status', status)
      const res  = await fetch(`/api/v1/admin/organizations?${params}`)
      const data = await res.json()
      setOrgs(data.organizations ?? [])
      if (data.summary) setSummary(data.summary)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(search, typeTab, statusTab) }, [typeTab, statusTab, load]) // eslint-disable-line react-hooks/exhaustive-deps

  const memberCount    = (org: Org) => (org.member_count    as unknown as [{ count: number }])?.[0]?.count ?? 0
  const agreementCount = (org: Org) => (org.agreement_count as unknown as [{ count: number }])?.[0]?.count ?? 0
  const creator        = (org: Org) => org.creator as unknown as { full_name: string | null; phone: string | null } | null

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mashirika</h1>
        <p className="text-sm text-gray-400 mt-0.5">Simamia mashirika yote yaliyosajiliwa kwenye mfumo</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: 'Yote',         value: summary.total,              color: 'bg-gray-50  border-gray-100  text-gray-700'   },
          { label: 'Hai',          value: summary.active,             color: 'bg-green-50 border-green-100 text-green-700'  },
          { label: 'Inasubiri',    value: summary.pending,            color: 'bg-amber-50 border-amber-100 text-amber-700'  },
          { label: 'Wamiliki',     value: summary.landlords,          color: 'bg-blue-50  border-blue-100  text-blue-700'   },
          { label: 'Wasimamizi',   value: summary.property_managers,  color: 'bg-purple-50 border-purple-100 text-purple-700'},
          { label: 'Kampuni',      value: summary.firms,              color: 'bg-teal-50  border-teal-100  text-teal-700'   },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-3 text-center ${c.color}`}>
            <p className="text-lg font-bold">{c.value}</p>
            <p className="text-[10px] font-medium opacity-80 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-50 space-y-3">
          <form onSubmit={e => { e.preventDefault(); load(search, typeTab, statusTab) }} className="flex gap-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tafuta shirika kwa jina..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            <button type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              Tafuta
            </button>
          </form>
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1">
              {TYPE_FILTERS.map(f => (
                <button key={f.value} onClick={() => setTypeTab(f.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${typeTab === f.value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {STATUS_FILTERS.map(f => (
                <button key={f.value} onClick={() => setStatusTab(f.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${statusTab === f.value ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-16">
            <i className="ti ti-building text-5xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-500 font-medium mt-3">Hakuna mashirika yaliyopatikana</p>
            <p className="text-sm text-gray-400 mt-1">Badilisha vichujio au tafuta jina lingine.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {orgs.map(org => {
              const mc  = memberCount(org)
              const ac  = agreementCount(org)
              const cr  = creator(org)
              const isExpanded = expanded === org.id
              const meta = STATUS_META[org.status]

              return (
                <div key={org.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      org.org_type === 'firm' ? 'bg-teal-50' : org.org_type === 'property_manager' ? 'bg-purple-50' : 'bg-blue-50'
                    }`}>
                      <i className={`ti ti-${TYPE_ICONS[org.org_type]} text-base ${
                        org.org_type === 'firm' ? 'text-teal-500' : org.org_type === 'property_manager' ? 'text-purple-500' : 'text-blue-500'
                      }`} aria-hidden="true" />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-gray-900 truncate">{org.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5 text-xs text-gray-400">
                        <span>{TYPE_LABELS[org.org_type]}</span>
                        {org.region && <span>{org.region}</span>}
                        <span>{mc} wanachama</span>
                        <span>{ac} makubaliano</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setExpanded(isExpanded ? null : org.id)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
                        <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'} text-sm`} aria-hidden="true" />
                      </button>
                      <StatusToggle org={org} onDone={() => load(search, typeTab, statusTab)} />
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-gray-50/60">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-gray-400 font-medium mb-0.5">Muundaji</p>
                          <p className="text-gray-700">{cr?.full_name ?? '—'}</p>
                          {cr?.phone && <p className="text-gray-400">{cr.phone}</p>}
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium mb-0.5">Mawasiliano</p>
                          <p className="text-gray-700">{org.phone ?? '—'}</p>
                          {org.email && <p className="text-gray-400 truncate">{org.email}</p>}
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium mb-0.5">Eneo</p>
                          <p className="text-gray-700">{org.district ?? '—'}{org.region ? `, ${org.region}` : ''}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium mb-0.5">Iliundwa</p>
                          <p className="text-gray-700">{fmtDate(org.created_at)}</p>
                          <p className="text-gray-400 font-mono text-[9px] mt-0.5 truncate">{org.id.slice(0, 8)}…</p>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <a href={`/property/dashboard?org=${org.id}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-white transition">
                          <i className="ti ti-external-link mr-1" aria-hidden="true" />Angalia Dashibodi
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!loading && orgs.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50">
            <p className="text-xs text-gray-400">Inaonyesha {orgs.length} ya {summary.total} mashirika</p>
          </div>
        )}
      </div>
    </div>
  )
}
