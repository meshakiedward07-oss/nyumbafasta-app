'use client'
import { useState } from 'react'
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { MapProvider } from '@/components/maps/MapProvider'

type Props = {
  latitude:  number
  longitude: number
  district:  string
  region:    string
  address?:  string | null
}

export default function SingleListingMap({ latitude, longitude, district, region, address }: Props) {
  const [mapType, setMapType] = useState<'hybrid' | 'roadmap'>('hybrid')
  const gmUrl = `https://www.google.com/maps?q=${latitude},${longitude}`

  return (
    <div className="space-y-2">
      <div
        className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative"
        style={{ height: 220 }}
      >
        <MapProvider>
          <Map
            defaultCenter={{ lat: latitude, lng: longitude }}
            defaultZoom={16}
            mapTypeId={mapType}
            disableDefaultUI
            gestureHandling="cooperative"
            style={{ width: '100%', height: '100%' }}
          >
            <AdvancedMarker position={{ lat: latitude, lng: longitude }}>
              <Pin background="#1D9E75" borderColor="#085041" glyphColor="#fff" />
            </AdvancedMarker>
          </Map>
        </MapProvider>

        {/* Map type toggle */}
        <div className="absolute top-2 right-2 z-10 flex rounded-lg overflow-hidden shadow border border-gray-200">
          <button
            type="button"
            onClick={() => setMapType('hybrid')}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              mapType === 'hybrid'
                ? 'bg-gray-900 text-white'
                : 'bg-white/90 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Setilaiti
          </button>
          <button
            type="button"
            onClick={() => setMapType('roadmap')}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              mapType === 'roadmap'
                ? 'bg-gray-900 text-white'
                : 'bg-white/90 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Ramani
          </button>
        </div>
      </div>

      {/* Address + open in Google Maps */}
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-sm mt-0.5">📍</span>
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
