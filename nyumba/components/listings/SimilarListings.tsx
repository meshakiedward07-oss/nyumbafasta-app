'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type SimilarListingsProps = {
  currentListingId: string
  region: string
  district: string
  type: string
  priceMonthly: number
}

type SimilarListing = {
  id: string
  title: string
  type: string
  price_monthly: number
  district: string
  region: string
  images: string[]
  is_boosted: boolean
  dalali: {
    full_name: string
    dalali_profiles: {
      rating_avg: number
      is_premium_verified: boolean
    } | null
  } | null
}

function formatPrice(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`
  return `${amount}`
}

export default function SimilarListings({
  currentListingId,
  region,
  district,
  type,
  priceMonthly,
}: SimilarListingsProps) {
  const supabase = createClient()
  const [listings, setListings] = useState<SimilarListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSimilar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentListingId])

  async function fetchSimilar() {
    setLoading(true)
    try {
      const minPrice = priceMonthly * 0.5
      const maxPrice = priceMonthly * 1.5

      // Step 1: same district + same type (bora zaidi)
      const { data: byDistrict } = await supabase
        .from('listings')
        .select(`
          id, title, type, price_monthly,
          district, region, images, is_boosted,
          dalali:dalali_id (
            full_name,
            dalali_profiles (rating_avg, is_premium_verified, is_favourite_dalali)
          )
        `)
        .eq('status', 'active')
        .eq('district', district)
        .eq('type', type)
        .neq('id', currentListingId)
        .limit(3)

      if (byDistrict && byDistrict.length >= 3) {
        setListings(byDistrict as unknown as SimilarListing[])
        return
      }

      // Step 2: same region + same type
      const { data: byType } = await supabase
        .from('listings')
        .select(`
          id, title, type, price_monthly,
          district, region, images, is_boosted,
          dalali:dalali_id (
            full_name,
            dalali_profiles (rating_avg, is_premium_verified, is_favourite_dalali)
          )
        `)
        .eq('status', 'active')
        .eq('region', region)
        .eq('type', type)
        .neq('id', currentListingId)
        .limit(3)

      if (byType && byType.length >= 3) {
        setListings(byType as unknown as SimilarListing[])
        return
      }

      // Step 3: same region + bei karibu (±50%)
      const { data: byPrice } = await supabase
        .from('listings')
        .select(`
          id, title, type, price_monthly,
          district, region, images, is_boosted,
          dalali:dalali_id (
            full_name,
            dalali_profiles (rating_avg)
          )
        `)
        .eq('status', 'active')
        .eq('region', region)
        .neq('id', currentListingId)
        .gte('price_monthly', minPrice)
        .lte('price_monthly', maxPrice)
        .limit(3)

      // Combine na deduplicate
      const combined = [...(byDistrict || []), ...(byType || []), ...(byPrice || [])]
      const seen = new Set<string>()
      const unique = combined.filter(item => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })

      setListings((unique.slice(0, 3)) as unknown as SimilarListing[])
    } catch (err) {
      console.error('Similar listings error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-4">
        <p className="font-semibold text-gray-800 mb-3"><i className="ti ti-map-pin" aria-hidden="true" /> Unaweza kupenda pia</p>
        <div className="flex gap-3 overflow-x-auto scrollbar-none">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="flex-shrink-0 w-44 bg-white rounded-xl overflow-hidden border border-gray-100 animate-pulse"
            >
              <div className="h-28 bg-gray-200" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (listings.length === 0) return null

  return (
    <div className="py-4 border-t border-gray-100">
      <div className="px-4 mb-3 flex items-center justify-between">
        <p className="font-semibold text-gray-800"><i className="ti ti-map-pin" aria-hidden="true" /> Unaweza kupenda pia</p>
        <Link
          href={`/?region=${encodeURIComponent(region)}&type=${type}`}
          className="text-xs text-primary-500 underline"
        >
          Ona zaidi →
        </Link>
      </div>

      {/* Horizontal scroll cards */}
      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-none pb-2">
        {listings.map(listing => (
          <Link key={listing.id} href={`/listings/${listing.id}`} className="flex-shrink-0 w-44">
            <div className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">

              {/* Image */}
              <div className="relative h-28 bg-gray-100">
                {listing.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <i className="ti ti-home text-3xl text-gray-300" aria-hidden="true" />
                  </div>
                )}

                {listing.is_boosted && (
                  <div className="absolute top-1.5 left-1.5 bg-yellow-400 text-white text-xs px-1.5 py-0.5 rounded-full">
                    <i className="ti ti-rocket" aria-hidden="true" />
                  </div>
                )}

                <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full capitalize">
                  {listing.type}
                </div>
              </div>

              {/* Content */}
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-800 leading-tight line-clamp-1 mb-1">
                  {listing.title}
                </p>
                <p className="text-primary-500 font-bold text-xs mb-1">
                  Tsh {formatPrice(listing.price_monthly)}/mwezi
                </p>
                <p className="text-gray-400 text-xs line-clamp-1"><i className="ti ti-map-pin" aria-hidden="true" /> {listing.district}</p>
                {listing.dalali?.dalali_profiles?.rating_avg && (
                  <p className="text-gray-400 text-xs mt-0.5">
                    <i className="ti ti-star-filled text-amber-400 mr-0.5" aria-hidden="true" />{listing.dalali.dalali_profiles.rating_avg}
                    {listing.dalali.dalali_profiles.is_premium_verified && (
                      <i className="ti ti-circle-check text-primary-500 ml-1" aria-hidden="true" />
                    )}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
