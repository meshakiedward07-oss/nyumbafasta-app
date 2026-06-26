'use client'
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
  const gmUrl = `https://www.google.com/maps?q=${latitude},${longitude}`

  return (
    <div className="space-y-2">
      <div
        className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
        style={{ height: 220 }}
      >
        <MapProvider>
          <Map
            defaultCenter={{ lat: latitude, lng: longitude }}
            defaultZoom={16}
            mapTypeId="roadmap"
            disableDefaultUI
            gestureHandling="none"
            style={{ width: '100%', height: '100%' }}
          >
            <AdvancedMarker position={{ lat: latitude, lng: longitude }}>
              <Pin background="#1D9E75" borderColor="#085041" glyphColor="#fff" />
            </AdvancedMarker>
          </Map>
        </MapProvider>
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
