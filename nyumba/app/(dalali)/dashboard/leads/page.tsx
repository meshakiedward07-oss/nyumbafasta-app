'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const MONTHS = ['','Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ago','Sep','Okt','Nov','Des']
function dateFmt(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth() + 1]} ${d.getFullYear()}`
}
function timeFmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('sw', { hour: '2-digit', minute: '2-digit' })
}
function fmt(n: number) { return `TZS ${(n ?? 0).toLocaleString()}` }

interface Listing { id: string; title: string; type: string; district: string; region: string; price_monthly: number }
interface Client  { id: string; full_name: string | null; phone: string | null }
interface Lead    {
  id: string; created_at: string; amount_paid: number; payment_method: string | null
  listing: Listing | null; client: Client | null
}

const TYPE: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
}

export default function LeadsPage() {
  const [leads,      setLeads]      = useState<Lead[]>([])
  const [myListings, setMyListings] = useState<{ id: string; title?: string; type: string; district: string }[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [q,          setQ]          = useState('')
  const [listingId,  setListingId]  = useState('')
  const [inputQ,     setInputQ]     = useState('')

  const load = useCallback(async (p = 1, query = q, lid = listingId) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (query)  params.set('q', query)
      if (lid)    params.set('listing_id', lid)
      const res  = await fetch(`/api/v1/dalali/leads?${params}`)
      const json = await res.json()
      if (p === 1) setLeads(json.leads ?? [])
      else setLeads(prev => [...prev, ...(json.leads ?? [])])
      setTotal(json.total ?? 0)
      setMyListings(json.listings ?? [])
    } finally { setLoading(false) }
  }, [q, listingId])

  useEffect(() => { load(1) }, [load])

  function handleSearch() {
    setQ(inputQ)
    setPage(1)
    load(1, inputQ, listingId)
  }

  function handleListingFilter(lid: string) {
    setListingId(lid)
    setPage(1)
    load(1, q, lid)
  }

  function loadMore() {
    const next = page + 1
    setPage(next)
    load(next)
  }

  const hasMore = leads.length < total

  // Group leads by date
  const groups: { date: string; items: Lead[] }[] = []
  for (const l of leads) {
    const d = dateFmt(l.created_at)
    const last = groups[groups.length - 1]
    if (last?.date === d) last.items.push(l)
    else groups.push({ date: d, items: [l] })
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/dashboard" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white">
            <i className="ti ti-arrow-left text-lg" />
          </Link>
          <div>
            <h1 className="text-white text-lg font-bold">Historia ya Leads</h1>
            <p className="text-green-100 text-xs">{total} watu waliofungua mawasiliano yako</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Tafuta jina au simu..."
              value={inputQ}
              onChange={e => setInputQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
          <button onClick={handleSearch} className="px-4 py-2.5 bg-white/20 text-white text-sm font-medium rounded-xl hover:bg-white/30 transition-colors">
            Tafuta
          </button>
        </div>
      </div>

      {/* Listing filter chips */}
      {myListings.length > 1 && (
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => handleListingFilter('')}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!listingId ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Zote
            </button>
            {myListings.map(l => (
              <button
                key={l.id}
                onClick={() => handleListingFilter(l.id)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${listingId === l.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {TYPE[l.type] ?? l.type} — {l.district}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4">
        {loading && leads.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm">
              <i className="ti ti-phone-off text-3xl text-gray-300" />
            </div>
            <p className="font-semibold text-gray-600">Hakuna leads bado</p>
            <p className="text-sm text-gray-400 mt-1">Wateja watakaofungua nambari yako wataonekana hapa</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(group => (
              <div key={group.date}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">{group.date}</p>
                <div className="space-y-2">
                  {group.items.map(lead => {
                    const client   = lead.client
                    const listing  = lead.listing
                    const phone    = client?.phone
                    const waLink   = phone ? `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '255')}` : null
                    const callLink = phone ? `tel:${phone}` : null

                    return (
                      <div key={lead.id} className="bg-white rounded-2xl border border-gray-100 p-3.5">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <i className="ti ti-user text-primary-500 text-lg" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">
                                  {client?.full_name ?? 'Mteja'}
                                </p>
                                {phone && (
                                  <p className="text-xs text-gray-500 mt-0.5">{phone}</p>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-400 flex-shrink-0">{timeFmt(lead.created_at)}</span>
                            </div>

                            {listing && (
                              <div className="mt-2 bg-gray-50 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                                <i className="ti ti-home text-xs text-gray-400" />
                                <span className="text-xs text-gray-600 truncate">
                                  {listing.title ?? `${TYPE[listing.type] ?? listing.type} — ${listing.district}`}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-2.5">
                              <span className="text-[11px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                                {fmt(lead.amount_paid)} imelipwa
                              </span>
                              <div className="flex gap-2">
                                {callLink && (
                                  <a href={callLink}
                                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                                  >
                                    <i className="ti ti-phone text-sm" />
                                  </a>
                                )}
                                {waLink && (
                                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-600 transition-colors"
                                  >
                                    <i className="ti ti-brand-whatsapp text-sm" /> WhatsApp
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Inapakia...' : `Pakia zaidi (${total - leads.length} zimebaki)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
