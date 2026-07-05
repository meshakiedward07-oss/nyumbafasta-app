'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ListingWithDalali } from '@/lib/types/database'
import type { Map as LMap, TileLayer, Marker } from 'leaflet'

type MapListing = ListingWithDalali & {
  latitude?:  number | null
  longitude?: number | null
}

type Props = {
  listings:  MapListing[]
  className?: string
}

type MapView = 'satellite' | 'street'

const ICON_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images'

const LISTING_FIELDS = `
  id, title, type, price_monthly, district, region,
  images, is_boosted, latitude, longitude,
  dalali:dalali_id ( dalali_profiles ( is_premium_verified ) )
`

function fmtPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${n}`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function MapView({ listings, className = '' }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<LMap | null>(null)
  const tileRef       = useRef<TileLayer | null>(null)
  const overlayRef    = useRef<TileLayer | null>(null)
  const markersRef    = useRef<Marker[]>([])
  const applyTilesRef = useRef<((v: MapView) => void) | null>(null)
  // Ref tracks the intended view so async init applies the right tiles
  const mapTypeRef    = useRef<MapView>('satellite')

  const [allListings, setAllListings] = useState<MapListing[]>(listings)
  const [loadingAll,  setLoadingAll]  = useState(false)
  const [mapType,     setMapType]     = useState<MapView>('satellite')
  const [mapReady,    setMapReady]    = useState(false)

  // Fetch all listings with coordinates on mount
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

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let mounted = true

    ;(async () => {
      const L = (await import('leaflet')).default
      // Guard: component may have unmounted while import was in-flight
      if (!mounted || !containerRef.current) return

      // @ts-expect-error Leaflet internal removed by webpack
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       `${ICON_BASE}/marker-icon.png`,
        iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
        shadowUrl:     `${ICON_BASE}/marker-shadow.png`,
      })

      const map = L.map(containerRef.current, {
        center: [-6.7924, 39.2083],
        zoom: 11,
        zoomControl: true,
      })

      mapRef.current = map

      const applyTiles = (v: MapView) => {
        // Always remove + null both refs before adding new layers
        if (tileRef.current)    { map.removeLayer(tileRef.current);    tileRef.current    = null }
        if (overlayRef.current) { map.removeLayer(overlayRef.current); overlayRef.current = null }

        if (v === 'satellite') {
          tileRef.current = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 20, attribution: '&copy; Esri — Esri, DigitalGlobe, GeoEye' }
          ).addTo(map)
          overlayRef.current = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 20, opacity: 0.75 }
          ).addTo(map)
        } else {
          tileRef.current = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
          ).addTo(map)
          // overlayRef stays null in street mode
        }
      }

      applyTilesRef.current = applyTiles
      // Apply whichever view the user already toggled during async load
      applyTiles(mapTypeRef.current)
      if (mounted) setMapReady(true)
    })()

    return () => {
      mounted = false
      tileRef.current    = null
      overlayRef.current = null
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current       = null
        applyTilesRef.current = null
      }
    }
  }, [])

  // Sync markers whenever allListings changes
  useEffect(() => {
    if (!mapRef.current) return
    let mounted = true

    ;(async () => {
      const L = (await import('leaflet')).default
      // Re-check after await — map may have been destroyed between the null-check and now
      if (!mounted || !mapRef.current) return
      const map = mapRef.current

      markersRef.current.forEach(m => map.removeLayer(m))
      markersRef.current = []

      const withCoords = allListings.filter(l => l.latitude && l.longitude)
      if (withCoords.length === 0) return

      withCoords.forEach(listing => {
        const lat    = listing.latitude as number
        const lng    = listing.longitude as number
        const boosted = !!listing.is_boosted
        const bg      = boosted ? '#EF9F27' : '#1D9E75'
        const border  = boosted ? '#d18a1e' : '#085041'
        const price   = fmtPrice(listing.price_monthly)
        const star    = boosted ? '<span style="font-size:9px;margin-right:3px">★</span>' : ''

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:${bg};color:#fff;font-weight:700;font-size:11px;
            padding:4px 8px;border-radius:20px;white-space:nowrap;
            box-shadow:0 2px 6px rgba(0,0,0,.25);
            border:2px solid ${border};cursor:pointer;user-select:none;
          ">${star}Tsh ${price}</div>`,
          iconAnchor: [30, 16],
          popupAnchor: [0, -20],
        })

        const marker = L.marker([lat, lng], { icon }).addTo(map)

        const safeImg      = listing.images?.[0] ? escHtml(listing.images[0]) : ''
        const imgHtml      = safeImg
          ? `<img src="${safeImg}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:8px;display:block" />`
          : `<div style="height:70px;display:flex;align-items:center;justify-content:center;font-size:28px;background:#f3f4f6;border-radius:8px;margin-bottom:8px">🏠</div>`
        const safeTitle    = escHtml(listing.title || `${listing.type} – ${listing.district}`)
        const safeDistrict = escHtml(listing.district ?? '')
        const safeRegion   = escHtml(listing.region ?? '')

        marker.bindPopup(
          `<div style="font-family:system-ui,sans-serif;padding:2px 2px 0;min-width:180px">
            ${imgHtml}
            <p style="font-weight:700;margin:0 0 3px;line-height:1.3;color:#111827;font-size:13px">
              ${safeTitle}
            </p>
            <p style="color:#1D9E75;font-weight:700;margin:0 0 2px;font-size:13px">
              Tsh ${price}<span style="color:#6b7280;font-weight:400;font-size:11px">/mwezi</span>
            </p>
            <p style="color:#6b7280;font-size:11px;margin:0 0 8px">${safeDistrict}, ${safeRegion}</p>
            <a href="/listings/${listing.id}"
               style="display:block;background:#1D9E75;color:#fff;text-align:center;
                      padding:7px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:700">
              Angalia Nyumba →
            </a>
          </div>`,
          { closeButton: false, maxWidth: 220 }
        )

        markersRef.current.push(marker)
      })

      // Fit bounds to show all markers
      const bounds = L.latLngBounds(withCoords.map(l => [l.latitude as number, l.longitude as number]))
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 })
    })()

    return () => { mounted = false }
  }, [allListings])

  function handleViewToggle(v: MapView) {
    setMapType(v)
    mapTypeRef.current = v  // keep ref in sync for async-init path
    applyTilesRef.current?.(v)
  }

  const withCoords = allListings.filter(l => l.latitude && l.longitude)

  return (
    <div className={`relative w-full px-4 ${className}`}>
      <div
        className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
        style={{ height: '70vh', minHeight: 400 }}
      >
        <div ref={containerRef} className="w-full h-full" />

        {!mapReady && (
          <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center z-[1000]">
            <i className="ti ti-map text-4xl text-gray-300" aria-hidden="true" />
          </div>
        )}

        {withCoords.length > 0 && (
          <div className="absolute top-3 left-3 z-[999] bg-white/90 backdrop-blur-sm
                          px-3 py-1.5 rounded-full shadow-md text-xs font-semibold text-gray-700
                          flex items-center gap-1.5 pointer-events-none">
            <span className="w-2 h-2 bg-primary-500 rounded-full" />
            {loadingAll ? 'Inapakia...' : `${withCoords.length} listings`}
          </div>
        )}

        <div className="absolute top-3 right-3 z-[999] flex rounded-lg overflow-hidden shadow border border-gray-200">
          <button type="button" onClick={() => handleViewToggle('satellite')}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors min-h-[44px] ${
              mapType === 'satellite' ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-600 hover:bg-gray-100'
            }`}>
            Setilaiti
          </button>
          <button type="button" onClick={() => handleViewToggle('street')}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors min-h-[44px] ${
              mapType === 'street' ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-600 hover:bg-gray-100'
            }`}>
            Ramani
          </button>
        </div>

        {withCoords.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 z-[999] flex justify-center pointer-events-none">
            <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full">
              Bonyeza bei kwenye ramani kuona maelezo
            </div>
          </div>
        )}

        {!loadingAll && withCoords.length > 0 && withCoords.length < allListings.length && (
          <div className="absolute top-3 right-[140px] z-[999] bg-white/90 backdrop-blur-sm
                          px-3 py-1.5 rounded-full shadow-md text-xs text-gray-500 pointer-events-none">
            {allListings.length - withCoords.length} bila mahali
          </div>
        )}

        {!loadingAll && withCoords.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-[999] pointer-events-none">
            <i className="ti ti-map text-5xl text-gray-400 mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-600 mb-1">Ramani hazionyeshi listings bado</p>
            <p className="text-xs text-gray-400 text-center px-8">
              {allListings.length > 0
                ? `Listings ${allListings.length} zipo lakini hazina coordinates.`
                : 'Hakuna listings kwa sasa. Rudi baadaye.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
