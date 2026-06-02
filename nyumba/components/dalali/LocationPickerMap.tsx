'use client'
import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, Marker } from 'leaflet'

type LatLng = { lat: number; lng: number }

type Props = {
  value: LatLng | null
  onChange: (coords: LatLng | null) => void
  region?: string
}

// Default centers per region
const REGION_CENTERS: Record<string, [number, number]> = {
  'Dar es Salaam': [-6.7924, 39.2083],
  'Arusha':        [-3.3869, 36.6830],
  'Dodoma':        [-6.1722, 35.7395],
  'Mwanza':        [-2.5164, 32.9000],
  'Zanzibar':      [-6.1659, 39.2026],
  'Mbeya':         [-8.9000, 33.4500],
  'Morogoro':      [-6.8241, 37.6582],
  'Tanga':         [-5.0656, 39.0988],
  'Kilimanjaro':   [-3.3667, 37.3333],
  'Pwani':         [-7.0000, 38.5000],
}

export default function LocationPickerMap({ value, onChange, region }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef    = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const [locating, setLocating] = useState(false)

  const center: [number, number] = region && REGION_CENTERS[region]
    ? REGION_CENTERS[region]
    : [-6.7924, 39.2083]

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: value ? [value.lat, value.lng] : center,
        zoom: 14,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      // Pin icon
      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:32px;
          background:#1D9E75;
          border:3px solid white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })

      // If already has value, show marker
      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], { icon: pinIcon, draggable: true })
          .addTo(map)
          .bindPopup('📍 Mahali pa listing')

        markerRef.current.on('dragend', () => {
          const pos = markerRef.current?.getLatLng()
          if (pos) onChange({ lat: pos.lat, lng: pos.lng })
        })
      }

      // Click to place / move pin
      map.on('click', (e) => {
        const { lat, lng } = e.latlng

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true })
            .addTo(map)
            .bindPopup('📍 Mahali pa listing')

          markerRef.current.on('dragend', () => {
            const pos = markerRef.current?.getLatLng()
            if (pos) onChange({ lat: pos.lat, lng: pos.lng })
          })
        }
        onChange({ lat, lng })
      })

      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When region changes, pan map to new center
  useEffect(() => {
    if (mapRef.current && center && !value) {
      mapRef.current.setView(center, 13)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region])

  async function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const coords = { lat: latitude, lng: longitude }

        import('leaflet').then(L => {
          if (!mapRef.current) return
          mapRef.current.setView([latitude, longitude], 16)

          const pinIcon = L.divIcon({
            className: '',
            html: `<div style="
              width:32px;height:32px;
              background:#1D9E75;
              border:3px solid white;
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              box-shadow:0 2px 6px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          })

          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude])
          } else {
            markerRef.current = L.marker([latitude, longitude], { icon: pinIcon, draggable: true })
              .addTo(mapRef.current!)
            markerRef.current.on('dragend', () => {
              const p = markerRef.current?.getLatLng()
              if (p) onChange({ lat: p.lat, lng: p.lng })
            })
          }
        })
        onChange(coords)
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  function clearPin() {
    markerRef.current?.remove()
    markerRef.current = null
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          📍 Bonyeza Ramani Kuweka Pin
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="text-xs px-3 py-1.5 rounded-full bg-primary-50 text-primary-700 font-medium
                       hover:bg-primary-100 active:scale-95 transition-all disabled:opacity-50"
          >
            {locating ? '...' : '📱 Location Yangu'}
          </button>
          {value && (
            <button
              type="button"
              onClick={clearPin}
              className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-500 font-medium
                         hover:bg-red-100 active:scale-95 transition-all"
            >
              ✕ Futa
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full rounded-2xl overflow-hidden border border-gray-200"
        style={{ height: 260 }}
      />

      {value ? (
        <div className="flex items-center gap-2 text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-xl">
          <span>✅</span>
          <span>
            Mahali umewekwa — {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center">
          Bonyeza ramani au tumia &ldquo;Location Yangu&rdquo; ili uweke mahali pa listing (optional)
        </p>
      )}
    </div>
  )
}
