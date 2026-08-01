'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ListingCard from '@/components/listings/ListingCard'
import { ListingGridSkeleton } from '@/components/shared/ListingCardSkeleton'
import BottomNav from '@/components/shared/BottomNav'
import NotificationBell from '@/components/shared/NotificationBell'
import SearchAd from '@/components/ads/SearchAd'
import NearbyAds from '@/components/ads/NearbyAds'
import RankedAdSlot from '@/components/ads/RankedAdSlot'
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
  district, region, ward, furnished, amenities,
  images, is_boosted, boosted_until,
  view_count, lead_count, share_count, latitude, longitude,
  commission_type, created_at,
  dalali_id,
  dalali:dalali_id (
    id, full_name, avatar_url,
    dalali_profiles ( rating_avg, is_premium_verified, is_favourite_dalali )
  )
`

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
function isFresh(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < THIRTY_DAYS_MS
}

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

  const fetchListings = useCallback(async (isNewSearch: boolean) => {
    if (isNewSearch) setLoading(true)
    const from = isNewSearch ? 0 : (page - 1) * LIMIT

    try {
      let query = supabase
        .from('listings')
        .select(LISTING_FIELDS, { count: 'exact' })
        .eq('status', 'active')
        .eq('is_sub_suspended', false)
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

      const raw = (data as unknown as ListingWithDalali[]) ?? []
      const rows = raw.sort((a, b) => {
        if (a.is_boosted !== b.is_boosted) return a.is_boosted ? -1 : 1
        const aFresh = isFresh(a.created_at)
        const bFresh = isFresh(b.created_at)
        if (aFresh !== bFresh) return aFresh ? -1 : 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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

  useEffect(() => {
    if (skippedFirstFetch.current) {
      skippedFirstFetch.current = false
      return
    }
    setPage(1)
    fetchListings(true)
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (page === 1) return
    fetchListings(false)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(key: keyof Filters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value ?? '' }))
  }

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

  const searchBox = (extraClass = '') => (
    <div className={`relative ${extraClass}`}>
      <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
      <input
        type="search"
        inputMode="search"
        placeholder="Tafuta mtaa, wilaya, mkoa..."
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white text-sm
                   text-gray-900 placeholder-gray-400 focus:outline-none
                   focus:ring-2 focus:ring-white/60"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)' }}
      />
      {searchInput && (
        <button
          onClick={() => setSearchInput('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          aria-label="Futa utafutaji"
        >
          <i className="ti ti-x text-sm" aria-hidden="true" />
        </button>
      )}
    </div>
  )

  return (
    <div className="bg-gray-50">

      {/* ── Sticky top header ── */}
      <div className="sticky top-0 z-20 pt-[env(safe-area-inset-top,0px)]"
        style={{ background: 'linear-gradient(160deg, #27AE72 0%, #1D9E75 60%, #178A63 100%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute top-1 right-16 w-8 h-8 rounded-full bg-white/5" />
        </div>

        {/* Brand + desktop search + desktop nav */}
        <div className="relative flex items-center gap-3 px-4 lg:px-8 pt-2.5 pb-1 lg:pb-2.5">
          <div className="relative h-9 w-[48%] sm:w-[36%] lg:w-40 flex-shrink-0">
            <Image
              src="/transparent_logo_nyumbafasta.png"
              alt="NyumbaFasta"
              fill
              priority
              className="object-contain object-left"
              sizes="(max-width: 1024px) 48vw, 160px"
            />
          </div>

          {/* Desktop inline search */}
          <div className="hidden lg:block flex-1 max-w-lg">
            {searchBox()}
          </div>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-shrink-0" aria-label="Urambazaji mkuu">
            <Link href="/saved"
              className="text-white/90 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
              <i className="ti ti-heart text-sm" aria-hidden="true" /> Zilizohifadhiwa
            </Link>
            <Link href="/directory"
              className="text-white/90 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
              <i className="ti ti-building-store text-sm" aria-hidden="true" /> Madalali
            </Link>
            {userRole === 'dalali' && (
              <Link href="/dashboard"
                className="text-white/90 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
                <i className="ti ti-chart-bar text-sm" aria-hidden="true" /> Dashboard
              </Link>
            )}
            {userRole === 'admin' && (
              <Link href="/admin"
                className="text-white/90 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
                <i className="ti ti-shield text-sm" aria-hidden="true" /> Admin
              </Link>
            )}
            <Link href="/account"
              className="text-white/90 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5">
              <i className="ti ti-user text-sm" aria-hidden="true" /> Akaunti
            </Link>
          </nav>

          <NotificationBell asLink className="text-white/90 hover:text-white" />
        </div>

        {/* Mobile-only search row */}
        <div className="relative px-4 pb-3.5 lg:hidden">
          {searchBox()}
        </div>
      </div>

      {/* ── Content — max-width constrained on desktop ── */}
      <div className="max-w-screen-xl mx-auto">

        {/* Region tabs */}
        <div className="flex gap-1.5 px-4 lg:px-8 pt-3 pb-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => applyFilter('region', '')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200
              ${(filters?.region ?? '') === ''
                ? 'bg-primary-500 text-white shadow-[0_2px_8px_rgba(29,158,117,0.35)]'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-primary-200 hover:text-primary-600'}`}
          >
            <i className="ti ti-world text-[11px]" aria-hidden="true" /> Tanzania
          </button>

          {PRIORITY_REGIONS.map(r => (
            <button
              key={r}
              onClick={() => applyFilter('region', r)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200
                ${(filters?.region ?? '') === r
                  ? 'bg-primary-500 text-white shadow-[0_2px_8px_rgba(29,158,117,0.35)]'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-primary-200 hover:text-primary-600'}`}
            >
              {shortName(r)}
            </button>
          ))}

          <select
            value={PRIORITY_REGIONS.includes(filters?.region ?? '') ? '' : (filters?.region ?? '')}
            onChange={e => { if (e.target.value) applyFilter('region', e.target.value) }}
            className={`flex-shrink-0 text-xs border rounded-full px-4 py-2 font-semibold
              focus:outline-none cursor-pointer
              ${!PRIORITY_REGIONS.includes(filters?.region ?? '') && filters?.region
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-500 border-gray-200'}`}
          >
            <option value="">Mikoa Mingine</option>
            {TANZANIA_REGIONS.map(r => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Filter row */}
        <div className="flex gap-1.5 px-4 lg:px-8 pb-3 pt-1.5 overflow-x-auto scrollbar-none">
          <select
            value={filters?.type ?? ''}
            onChange={e => applyFilter('type', e.target.value)}
            className={`flex-shrink-0 text-xs border rounded-full px-4 py-2 font-semibold focus:outline-none cursor-pointer transition-all duration-200
              ${filters?.type ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex-shrink-0 text-xs px-4 py-2 rounded-full border font-semibold
              transition-all duration-200 flex items-center gap-1.5
              ${showFilters || hasExtraFilters ? 'bg-primary-500 text-white border-primary-500 shadow-[0_2px_8px_rgba(29,158,117,0.3)]' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            <i className="ti ti-adjustments-horizontal text-xs" aria-hidden="true" /> Chuja
            {hasExtraFilters && <span className="w-2 h-2 rounded-full bg-amber-400 border-2 border-white shadow" />}
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mx-4 lg:mx-8 mb-3 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="col-span-2 lg:col-span-4">
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
              <div className="col-span-2 lg:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Hali ya samani</label>
                <div className="grid grid-cols-4 gap-2">
                  {[{ value: '', label: 'Yote' }, { value: 'furnished', label: 'Ina Samani' }, { value: 'semi', label: 'Nusu Samani' }, { value: 'empty', label: 'Bila Samani' }].map(f => (
                    <button
                      key={f.value}
                      onClick={() => applyFilter('furnished', f.value)}
                      className={`text-xs min-h-[44px] rounded-lg border transition-all flex items-center justify-center
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

        {/* Search-context ad — amber box, returns null if no campaign */}
        <SearchAd region={filters?.region} />

        {/* Count + view toggle */}
        <div className="px-4 lg:px-8 mb-3 flex justify-between items-center">
          <p className="text-xs font-medium text-gray-400 truncate min-w-0 mr-2">
            {loading
              ? <span className="animate-pulse">Inatafuta...</span>
              : <><span className="text-gray-700 font-bold">{total}</span> {total !== 1 ? 'nyumba' : 'nyumba'}{filters?.region ? ` – ${filters.region}` : ' Tanzania'}</>}
          </p>
          <div className="flex-shrink-0 flex bg-gray-100/80 rounded-xl p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            >
              <i className="ti ti-layout-grid-add" aria-hidden="true" /> Grid
            </button>
            <button
              onClick={() => setViewMode('map')}
              aria-pressed={viewMode === 'map'}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            >
              <i className="ti ti-map-2" aria-hidden="true" /> Ramani
            </button>
          </div>
        </div>

        {/* Boosted strip — grid only */}
        {viewMode === 'grid' && !loading && boosted.length > 0 && (
          <div className="mb-2">
            <div className="px-4 lg:px-8 flex items-center gap-2 mb-2">
              <i className="ti ti-star-filled text-amber-400 text-base" aria-hidden="true" />
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Zinashauriwa na NyumbaFasta
              </p>
            </div>
            <div className="relative">
              <div className="flex gap-3 px-4 lg:px-8 overflow-x-auto scrollbar-none pb-1">
                {boosted.map(listing => (
                  <div key={listing.id} className="flex-shrink-0 w-64 lg:w-72">
                    <ListingCard listing={listing} hasUnlocked={unlockedIds.includes(listing.id)} />
                  </div>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
            </div>
            <div className="border-b border-gray-200 mt-4 mx-4 lg:mx-8" />
          </div>
        )}

        {/* Map view */}
        {viewMode === 'map' && <MapView listings={listings} />}

        {/* Grid view */}
        {viewMode === 'grid' && (
          <div className="px-4 lg:px-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <div className="col-span-full">
                <ListingGridSkeleton count={6} />
              </div>
            ) : listings.length === 0 ? (
              <div className="col-span-full text-center py-12">
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
              (() => {
                const nonBoosted = listings.filter(l => !l.is_boosted)
                const firstOlderIdx = nonBoosted.findIndex(l => !isFresh(l.created_at))
                const boostedCount = listings.filter(l => l.is_boosted).length
                const olderStartIdx = firstOlderIdx === -1
                  ? listings.length
                  : boostedCount + firstOlderIdx

                return listings.flatMap((listing, idx) => {
                  const showMpya = !listing.is_boosted && idx === boostedCount && nonBoosted.some(l => isFresh(l.created_at))
                  const showOlder = idx === olderStartIdx && olderStartIdx < listings.length && olderStartIdx > 0
                  const items = []

                  if (showMpya) items.push(
                    <div key="header-mpya" className="col-span-full flex items-center gap-2 pt-1 pb-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Mpya — Ndani ya Siku 30
                      </p>
                      <div className="flex-1 border-t border-gray-200" />
                    </div>
                  )
                  if (showOlder) items.push(
                    <div key="header-older" className="col-span-full flex items-center gap-2 pt-3 pb-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        Listings Zingine
                      </p>
                      <div className="flex-1 border-t border-gray-200" />
                    </div>
                  )
                  items.push(
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      hasUnlocked={unlockedIds.includes(listing.id)}
                      priority={idx < 3}
                    />
                  )
                  return items
                })
              })()
            )}

            {/* Load more */}
            {!loading && total > listings.length && (
              <div className="col-span-full">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="w-full min-h-[48px] py-3 rounded-2xl border border-primary-200
                             text-primary-600 text-sm font-semibold bg-primary-50 hover:bg-primary-100
                             active:bg-primary-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <i className="ti ti-chevrons-down text-base" aria-hidden="true" />
                  Onyesha zaidi ({total - listings.length} zimebaki)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Nearby business ads — horizontal scroll cards, region-aware */}
        {filters?.region && <NearbyAds region={filters.region} />}

        {/* Ranked ad slot — list of sponsored businesses, desktop-friendly sidebar style */}
        <div className="px-4 lg:px-8 mt-4 mb-2">
          <RankedAdSlot
            region={filters?.region || 'Dar es Salaam'}
            placement="directory"
            limit={4}
            title="Biashara Zinazopendekeza"
          />
        </div>

        <BottomNav role={userRole ?? 'client'} />
      </div>
    </div>
  )
}
