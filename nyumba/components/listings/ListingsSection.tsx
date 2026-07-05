'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import ListingCard from '@/components/listings/ListingCard'
import { ListingGridSkeleton } from '@/components/shared/ListingCardSkeleton'
import BottomNav from '@/components/shared/BottomNav'
import { TANZANIA_REGIONS, PRIORITY_REGIONS, shortName } from '@/lib/data/tanzania-locations'
import type { ListingWithDalali } from '@/lib/types/database'

const MapView = dynamic(() => import('@/components/listings/MapView'), {
  ssr: false,
  loading: () => (
    <div className="mx-4 rounded-2xl bg-gray-100 animate-pulse" style={{ height: '70vh' }} />
  ),
})

const TYPES = [
  { value: '', label: 'Aina yote' },
  { value: 'chumba', label: 'Chumba' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'nyumba', label: 'Nyumba' },
  { value: 'studio', label: 'Studio' },
  { value: 'duka', label: 'Duka' },
]

const LIMIT = 10

const LISTING_FIELDS = `
  id, title, type, status, price_monthly,
  district, region, furnished, amenities,
  images, is_boosted, boosted_until,
  view_count, lead_count, share_count, latitude, longitude,
  dalali_id,
  dalali:dalali_id (
    id, full_name, avatar_url,
    dalali_profiles ( rating_avg, is_premium_verified )
  )
`

type Filters = {
  region: string
  type: string
  min_price: string
  max_price: string
  furnished: string
  search: string
}

type Props = {
  initialListings?: ListingWithDalali[]
  initialTotal?: number
}

