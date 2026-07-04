'use client'
import { useEffect, useRef, useState } from 'react'
import type { Map as LMap } from 'leaflet'

type Props = {
  latitude:  number
  longitude: number
  district:  string
  region:    string
  address?:  string | null
}

type View = 'satellite' | 'street'

// Leaflet marker CDN paths — avoids copying assets to public/
const ICON_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images'

export default function SingleListingMap({ latitude, longitude, district, region, address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<LMap | null>(null)
  const tileRef      = useRef<any>(null)
  const overlayRef   = useRef<any>(null)
  const [view, setView] = useState<View>('satellite')

  const gmUrl = `https://www.google.com/maps?q=${latitude},${longitude}`

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map: LMap
    ;(async () => {
      const L = (await import('leaflet')).default

      // Fix webpack icon paths
      // @ts-expect-error Leaflet internal
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       `${ICON_BASE}/marker-icon.png`,
        iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
        shadowUrl:     `${ICON_BASE}/marker-shadow.png`,
      })

      map = L.map(containerRef.current!, {
        center: [latitude, longitude],
        zoom: 16,
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: true,
        attributionControl: true,
      })

      mapRef.current = map

      // Layer helper
      const applyView = (v: View) => {
        if (tileRef.current)   map.removeLayer(tileRef.current)
        if (overlayRef.current) map.removeLayer(overlayRef.current)

        if (v === 'satellite') {
          tileRef.current = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 20, attribution: '&copy; Esri — Esri, DigitalGlobe, GeoEye, USDA FSA' }
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
        }
      }

      applyView('satellite')

      // Custom green pin matching brand color
      const greenPin = L.divIcon({
        className: '',
        html: `<div style="
          width:26px;height:38px;position:relative;
        ">
          <div style="
            width:26px;height:26px;
            background:#1D9E75;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid #085041;
            box-shadow:0 2px 8px rgba(0,0,0,.4);
          "></div>
          <div style="
            position:absolute;top:4px;left:4px;
            width:18px;height:18px;
            background:#fff;border-radius:50%;
            display:flex;align-items:center;
            justify-content:center;font-size:10px;
          ">🏠</div>
        </div>`,
        iconSize:    [26, 38],
        iconAnchor:  [13, 38],
        popupAnchor: [0, -40],
      })

      L.marker([latitude, longitude], { icon: greenPin }).addTo(map)

      // Store view switcher on map instance for the toggle button handler
      ;(map as any)._applyView = applyView
    })()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [latitude, longitude])

  function handleViewToggle(v: View) {
    setView(v)
    if (mapRef.current) {
      ;(mapRef.current as any)._applyView(v)
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative"
        style={{ height: 220 }}
      >
        <div ref={containerRef} className="w-full h-full" />

        {/* View toggle */}
        <div className="absolute top-2 right-2 z-[999] flex rounded-lg overflow-hidden shadow border border-gray-200">
          <button
            type="button"
            onClick={() => handleViewToggle('satellite')}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              view === 'satellite' ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Setilaiti
          </button>
          <button
            type="button"
            onClick={() => handleViewToggle('street')}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              view === 'street' ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Ramani
          </button>
        </div>
      </div>

      {/* Address + open in Google Maps */}
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <i className="ti ti-map-pin text-sm mt-0.5 text-gray-600" aria-hidden="true" />
          <p className="text-xs text-gray-600 leading-relaxed">
            {address || `${district}, ${region}`}
          </p>
        </div>
        <a
          href={gmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-xs font-semibold text-primary-600 underline whitespace-nowrap"
        >
          Fungua Maps →
        </a>
      </div>
    </div>
  )
}
