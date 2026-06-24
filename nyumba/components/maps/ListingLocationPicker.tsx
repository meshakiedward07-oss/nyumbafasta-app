'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Map,
  AdvancedMarker,
  Pin,
  MapMouseEvent,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'
import { MapProvider } from '@/components/maps/MapProvider'

export interface LocationData {
  latitude: number
  longitude: number
  address_full: string
  place_id?: string
}

interface Props {
  initialLocation?: LocationData
  onLocationChange: (location: LocationData) => void
}

const DAR_CENTER = { lat: -6.7924, lng: 39.2083 }

// Inner component — renders inside APIProvider so hooks work
function PickerContent({ initialLocation, onLocationChange }: Props) {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(
    initialLocation
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
      : null
  )
  const [address, setAddress] = useState(initialLocation?.address_full ?? '')
  const [locating, setLocating] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)

  const placesLib = useMapsLibrary('places')
  const geocodingLib = useMapsLibrary('geocoding')

  // Init geocoder
  useEffect(() => {
    if (!geocodingLib) return
    geocoderRef.current = new geocodingLib.Geocoder()
  }, [geocodingLib])

  const reverseGeocode = useCallback(
    (lat: number, lng: number, placeIdOverride?: string) => {
      if (!geocoderRef.current) {
        onLocationChange({ latitude: lat, longitude: lng, address_full: '', place_id: placeIdOverride })
        return
      }
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const r = results[0]
          const addr = r.formatted_address ?? ''
          const pid = placeIdOverride ?? r.place_id ?? ''
          setAddress(addr)
          onLocationChange({ latitude: lat, longitude: lng, address_full: addr, place_id: pid })
        } else {
          onLocationChange({ latitude: lat, longitude: lng, address_full: '', place_id: placeIdOverride })
        }
      })
    },
    [onLocationChange]
  )

  // Init Places Autocomplete
  useEffect(() => {
    if (!placesLib || !searchInputRef.current) return
    const ac = new placesLib.Autocomplete(searchInputRef.current, {
      componentRestrictions: { country: 'TZ' },
      fields: ['geometry', 'formatted_address', 'place_id'],
    })
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry?.location) return
      const lat = place.geometry.location.lat()
      const lng = place.geometry.location.lng()
      const addr = place.formatted_address ?? ''
      const pid = place.place_id ?? ''
      setPosition({ lat, lng })
      setAddress(addr)
      onLocationChange({ latitude: lat, longitude: lng, address_full: addr, place_id: pid })
    })
    return () => google.maps.event.removeListener(listener)
  }, [placesLib, onLocationChange])

  function handleMapClick(e: MapMouseEvent) {
    const latLng = e.detail.latLng
    if (!latLng) return
    const { lat, lng } = latLng
    setPosition({ lat, lng })
    reverseGeocode(lat, lng)
  }

  function handleDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    setPosition({ lat, lng })
    reverseGeocode(lat, lng)
  }

  function handleGPS() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setPosition({ lat, lng })
        reverseGeocode(lat, lng)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }

  return (
    <div className="space-y-3">
      {/* Search box */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Tafuta mahali... (e.g. Mbezi Beach, Dar)"
          className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        />
      </div>

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 280 }}>
        <Map
          defaultCenter={position ?? DAR_CENTER}
          defaultZoom={position ? 17 : 12}
          mapTypeId="satellite"
          gestureHandling="greedy"
          disableDefaultUI
          onClick={handleMapClick}
          style={{ width: '100%', height: '100%' }}
        >
          {position && (
            <AdvancedMarker
              position={position}
              draggable
              onDragEnd={handleDragEnd}
            >
              <Pin background="#1D9E75" borderColor="#085041" glyphColor="#fff" />
            </AdvancedMarker>
          )}
        </Map>

        {/* GPS button overlay */}
        <button
          type="button"
          onClick={handleGPS}
          disabled={locating}
          className="absolute bottom-3 right-3 bg-white rounded-full p-2.5 shadow-md
                     border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors
                     disabled:opacity-50"
          title="Tumia GPS yangu"
        >
          {locating ? (
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}
        </button>
      </div>

      {/* Address display */}
      {address ? (
        <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
          <span className="text-green-600 mt-0.5 text-sm">📍</span>
          <p className="text-xs text-green-800 leading-relaxed">{address}</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center px-4">
          Bonyeza kwenye ramani au buruta pin kuweka mahali halisi pa nyumba
        </p>
      )}

      {/* Clear button */}
      {position && (
        <button
          type="button"
          onClick={() => {
            setPosition(null)
            setAddress('')
            if (searchInputRef.current) searchInputRef.current.value = ''
          }}
          className="text-xs text-red-500 underline w-full text-center"
        >
          Futa mahali
        </button>
      )}
    </div>
  )
}

export default function ListingLocationPicker({ initialLocation, onLocationChange }: Props) {
  return (
    <MapProvider>
      <PickerContent initialLocation={initialLocation} onLocationChange={onLocationChange} />
    </MapProvider>
  )
}
