'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap } from 'leaflet'
import type { ListingWithDalali } from '@/lib/types/database'

// Listings with optional coordinates
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

// Map of Dar es Salaam default center
const DAR_CENTER: [number, number] = [-6.7924, 39.2083]

export default function MapView({ listings }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  const withCoords = listings.filter(
    l => typeof l.latitude === 'number' && typeof l.longitude === 'number'
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Lazy-import leaflet (SSR safe)
    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: DAR_CENTER,
        zoom: 12,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Add markers for listings that have coordinates
      withCoords.forEach(listing => {
        const lat = listing.latitude as number
        const lng = listing.longitude as number
        const price = fmtPrice(listing.price_monthly)

        // Custom price badge icon
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:#1D9E75;
            color:#fff;
            padding:4px 9px;
            border-radius:12px;
            font-size:11px;
            font-weight:700;
            white-space:nowrap;
            box-shadow:0 2px 6px rgba(0,0,0,0.25);
            border:2px solid #fff;
            cursor:pointer;
          ">Tsh ${price}</div>`,
          iconSize: [80, 28],
          iconAnchor: [40, 28],
        })

        const imgHtml = listing.images?.[0]
          ? `<img src="${listing.images[0]}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
          : `<div style="width:100%;height:60px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f3f4f6;border-radius:8px;margin-bottom:8px;">🏠</div>`

        const popup = L.popup({ maxWidth: 200, offset: [0, -20] }).setContent(`
          <div style="font-family:sans-serif;font-size:13px;padding:4px 2px;">
            ${imgHtml}
            <p style="font-weight:700;margin:0 0 4px;line-height:1.3;color:#111;">
              ${listing.title || listing.type + ' – ' + listing.district}
            </p>
            <p style="color:#1D9E75;font-weight:700;margin:0 0 2px;">Tsh ${price}/mwezi</p>
            <p style="color:#6b7280;font-size:11px;margin:0 0 8px;">📍 ${listing.district}, ${listing.region}</p>
            <a href="/listings/${listing.id}"
              style="display:block;background:#1D9E75;color:#fff;text-align:center;padding:6px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;">
              Angalia →
            </a>
          </div>
        `)

        L.marker([lat, lng], { icon }).addTo(map).bindPopup(popup)
      })

      // Auto-fit bounds if we have listings with coords
      if (withCoords.length > 0) {
        const bounds = L.latLngBounds(
          withCoords.map(l => [l.latitude as number, l.longitude as number])
        )
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      }

      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative w-full" style={{ height: '70vh', minHeight: 400 }}>
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden z-0" />

      {/* No coordinates banner */}
      {withCoords.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 rounded-2xl z-10">
          <div className="text-5xl mb-3">🗺️</div>
          <p className="text-sm font-semibold text-gray-600 mb-1">Listings hazina coordinates bado</p>
          <p className="text-xs text-gray-400 text-center px-8">
            Madalali wanaweza kuweka mahali pao kwenye Add Listing form
          </p>
        </div>
      )}

      {/* Listings count badge */}
      {withCoords.length > 0 && (
        <div className="absolute top-3 left-3 z-[400] bg-white px-3 py-1.5 rounded-full shadow-md text-xs font-semibold text-gray-700">
          📍 {withCoords.length} listings kwenye ramani
        </div>
      )}
    </div>
  )
}