export default function ListingsSection({ initialListings, initialTotal }: Props = {}) {
  const supabase = createClient()

  // Start with server-fetched data if provided — avoids client-side waterfall on first load
  const hasInitialData = !!(initialListings?.length)
  const skippedFirstFetch = useRef(hasInitialData)

  const [listings, setListings]       = useState<ListingWithDalali[]>(initialListings ?? [])
  const [total, setTotal]             = useState(initialTotal ?? 0)
  const [loading, setLoading]         = useState(!hasInitialData)
  const [page, setPage]               = useState(1)
  const [viewMode, setViewMode]       = useState<'grid' | 'map'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [userRole, setUserRole]       = useState<string | null>(null)
  const [, setUserId]                 = useState<string | null>(null)
  const [unlockedIds, setUnlockedIds] = useState<string[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters]         = useState<Filters>({
    region:    '',
    type:      '',
    min_price: '',
    max_price: '',
    furnished: '',
    search:    '',
  })

  // Fetch current user once on mount
  useEffect(() => {
    let cancelled = false
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUserId(user.id)
      const [{ data: userData }, { data: unlocked }] = await Promise.all([
        supabase.from('users').select('role').eq('id', user.id).single(),
        supabase.from('contact_unlocks')
          .select('listing_id')
          .eq('client_id', user.id)
          .eq('status', 'completed'),
      ])
      if (!cancelled) {
        setUserRole(userData?.role ?? null)
        setUnlockedIds((unlocked ?? []).map(u => u.listing_id as string))
      }
    }
    loadUser()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch listings whenever filters or page change
  const fetchListings = useCallback(async (isNewSearch: boolean) => {
    if (isNewSearch) setLoading(true)
    const from = isNewSearch ? 0 : (page - 1) * LIMIT

    try {
      let query = supabase
        .from('listings')
        .select(LISTING_FIELDS, { count: 'exact' })
        .eq('status', 'active')
        .order('is_boosted', { ascending: false })
        .order('boosted_until', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, from + LIMIT - 1)

      if (filters?.region)    query = query.eq('region', filters.region)
      if (filters?.type)      query = query.eq('type', filters.type)
      if (filters?.min_price) query = query.gte('price_monthly', parseInt(filters.min_price))
      if (filters?.max_price) query = query.lte('price_monthly', parseInt(filters.max_price))
      if (filters?.furnished) query = query.eq('furnished', filters.furnished)
      if (filters?.search) {
        const term = filters.search.replace(/[%_]/g, '\\$&')
        query = query.or(`title.ilike.%${term}%,district.ilike.%${term}%,ward.ilike.%${term}%,mtaa.ilike.%${term}%`)
      }

      const { data, count, error } = await query
      if (error) throw error

      const priorityOrder: Record<string, number> = { top: 0, high: 1, medium: 2, low: 3 }
      const raw = (data as unknown as ListingWithDalali[]) ?? []
      const rows = raw.sort((a, b) => {
        if (a.is_boosted !== b.is_boosted) return a.is_boosted ? -1 : 1
        const aPriority = priorityOrder[(a.dalali as { plan_priority?: string } | null)?.plan_priority ?? 'low'] ?? 3
        const bPriority = priorityOrder[(b.dalali as { plan_priority?: string } | null)?.plan_priority ?? 'low'] ?? 3
        return aPriority - bPriority
      })
      setListings(prev => isNewSearch ? rows : [...prev, ...rows])
      setTotal(count ?? 0)
    } catch (err) {
      console.error('Listings fetch error:', err)
      if (isNewSearch) setListings([])
    } finally {
      setLoading(false)
    }
  }, [filters, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // When filters change → reset to page 1 and fetch fresh
  // Skip on first mount if initial data was provided by server (avoids double-fetch)
  useEffect(() => {
    if (skippedFirstFetch.current) {
      skippedFirstFetch.current = false
      return
    }
    setPage(1)
    fetchListings(true)
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  // When page increments (load more) → append
  useEffect(() => {
    if (page === 1) return
    fetchListings(false)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(key: keyof Filters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value ?? '' }))
  }

  // Debounce search — 300ms delay before firing Supabase query
  useEffect(() => {
    const t = setTimeout(() => applyFilter('search', searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearFilters() {
    setSearchInput('')
    setFilters({ region: '', type: '', min_price: '', max_price: '', furnished: '', search: '' })
  }

  const hasExtraFilters = !!(filters?.min_price || filters?.max_price || filters?.furnished)
  const boosted = listings.filter(l => l.is_boosted)

  return (
    <div className="bg-gray-50 pb-20">

      {/* ── Search bar ── */}
      <div className="bg-primary-500 px-3 pb-3">
        <div className="relative">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
          <input
            type="search"
            inputMode="search"
            placeholder="Tafuta mtaa, wilaya..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white text-base
                       text-gray-900 placeholder-gray-400 focus:outline-none
                       focus:ring-2 focus:ring-white/50 shadow-sm"
          />
        </div>
      </div>

      {/* ── Region tabs ── */}
      <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => applyFilter('region', '')}
          className={`flex-shrink-0 px-3.5 min-h-[36px] rounded-full text-xs font-medium transition-all duration-150
            ${(filters?.region ?? '') === '' ? 'bg-primary-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'}`}
        >
          <i className="ti ti-map" aria-hidden="true" /> Zote
        </button>

        {PRIORITY_REGIONS.map(r => (
          <button
            key={r}
            onClick={() => applyFilter('region', r)}
            className={`flex-shrink-0 px-3.5 min-h-[36px] rounded-full text-xs font-medium transition-all duration-150
              ${(filters?.region ?? '') === r ? 'bg-primary-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'}`}
          >
            {shortName(r)}
          </button>
        ))}

        <select
          value={PRIORITY_REGIONS.includes(filters?.region ?? '') ? '' : (filters?.region ?? '')}
          onChange={e => { if (e.target.value) applyFilter('region', e.target.value) }}
          className={`flex-shrink-0 text-xs border rounded-full px-3.5 min-h-[36px]
            focus:outline-none cursor-pointer
            ${!PRIORITY_REGIONS.includes(filters?.region ?? '') && filters?.region
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white text-gray-500 border-gray-200'}`}
        >
          <option value="">Mikoa Yote</option>
          {TANZANIA_REGIONS.map(r => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* ── Filter row ── */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
        <select
          value={filters?.type ?? ''}
          onChange={e => applyFilter('type', e.target.value)}
          className="flex-shrink-0 text-xs bg-white border border-gray-200
                     rounded-full px-3.5 min-h-[36px] text-gray-600 focus:outline-none"
        >
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex-shrink-0 text-xs px-3.5 min-h-[36px] rounded-full border
            transition-all duration-150 flex items-center gap-1.5
            ${showFilters ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          <i className="ti ti-adjustments" aria-hidden="true" /> Filters
          {hasExtraFilters && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
        </button>

        {(hasExtraFilters || filters?.region || filters?.type) && (
          <button
            onClick={clearFilters}
            className="flex-shrink-0 text-xs bg-red-50 text-red-500 border border-red-100 rounded-full px-3.5 min-h-[36px] flex items-center gap-1"
          >
            <i className="ti ti-x" aria-hidden="true" /> Futa
          </button>
        )}
      </div>

      {/* ── Expanded filters ── */}
      {showFilters && (
        <div className="mx-4 mb-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Mkoa</label>
              <select
                value={filters?.region ?? ''}
                onChange={e => applyFilter('region', e.target.value)}
                className="w-full text-base border border-gray-200 rounded-xl px-3 py-2.5
                           focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="">Mikoa Yote Tanzania</option>
                {TANZANIA_REGIONS.map(r => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bei ya chini (Tsh)</label>
              <input
                type="number" inputMode="numeric" placeholder="50,000"
                value={filters?.min_price ?? ''}
                onChange={e => applyFilter('min_price', e.target.value)}
                className="w-full text-base border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bei ya juu (Tsh)</label>
              <input
                type="number" inputMode="numeric" placeholder="500,000"
                value={filters?.max_price ?? ''}
                onChange={e => applyFilter('max_price', e.target.value)}
                className="w-full text-base border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Hali ya samani</label>
              <div className="flex gap-2">
                {[{ value: '', label: 'Yote' }, { value: 'furnished', label: 'Ina Samani' }, { value: 'semi', label: 'Nusu Samani' }, { value: 'empty', label: 'Bila Samani' }].map(f => (
                  <button
                    key={f.value}
                    onClick={() => applyFilter('furnished', f.value)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-all
                      ${(filters?.furnished ?? '') === f.value ? 'bg-primary-500 text-white border-primary-500' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Count + view toggle ── */}
      <div className="px-4 mb-3 flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {loading
            ? 'Inatafuta...'
            : `${total} listing${total !== 1 ? 's' : ''}${filters?.region ? ` – ${filters.region}` : ''}`}
        </p>
        <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
          >
            <i className="ti ti-layout-grid" aria-hidden="true" /> Grid
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
          >
            <i className="ti ti-map" aria-hidden="true" /> Ramani
          </button>
        </div>
      </div>

      {/* ── Boosted strip — grid only ── */}
      {viewMode === 'grid' && !loading && boosted.length > 0 && (
        <div className="mb-2">
          <div className="px-4 flex items-center gap-2 mb-2">
            <i className="ti ti-star-filled text-amber-400 text-base" aria-hidden="true" />
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Zinashauriwa na NyumbaFasta
            </p>
          </div>
          <div className="relative">
            <div className="flex gap-3 px-4 overflow-x-auto scrollbar-none pb-1">
              {boosted.map(listing => (
                <div key={listing.id} className="flex-shrink-0 w-64">
                  <ListingCard listing={listing} hasUnlocked={unlockedIds.includes(listing.id)} />
                </div>
              ))}
            </div>
            <div className="absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
          </div>
          <div className="border-b border-gray-200 mt-4 mx-4" />
        </div>
      )}

      {/* ── Map view ── */}
      {viewMode === 'map' && <MapView listings={listings} />}

      {/* ── Grid view ── */}
      {viewMode === 'grid' && (
        <div className="px-4 grid gap-4">
          {loading ? (
            <ListingGridSkeleton count={6} />
          ) : listings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4 flex justify-center"><i className="ti ti-map text-gray-400" aria-hidden="true" /></div>
              {filters?.region ? (
                <>
                  <p className="text-gray-700 font-semibold mb-1">Hakuna nyumba {filters.region}</p>
                  <p className="text-gray-400 text-sm mb-5 px-4">
                    Hakuna listings zinazopatikana kwenye mkoa huu sasa hivi.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 bg-primary-500 text-white
                               px-5 py-3 rounded-xl text-sm font-semibold active:scale-[0.97] transition-all"
                  >
                    <i className="ti ti-search" aria-hidden="true" /> Tafuta Mikoa Mingine
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-600 font-medium mb-1">Hakuna listings zinazolingana</p>
                  <p className="text-gray-400 text-sm mb-4">Jaribu kubadilisha filters au mkoa mwingine</p>
                  <button onClick={clearFilters} className="text-primary-600 text-sm font-medium underline">
                    Ondoa filters zote
                  </button>
                </>
              )}
            </div>
          ) : (
            listings.map((listing, idx) => (
              <ListingCard key={listing.id} listing={listing} hasUnlocked={unlockedIds.includes(listing.id)} priority={idx < 3} />
            ))
          )}

          {/* Load more */}
          {!loading && total > listings.length && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full min-h-[48px] py-3 rounded-2xl border border-primary-200
                         text-primary-600 text-sm font-semibold bg-primary-50
                         active:bg-primary-100 transition-colors flex items-center justify-center gap-2"
            >
              <i className="ti ti-chevrons-down text-base" aria-hidden="true" />
              Onyesha zaidi ({total - listings.length} zimebaki)
            </button>
          )}
        </div>
      )}

      <BottomNav role={userRole ?? 'client'} />
    </div>
  )
}
