'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PRIORITY_REGIONS,
  TANZANIA_REGIONS
} from '@/lib/data/tanzania-locations'

type Listing = {
  id: string
  title: string
  type: string
  status: string
  price_monthly: number
  district: string
  region: string
  furnished: string
  amenities: string[]
  images: string[]
  is_boosted: boolean
  view_count: number
  dalali: {
    full_name: string
    dalali_profiles: {
      rating_avg: number
      is_premium_verified: boolean
    } | null
  } | null
}

export default function HomeClient() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const showWelcome = searchParams.get('welcome') === 'true'

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState('Dar es Salaam')
  const [selectedType, setSelectedType] = useState('')
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('listings')
        .select(
          `id, title, type, status, price_monthly,
           district, region, furnished, amenities,
           images, is_boosted, view_count,
           dalali:dalali_id (
             full_name,
             dalali_profiles (rating_avg, is_premium_verified)
           )`,
          { count: 'exact' }
        )
        .eq('status', 'active')
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10)

      if (selectedRegion) query = query.eq('region', selectedRegion)
      if (selectedType) query = query.eq('type', selectedType)
      if (search) query = query.ilike('title', `%${search}%`)

      const { data, count, error } = await query
      if (error) throw error
      setListings((data as unknown as Listing[]) || [])
      setTotal(count || 0)
    } catch (err) {
      console.error('Fetch error:', err)
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [selectedRegion, selectedType, search, supabase])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  function formatPrice(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`
    return `${amount}`
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <header className="bg-[#1D9E75] sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="h-12 w-[55%] sm:w-[45%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/transparent_logo_nyumbafasta.png"
              alt="NyumbaFasta"
              className="h-full w-full object-contain object-left"
            />
          </div>
          <Link href="/account">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-lg">👤</span>
            </div>
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Tafuta mtaa, street..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>
        </div>
      </header>

      {/* Region tabs */}
      <div className="flex gap-2 px-3 py-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSelectedRegion('')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            selectedRegion === ''
              ? 'bg-[#1D9E75] text-white'
              : 'bg-white text-gray-500 border border-gray-200'
          }`}
        >
          🗺️ Zote
        </button>

        {PRIORITY_REGIONS.map(region => (
          <button
            key={region}
            onClick={() => setSelectedRegion(region)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedRegion === region
                ? 'bg-[#1D9E75] text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {region === 'Dar es Salaam'
              ? 'Dar'
              : region === 'Zanzibar Mjini Magharibi'
              ? 'Zanzibar'
              : region.split(' ')[0]}
          </button>
        ))}

        <select
          value={selectedRegion}
          onChange={e => setSelectedRegion(e.target.value)}
          className="flex-shrink-0 text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 focus:outline-none cursor-pointer"
        >
          <option value="">Mikoa Yote ▼</option>
          {TANZANIA_REGIONS.map(r => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Type filter */}
      <div className="px-3 pb-3">
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 focus:outline-none"
        >
          <option value="">Aina yote</option>
          <option value="chumba">Chumba</option>
          <option value="apartment">Apartment</option>
          <option value="nyumba">Nyumba</option>
          <option value="studio">Studio</option>
        </select>
      </div>

      {/* Count */}
      <p className="px-3 text-sm text-gray-500 mb-3">
        {loading
          ? 'Inapakia...'
          : `${total} listings ${selectedRegion ? `— ${selectedRegion}` : '— Tanzania Yote'}`}
      </p>

      {/* Listings */}
      <div className="px-3 grid gap-4">

        {/* Skeleton */}
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
            <div className="h-44 bg-gray-200" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}

        {/* Cards */}
        {!loading && listings.map(listing => (
          <Link key={listing.id} href={`/listings/${listing.id}`}>
            <div className={`bg-white rounded-2xl overflow-hidden border transition-all hover:shadow-md ${
              listing.is_boosted ? 'border-yellow-300 ring-1 ring-yellow-200' : 'border-gray-100'
            }`}>

              {listing.is_boosted && (
                <div className="bg-yellow-400 text-white text-xs font-medium px-3 py-1 text-center">
                  🚀 Inashauriwa
                </div>
              )}

              <div className="relative h-44 bg-gray-100">
                {listing.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <span className="text-4xl">🏠</span>
                  </div>
                )}

                <div className="absolute top-2 left-2 bg-[#1D9E75] text-white text-xs px-2 py-0.5 rounded-full">
                  Inapatikana
                </div>

                {listing.images?.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                    📷 {listing.images.length}
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-semibold text-gray-900 text-sm flex-1 leading-tight">
                    {listing.title}
                  </p>
                  <p className="text-[#1D9E75] font-bold text-sm whitespace-nowrap ml-2">
                    {formatPrice(listing.price_monthly)}/mo
                  </p>
                </div>

                <p className="text-gray-500 text-xs mb-2">
                  📍 {listing.district}, {listing.region}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[#1D9E75] text-xs font-bold">
                      {listing.dalali?.full_name?.[0] || 'D'}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {listing.dalali?.full_name}
                      </p>
                      {listing.dalali?.dalali_profiles?.rating_avg && (
                        <p className="text-xs text-gray-400">
                          ⭐ {listing.dalali.dalali_profiles.rating_avg}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">👁 {listing.view_count}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {/* Empty state */}
        {!loading && listings.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏠</div>
            <p className="font-semibold text-gray-700">
              {selectedRegion
                ? `${selectedRegion} — Bado Tunaanza!`
                : 'Hakuna listings zinazolingana'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Jaribu mkoa mwingine au ondoa filters
            </p>
            <button
              onClick={() => {
                setSelectedRegion('')
                setSelectedType('')
                setSearch('')
              }}
              className="mt-4 text-[#1D9E75] text-sm underline"
            >
              Ondoa filters zote
            </button>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 z-10">
        <div className="flex justify-around max-w-sm mx-auto">
          <button className="flex flex-col items-center gap-0.5 text-[#1D9E75]">
            <span className="text-xl">🔍</span>
            <span className="text-xs font-medium">Tafuta</span>
          </button>
          <Link href="/saved" className="flex flex-col items-center gap-0.5 text-gray-400">
            <span className="text-xl">❤️</span>
            <span className="text-xs">Saved</span>
          </Link>
          <Link href="/notifications" className="flex flex-col items-center gap-0.5 text-gray-400">
            <span className="text-xl">🔔</span>
            <span className="text-xs">Arifa</span>
          </Link>
          <Link href="/account" className="flex flex-col items-center gap-0.5 text-gray-400">
            <span className="text-xl">👤</span>
            <span className="text-xs">Akaunti</span>
          </Link>
        </div>
      </div>

      {/* Welcome Modal — inaonekana baada ya kuthibitisha email */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="font-bold text-xl mb-2 text-gray-900">Karibu NyumbaFasta!</h2>
            <p className="text-gray-500 text-sm mb-5 leading-relaxed">
              Akaunti yako imethibitishwa vizuri. Uko tayari kutafuta nyumba na vyumba Tanzania!
            </p>
            <button
              onClick={() => router.replace('/')}
              className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
            >
              Anza Kutumia →
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Support */}
      <a
        href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

    </div>
  )
}
