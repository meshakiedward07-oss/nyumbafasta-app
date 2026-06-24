'use client'
import { useState, useEffect } from 'react'
import { Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps'
import Link from 'next/link'
import { MapProvider } from '@/components/maps/MapProvider'
import type { ListingWithDalali } from '@/lib/types/database'

type MapListing = ListingWithDalali & {
  latitude?: number | null
  longitude?: number | null
}

type Props = {
  listings: MapListing[]
}

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return `${n}`
}

const DAR_CENTER = { lat: -6.7924, lng: 39.2083 }

function MapContent({ listings }: Props) {
  const map = useMap()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const withCoords = listings.filter(
    l => typeof l.latitude === 'number' && typeof l.longitude === 'number'
  )

  useEffect(() => {
    if (!map || withCoords.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    withCoords.forEach(l =>
      bounds.extend({ lat: l.latitude as number, lng: l.longitude as number })
    )
    map.fitBounds(bounds, 40)
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = withCoords.find(l => l.id === selectedId)

  return (
    <>
      {withCoords.map(l => (
        <AdvancedMarker
          key={l.id}
          position={{ lat: l.latitude as number, lng: l.longitude as number }}
          onClick={() => setSelectedId(l.id)}
        >
          <Pin background="#1D9E75" borderColor="#085041" glyphColor="#fff" scale={0.75} />
        </AdvancedMarker>
      ))}

      {selected && (
        <InfoWindow
          position={{ lat: selected.latitude as number, lng: selected.longitude as number }}
          onCloseClick={() => setSelectedId(null)}
          pixelOffset={[0, -38]}
        >
          <div style={{ fontFamily: 'sans-serif', fontSize: 13, padding: '4px 2px', maxWidth: 200 }}>
            {selected.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.images[0]}
                alt={selected.district}
                style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
              />
            ) : (
              <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: '#f3f4f6', borderRadius: 8, marginBottom: 8 }}>
                🏠
              </div>
            )}
            <p style={{ fontWeight: 700, margin: '0 0 4px', lineHeight: 1.3, color: '#111' }}>
              {selected.title || `${selected.type} – ${selected.district}`}
            </p>
            <p style={{ color: '#1D9E75', fontWeight: 700, margin: '0 0 2px' }}>
              Tsh {fmtPrice(selected.price_monthly)}/mwezi
            </p>
            <p style={{ color: '#6b7280', fontSize: 11, margin: '0 0 8px' }}>
              📍 {selected.district}, {selected.region}
            </p>
            <Link
              href={`/listings/${selected.id}`}
              style={{
                display: 'block',
                background: '#1D9E75',
                color: '#fff',
                textAlign: 'center',
                padding: '6px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Angalia →
            </Link>
          </div>
        </InfoWindow>
      )}
    </>
  )
}

export default function MapView({ listings }: Props) {
  const withCoords = listings.filter(
    l => typeof l.latitude === 'number' && typeof l.longitude === 'number'
  )

  return (
    <div className="relative w-full" style={{ height: '70vh', minHeight: 400 }}>
      <MapProvider>
        <Map
          defaultCenter={DAR_CENTER}
          defaultZoom={12}
          mapTypeId="hybrid"
          gestureHandling="greedy"
          disableDefaultUI
          style={{ width: '100%', height: '100%', borderRadius: '1rem', overflow: 'hidden' }}
        >
          <MapContent listings={listings} />
        </Map>
      </MapProvider>

      {withCoords.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded-2xl z-10 pointer-events-none">
          <div className="text-5xl mb-3">🗺️</div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Listings hazina coordinates bado</p>
          <p className="text-xs text-gray-400 text-center px-8">
            Madalali wanaweza kuweka mahali pao kwenye Add Listing form
          </p>
        </div>
      )}

      {withCoords.length > 0 && (
        <div className="absolute top-3 left-3 z-10 bg-white px-3 py-1.5 rounded-full shadow-md text-xs font-semibold text-gray-700">
          📍 {withCoords.length} listings kwenye ramani
        </div>
      )}
    </div>
  )
}
