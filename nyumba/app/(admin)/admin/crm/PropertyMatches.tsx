'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SupabaseClient } from '@supabase/supabase-js'

type Lead = {
  id: string
  region?: string
  budget_min?: number
  budget_max?: number
  property_type?: string
}

type Listing = {
  id: string
  title: string
  type: string
  price_monthly: number
  district: string
  region: string
  images: string[] | null
  furnished: boolean
}

export default function PropertyMatches({
  lead,
  supabase,
}: {
  lead: Lead
  supabase: SupabaseClient
}) {
  const [matches, setMatches] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    findMatches()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  async function findMatches() {
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('listings')
        .select('id, title, type, price_monthly, district, region, images, furnished')
        .eq('status', 'active')

      if (lead.region) query = query.eq('region', lead.region)
      if (lead.budget_max) query = query.lte('price_monthly', lead.budget_max)
      if (lead.budget_min) query = query.gte('price_monthly', lead.budget_min)
      if (lead.property_type) query = query.eq('type', lead.property_type)

      const { data } = await query.limit(10)
      setMatches(data || [])
    } finally {
      setLoading(false)
    }
  }

  function formatPrice(amount: number) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`
    return `${amount}`
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🏠</div>
        <p className="text-gray-500 text-sm">
          Hakuna listings zinazolingana na mahitaji ya mteja
        </p>
        {!lead.region && (
          <p className="text-gray-400 text-xs mt-1">
            Weka region ya mteja ili kupata matches
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-2">
        🏠 Listings {matches.length} zinazolingana
      </p>
      {matches.map(listing => (
        <div key={listing.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="flex gap-3 p-3">
            {listing.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🏠</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800 line-clamp-1">{listing.title}</p>
              <p className="text-[#1D9E75] font-bold text-sm">
                Tsh {formatPrice(listing.price_monthly)}/mo
              </p>
              <p className="text-gray-400 text-xs">
                📍 {listing.district}, {listing.region}
              </p>
            </div>
          </div>
          <div className="px-3 pb-3">
            <Link href={`/listings/${listing.id}`} target="_blank">
              <button className="w-full bg-[#1D9E75] text-white py-2 rounded-xl text-xs font-semibold">
                Tuma Link kwa Mteja →
              </button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
