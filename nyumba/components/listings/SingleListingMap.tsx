'use client'
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { MapProvider } from '@/components/maps/MapProvider'

type Props = {
  latitude: number
  longitude: number
  district: string
  region: string
}

export default function SingleListingMap({ latitude, longitude }: Props) {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
      style={{ height: 220 }}
    >
      <MapProvider>
        <Map
          defaultCenter={{ lat: latitude, lng: longitude }}
          defaultZoom={16}
          mapTypeId="hybrid"
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
  )
}
