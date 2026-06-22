'use client'
import { useEffect, useRef } from 'react'
import type { Map as LeafletMap } from 'leaflet'

type Props = {
  latitude: number
  longitude: number
  district: string
  region: string
}

export default function SingleListingMap({ latitude, longitude, district, region }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then(L => {
      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:28px;height:36px">
          <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.27 21.73 0 14 0z" fill="#1D9E75" stroke="#fff" stroke-width="2"/>
            <circle cx="14" cy="14" r="5" fill="#fff"/>
          </svg>
        </div>`,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -36],
      })

      L.marker([latitude, longitude], { icon })
        .addTo(map)
        .bindPopup(`<strong style="font-size:13px">📍 ${district}</strong><br><span style="font-size:11px;color:#6b7280">${region}, Tanzania</span>`)

      mapRef.current = map
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
      style={{ height: 220 }}
    >
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
