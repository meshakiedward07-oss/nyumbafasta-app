'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Lease } from '@/lib/types/property'

const STATUS_COLORS: Record<string, string> = {
  active:     'bg-green-50 text-green-700',
  draft:      'bg-gray-100 text-gray-500',
  expired:    'bg-amber-50 text-amber-700',
  terminated: 'bg-red-50 text-red-600',
  renewed:    'bg-blue-50 text-blue-700',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Inaendelea', draft: 'Rasimu', expired: 'Imekwisha',
  terminated: 'Imesimamishwa', renewed: 'Imefanywa Upya',
}

export default function WapangajiPage() {
  const [leases,  setLeases]  = useState<Lease[]>([])
  const [orgId,   setOrgId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all' | 'active' | 'ended'>('active')
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) return
        const id = primary.organization.id
        setOrgId(id)

        const lRes  = await fetch(`/api/v1/organizations/${id}/leases`)
        const lData = await lRes.json()
        setLeases(lData.leases ?? [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = leases.filter(l => {
    const matchesFilter =
      filter === 'all'    ? true :
      filter === 'active' ? l.status === 'active' :
      ['expired', 'terminated'].includes(l.status)

    const tenant = l.tenant as unknown as { full_name: string | null; phone: string | null } | null
    const matchesSearch = !search.trim() ||
      tenant?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      tenant?.phone?.includes(search)

    return matchesFilter && matchesSearch
  })

  const active    = leases.filter(l => l.status === 'active').length
  const totalRent = leases.filter(l => l.status === 'active').reduce((s, l) => s + l.monthly_rent, 0)

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Wapangaji</h1>
        <p className="text-sm text-gray-500">
          {active} wapangaji hai · TZS {totalRent.toLocaleString()}/mwezi
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Wapangaji Hai',     value: active,                       color: 'bg-green-50 text-green-600'  },
          { label: 'Jumla Kodi/Mwezi',  value: `TZS ${(totalRent/1000).toFixed(0)}K`, color: 'bg-primary-50 text-primary-600' },
          { label: 'Mikataba Yote',      value: leases.length,                color: 'bg-blue-50 text-blue-600'    },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
            <p className={`text-xl font-bold ${c.color.split(' ')[1]}`}>{c.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters & search */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['active', 'all', 'ended'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'active' ? 'Wanaoendelea' : f === 'all' ? 'Wote' : 'Waliokwisha'}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tafuta jina au simu..."
          className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-users text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">
            {leases.length === 0 ? 'Huna wapangaji bado' : 'Hakuna matokeo'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {leases.length === 0
              ? 'Nenda kwenye mali yako na ongeza mpangaji katika kitengo tupu.'
              : 'Badilisha vichujio ili kupata matokeo zaidi.'}
          </p>
          {leases.length === 0 && (
            <Link href="/property/mali">
              <button className="mt-4 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
                Angalia Mali Zangu
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lease => {
            const tenant  = lease.tenant as unknown as { id: string; full_name: string | null; phone: string | null; avatar_url?: string | null } | null
            const unit    = lease.unit    as unknown as { unit_number: string; unit_type: string } | null
            const listing = lease.listing as unknown as { title: string; district: string }        | null

            return (
              <div key={lease.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                    {tenant?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tenant.avatar_url} alt={tenant.full_name ?? ''} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-primary-600 font-bold text-sm">
                        {tenant?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{tenant?.full_name ?? 'Mpangaji'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lease.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[lease.status] ?? lease.status}
                      </span>
                    </div>
                    {tenant?.phone && (
                      <a href={`tel:${tenant.phone}`} className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 mt-0.5">
                        <i className="ti ti-phone" aria-hidden="true" /> {tenant.phone}
                      </a>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {unit && (
                        <span className="flex items-center gap-1">
                          <i className="ti ti-door" aria-hidden="true" />
                          {unit.unit_number}
                        </span>
                      )}
                      {listing && (
                        <Link href={`/property/mali/${lease.listing_id}`} className="flex items-center gap-1 hover:text-primary-600 truncate max-w-[160px]">
                          <i className="ti ti-building" aria-hidden="true" />
                          <span className="truncate">{listing.title}</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Rent + dates */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-primary-600 text-sm">
                      TZS {lease.monthly_rent.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">/mwezi</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(lease.start_date).toLocaleDateString('sw-TZ', { month: 'short', year: 'numeric' })}
                      {lease.end_date && ` – ${new Date(lease.end_date).toLocaleDateString('sw-TZ', { month: 'short', year: 'numeric' })}`}
                    </p>
                    {!lease.deposit_paid && lease.deposit_amount && (
                      <span className="text-[10px] text-amber-500 font-medium">Amana haijalipiwa</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Suppress unused orgId */}
      {orgId && <span className="hidden">{orgId}</span>}
    </div>
  )
}
