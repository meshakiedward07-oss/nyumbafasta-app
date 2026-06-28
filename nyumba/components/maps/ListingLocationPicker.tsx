'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Map,
  AdvancedMarker,
  Pin,
  MapMouseEvent,
  useMapsLibrary,
  useMap,
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

// Imperatively pans map when target changes
function MapController({ target }: { target: google.maps.LatLngLiteral | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !target) return
    map.panTo(target)
    map.setZoom(17)
  }, [map, target])
  return null
}

function PickerContent({ initialLocation, onLocationChange }: Props) {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(
    initialLocation
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
      : null
  )
  const [address, setAddress] = useState(initialLocation?.address_full ?? '')
  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState('')
  // mapTarget drives MapController — set when we want the map to pan
  const [mapTarget, setMapTarget] = useState<google.maps.LatLngLiteral | null>(
    initialLocation
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
      : null
  )

  const searchInputRef = useRef<HTMLInputElement>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)

  const placesLib = useMapsLibrary('places')
  const geocodingLib = useMapsLibrary('geocoding')

  useEffect(() => {
    if (!geocodingLib) return
    geocoderRef.current = new geocodingLib.Geocoder()
  }, [geocodingLib])

  // Tanzania bounding box — reject coordinates outside the country
  function isInTanzania(lat: number, lng: number) {
    return lat >= -12 && lat <= -1 && lng >= 29 && lng <= 41
  }

  const reverseGeocode = useCallback(
    (lat: number, lng: number, placeIdOverride?: string) => {
      if (!geocoderRef.current) {
        // Geocoder not yet loaded — update coords and leave address empty; the
        // address input already shows a hint so the user knows it's not set.
        onLocationChange({ latitude: lat, longitude: lng, address_full: '', place_id: placeIdOverride })
        return
      }
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        const addr = (status === 'OK' && results?.[0]?.formatted_address) ? results[0].formatted_address : ''
        const pid  = placeIdOverride ?? (status === 'OK' && results?.[0]?.place_id ? results[0].place_id : '')
        if (addr) setAddress(addr)
        onLocationChange({ latitude: lat, longitude: lng, address_full: addr, place_id: pid })
      })
    },
    [onLocationChange]
  )

  // Places Autocomplete — pan map when place is selected
  useEffect(() => {
    if (!placesLib || !searchInputRef.current) return
    const ac = new placesLib.Autocomplete(searchInputRef.current, {
      componentRestrictions: { country: 'TZ' },
      fields: ['geometry', 'formatted_address', 'place_id', 'name'],
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
      setMapTarget({ lat, lng }) // ← pan map here
      onLocationChange({ latitude: lat, longitude: lng, address_full: addr, place_id: pid })
    })
    return () => google.maps.event.removeListener(listener)
  }, [placesLib, onLocationChange])

  function handleMapClick(e: MapMouseEvent) {
    const latLng = e.detail.latLng
    if (!latLng) return
    const { lat, lng } = latLng
    if (!isInTanzania(lat, lng)) return  // ignore clicks outside Tanzania
    setPosition({ lat, lng })
    reverseGeocode(lat, lng)
  }

  function handleDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    if (!isInTanzania(lat, lng)) return
    setPosition({ lat, lng })
    reverseGeocode(lat, lng)
  }

  function handleGPS() {
    if (!navigator.geolocation) {
      setGpsError('Simu yako haisaidii GPS')
      return
    }
    setLocating(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        if (!isInTanzania(lat, lng)) {
          setGpsError('Mahali ulipo haiko Tanzania. Tumia utafutaji badala yake.')
          return
        }
        setPosition({ lat, lng })
        setMapTarget({ lat, lng })
        reverseGeocode(lat, lng)
        if (searchInputRef.current) searchInputRef.current.value = ''
      },
      err => {
        setLocating(false)
        if (err.code === 1) setGpsError('Ruhusu GPS kwenye simu yako kisha jaribu tena')
        else if (err.code === 2) setGpsError('GPS haiwezi kupata mahali. Jaribu tena')
        else setGpsError('GPS imeshindwa. Jaribu tena')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  return (
    <div className="space-y-3">

      {/* GPS button — prominent at top */}
      <button
        type="button"
        onClick={handleGPS}
        disabled={locating}
        className="w-full flex items-center justify-center gap-2 py-3 px-4
                   bg-primary-50 border border-primary-200 text-primary-700
                   rounded-xl text-sm font-semibold transition-all
                   hover:bg-primary-100 active:scale-[0.98]
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {locating ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Inatafuta mahali pako...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="8" />
            </svg>
            Tumia Mahali Pangu (GPS)
          </>
        )}
      </button>

      {gpsError && (
        <p className="text-xs text-red-500 text-center -mt-1">{gpsError}</p>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">AU tafuta kwa jina</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Search box */}
      <div className="relative">
        <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Andika mtaa, wilaya au mji... (e.g. Mbezi Beach)"
          className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          autoComplete="off"
        />
      </div>

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 300 }}>
        <Map
          defaultCenter={position ?? DAR_CENTER}
          defaultZoom={position ? 17 : 12}
          mapTypeId="satellite"
          gestureHandling="greedy"
          disableDefaultUI
          onClick={handleMapClick}
          mapId="nyumbafasta-location-picker"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Pan map when target changes */}
          <MapController target={mapTarget} />

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

        {/* Hint overlay — show when no pin yet */}
        {!position && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
              Bonyeza ramani kuweka pin ya nyumba
            </div>
          </div>
        )}
      </div>

      {/* Address display */}
      {address ? (
        <div className="flex items-start gap-2 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
          <i className="ti ti-map-pin text-primary-600 mt-0.5 text-sm flex-shrink-0" aria-hidden="true" />
          <p className="text-xs text-primary-800 leading-relaxed flex-1">{address}</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center px-4">
          Tumia GPS au tafuta jina la mtaa, kisha bonyeza ramani pin mahali halisi
        </p>
      )}

      {/* Clear button */}
      {position && (
        <button
          type="button"
          onClick={() => {
            setPosition(null)
            setAddress('')
            setMapTarget(null)
            setGpsError('')
            if (searchInputRef.current) searchInputRef.current.value = ''
          }}
          className="text-xs text-red-500 underline w-full text-center py-1"
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
