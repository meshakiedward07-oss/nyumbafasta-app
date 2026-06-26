'use client'
import { useState, useEffect } from 'react'
import { Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import Link from 'next/link'
import { MapProvider } from '@/components/maps/MapProvider'
import { createClient } from '@/lib/supabase/client'
import type { ListingWithDalali } from '@/lib/types/database'

type MapListing = ListingWithDalali & {
  latitude?: number | null
  longitude?: number | null
}

type Props = {
  listings: MapListing[]   // initial listings (current page)
  className?: string
}

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${n}`
}

const LISTING_FIELDS = `
  id, title, type, price_monthly, district, region,
  images, is_boosted, latitude, longitude,
  dalali:dalali_id ( dalali_profiles ( is_premium_verified ) )
`

// ── Price badge marker ────────────────────────────────────────────────────
function PriceBadge({ price, selected, boosted }: { price: number; selected: boolean; boosted: boolean }) {
  return (
    <div
      style={{
        background:   selected ? '#085041' : boosted ? '#EF9F27' : '#1D9E75',
        color:        '#fff',
        fontWeight:   700,
        fontSize:     11,
        padding:      '4px 8px',
        borderRadius: 20,
        whiteSpace:   'nowrap',
        boxShadow:    selected
          ? '0 4px 12px rgba(8,80,65,0.5)'
          : '0 2px 6px rgba(0,0,0,0.25)',
        border:       selected ? '2px solid #fff' : '2px solid rgba(255,255,255,0.6)',
        transform:    selected ? 'scale(1.15)' : 'scale(1)',
        transition:   'transform 0.15s, box-shadow 0.15s',
        cursor:       'pointer',
        userSelect:   'none',
      }}
    >
      {boosted && !selected ? '⭐ ' : ''}Tsh {fmtPrice(price)}
    </div>
  )
}

// ── Inner map content (needs useMap) ──────────────────────────────────────
function MapContent({ listings }: { listings: MapListing[] }) {
  const map = useMap()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const withCoords = listings.filter(
    l => typeof l.latitude === 'number' && typeof l.longitude === 'number'
  )

  // Auto-fit bounds when listings change
  useEffect(() => {
    if (!map || withCoords.length === 0) return
    if (typeof google === 'undefined') return
    if (withCoords.length === 1) {
      map.setCenter({ lat: withCoords[0].latitude as number, lng: withCoords[0].longitude as number })
      map.setZoom(15)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    withCoords.forEach(l => bounds.extend({ lat: l.latitude as number, lng: l.longitude as number }))
    map.fitBounds(bounds, 60)
  }, [map, withCoords.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = withCoords.find(l => l.id === selectedId)

  return (
    <>
      {withCoords.map(l => (
        <AdvancedMarker
          key={l.id}
          position={{ lat: l.latitude as number, lng: l.longitude as number }}
          onClick={() => setSelectedId(prev => prev === l.id ? null : l.id)}
          zIndex={selectedId === l.id ? 10 : l.is_boosted ? 5 : 1}
        >
          <PriceBadge
            price={l.price_monthly}
            selected={selectedId === l.id}
            boosted={!!l.is_boosted}
          />
        </AdvancedMarker>
      ))}

      {selected && (
        <InfoWindow
          position={{ lat: selected.latitude as number, lng: selected.longitude as number }}
          onCloseClick={() => setSelectedId(null)}
          pixelOffset={[0, -36]}
          maxWidth={220}
        >
          <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2px 2px 0' }}>
            {/* Image */}
            {selected.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.images[0]}
                alt={selected.district}
                style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: 70, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 28, background: '#f3f4f6',
                borderRadius: 8, marginBottom: 8 }}>
                🏠
              </div>
            )}

            {/* Title */}
            <p style={{ fontWeight: 700, margin: '0 0 3px', lineHeight: 1.3, color: '#111827', fontSize: 13 }}>
              {selected.title || `${selected.type} – ${selected.district}`}
            </p>

            {/* Price */}
            <p style={{ color: '#1D9E75', fontWeight: 700, margin: '0 0 2px', fontSize: 13 }}>
              Tsh {fmtPrice(selected.price_monthly)}<span style={{ color: '#6b7280', fontWeight: 400, fontSize: 11 }}>/mwezi</span>
            </p>

            {/* Location */}
            <p style={{ color: '#6b7280', fontSize: 11, margin: '0 0 8px' }}>
              📍 {selected.district}, {selected.region}
            </p>

            {/* CTA */}
            <Link
              href={`/listings/${selected.id}`}
              style={{
                display: 'block', background: '#1D9E75', color: '#fff',
                textAlign: 'center', padding: '7px', borderRadius: 8,
                textDecoration: 'none', fontSize: 12, fontWeight: 700,
              }}
            >
              Angalia Nyumba →
            </Link>
          </div>
        </InfoWindow>
      )}
    </>
  )
}

// ── Main MapView ──────────────────────────────────────────────────────────
const DAR_CENTER = { lat: -6.7924, lng: 39.2083 }

export default function MapView({ listings, className = '' }: Props) {
  const [allListings, setAllListings] = useState<MapListing[]>(listings)
  const [loadingAll, setLoadingAll]   = useState(false)

  // On mount, fetch ALL listings with coordinates (not just current page)
  useEffect(() => {
    const existing = listings.filter(l => l.latitude && l.longitude)
    if (existing.length > 0) setAllListings(listings)

    setLoadingAll(true)
    const supabase = createClient()
    supabase
      .from('listings')
      .select(LISTING_FIELDS)
      .eq('status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(500)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) setAllListings(data as unknown as MapListing[])
        setLoadingAll(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const withCoords = allListings.filter(l => l.latitude && l.longitude)

  return (
    <div className={`relative w-full px-4 ${className}`}>
      <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
           style={{ height: '70vh', minHeight: 400 }}>

        <MapProvider>
          <Map
            defaultCenter={DAR_CENTER}
            defaultZoom={11}
            mapTypeId="roadmap"
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapId="nyumbafasta-map"
            style={{ width: '100%', height: '100%' }}
          >
            <MapContent listings={allListings} />
          </Map>
        </MapProvider>

        {/* Count badge */}
        {withCoords.length > 0 && (
          <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm
                          px-3 py-1.5 rounded-full shadow-md text-xs font-semibold text-gray-700
                          flex items-center gap-1.5">
            <span className="w-2 h-2 bg-primary-500 rounded-full" />
            {loadingAll ? 'Inapakia...' : `${withCoords.length} listings`}
          </div>
        )}

        {/* Hint badge */}
        {withCoords.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
            <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full">
              Bonyeza bei kwenye ramani kuona maelezo
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loadingAll && withCoords.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
                          bg-gray-50 z-10 pointer-events-none">
            <div className="text-5xl mb-3">🗺️</div>
            <p className="text-sm font-semibold text-gray-600 mb-1">
              Listings hazina mahali bado
            </p>
            <p className="text-xs text-gray-400 text-center px-8">
              Madalali wanaweza kuweka coordinates kwenye Add Listing form
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
