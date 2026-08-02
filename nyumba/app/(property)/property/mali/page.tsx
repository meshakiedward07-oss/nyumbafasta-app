'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Listing {
  id: string
  title: string
  type: string
  district: string
  region: string
  price_monthly: number
  images: string[]
  status: string
  lifecycle_status: string
  listing_source: string
  unit_count: number
  occupied_count: number
}

const TYPE_LABELS: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba',
  studio: 'Studio', duka: 'Duka',
}

export default function MaliPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [orgRole,  setOrgRole]  = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [total,    setTotal]    = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        if (!orgData.organizations?.length) return
        const primary = orgData.organizations.find((o: { role: string }) => o.role === 'owner') ?? orgData.organizations[0]
        const id   = primary.organization.id
        const role = primary.role
        setOrgRole(role)

        const mRes  = await fetch(`/api/v1/organizations/${id}/mali`)
        const mData = await mRes.json()
        setListings(mData.listings ?? [])
        setTotal(mData.total ?? 0)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const canAdd = ['owner', 'branch_manager'].includes(orgRole ?? '')

  const occupancyColor = (occ: number, tot: number) => {
    if (tot === 0) return 'text-gray-400'
    const pct = occ / tot
    return pct >= 0.9 ? 'text-green-600' : pct >= 0.5 ? 'text-amber-600' : 'text-red-500'
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mali Zangu</h1>
          <p className="text-sm text-gray-500">{total} mali zilizosajiliwa</p>
        </div>
        {canAdd && (
          <Link href="/property/mali/ongeza">
            <button className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              <i className="ti ti-building-plus" aria-hidden="true" />
              <span>Ongeza Mali</span>
            </button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-building text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Huna mali zilizosajiliwa bado</p>
          <p className="text-sm text-gray-400 mt-1">Ongeza mali yako ya kwanza ili uanze kusimamia.</p>
          {canAdd && (
            <Link href="/property/mali/ongeza">
              <button className="mt-4 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
                Ongeza Mali ya Kwanza
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(l => {
            const thumb = l.images?.[0]
            const occupancy = l.unit_count > 0 ? `${l.occupied_count}/${l.unit_count}` : '—'
            const pct = l.unit_count > 0 ? (l.occupied_count / l.unit_count) * 100 : 0

            return (
              <Link key={l.id} href={`/property/mali/${l.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition flex gap-4 cursor-pointer">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    {thumb ? (
                      <Image src={thumb} alt={l.title} fill sizes="80px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ti ti-building text-2xl text-gray-300" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-gray-900 text-sm leading-snug truncate">{l.title}</h2>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        l.lifecycle_status === 'listed'         ? 'bg-green-50 text-green-700' :
                        l.lifecycle_status === 'leased_managed' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {l.lifecycle_status === 'listed' ? 'Inatangazwa' :
                         l.lifecycle_status === 'leased_managed' ? 'Imepangishwa' : l.lifecycle_status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {TYPE_LABELS[l.type] ?? l.type} · {l.district}, {l.region}
                    </p>
                    <p className="text-sm font-bold text-primary-600 mt-1">
                      TZS {(l.price_monthly ?? 0).toLocaleString()}/mwezi
                    </p>

                    {l.unit_count > 0 ? (
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs text-gray-400">Vitengo vilivyopangishwa</span>
                          <span className={`text-xs font-bold ${occupancyColor(l.occupied_count, l.unit_count)}`}>
                            {occupancy}
                          </span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                        <i className="ti ti-alert-circle" aria-hidden="true" />
                        Hakuna vitengo vilivyoongezwa bado
                      </p>
                    )}
                  </div>

                  <i className="ti ti-chevron-right text-gray-300 self-center flex-shrink-0" aria-hidden="true" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

    </div>
  )
}
