'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { reverseGeocode, autocompleteAddress, type AutocompleteResult } from '@/lib/map/geocoding'

// Keep the same interface that AddListingWizard and EditListingClient expect
export interface LocationData {
  latitude:    number
  longitude:   number
  address_full: string
  place_id?:   string
}

interface Props {
  initialLocation?:   LocationData
  onLocationChange:  (location: LocationData) => void
}

const DAR_CENTER = { lat: -6.7924, lng: 39.2083 }
const ICON_BASE   = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images'

function isInTanzania(lat: number, lng: number) {
  return lat >= -12 && lat <= -1 && lng >= 29 && lng <= 41
}

export default function ListingLocationPicker({ initialLocation, onLocationChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const markerRef    = useRef<any>(null)
  const tileRef      = useRef<any>(null)
  const overlayRef   = useRef<any>(null)
  const abortRef     = useRef<AbortController | null>(null)

  const [mapView,      setMapView]      = useState<'satellite' | 'street'>('satellite')
  const [position,     setPosition]     = useState<{ lat: number; lng: number } | null>(
    initialLocation ? { lat: initialLocation.latitude, lng: initialLocation.longitude } : null
  )
  const [address,      setAddress]      = useState(initialLocation?.address_full ?? '')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [suggestions,  setSuggestions]  = useState<AutocompleteResult[]>([])
  const [showSugg,     setShowSugg]     = useState(false)
  const [searching,    setSearching]    = useState(false)
  const [reversing,    setReversing]    = useState(false)
  const [locating,     setLocating]     = useState(false)
  const [gpsError,     setGpsError]     = useState('')

  const handleCoordChange = useCallback(async (lat: number, lng: number) => {
    setReversing(true)
    setPosition({ lat, lng })
    try {
      const result = await reverseGeocode(lat, lng)
      const addr = result?.displayName ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      setAddress(addr)
      setSearchQuery(addr)
      onLocationChange({ latitude: lat, longitude: lng, address_full: addr })
    } finally {
      setReversing(false)
    }
  }, [onLocationChange])

  // Initialize Leaflet map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    ;(async () => {
      const L = (await import('leaflet')).default

      // @ts-expect-error Leaflet internal
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       `${ICON_BASE}/marker-icon.png`,
        iconRetinaUrl: `${ICON_BASE}/marker-icon-2x.png`,
        shadowUrl:     `${ICON_BASE}/marker-shadow.png`,
      })

      const initLat = initialLocation?.latitude  ?? DAR_CENTER.lat
      const initLng = initialLocation?.longitude ?? DAR_CENTER.lng
      const initZoom = initialLocation ? 17 : 12

      const map = L.map(containerRef.current!, {
        center: [initLat, initLng],
        zoom: initZoom,
        zoomControl: true,
      })

      mapRef.current = map

      // Tile helper
      const applyTiles = (v: 'satellite' | 'street') => {
        if (tileRef.current)    map.removeLayer(tileRef.current)
        if (overlayRef.current) map.removeLayer(overlayRef.current)

        if (v === 'satellite') {
          tileRef.current = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 20, attribution: '&copy; Esri — Esri, DigitalGlobe, GeoEye' }
          ).addTo(map)
          overlayRef.current = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 20, opacity: 0.7 }
          ).addTo(map)
        } else {
          tileRef.current = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
          ).addTo(map)
        }
      }

      applyTiles('satellite')
      ;(map as any)._applyTiles = applyTiles

      // Draggable marker
      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:44px;position:relative;cursor:grab">
          <div style="
            width:36px;height:36px;
            background:#1D9E75;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid #085041;
            box-shadow:0 3px 12px rgba(0,0,0,.5);
          "></div>
          <div style="
            position:absolute;top:7px;left:7px;
            width:22px;height:22px;
            background:#fff;border-radius:50%;
            display:flex;align-items:center;
            justify-content:center;font-size:13px;
          ">📍</div>
        </div>`,
        iconSize:    [36, 44],
        iconAnchor:  [18, 44],
        popupAnchor: [0, -46],
      })

      if (initialLocation) {
        const marker = L.marker([initLat, initLng], { icon: pinIcon, draggable: true }).addTo(map)
        markerRef.current = marker

        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng()
          if (!isInTanzania(pos.lat, pos.lng)) return
          handleCoordChange(pos.lat, pos.lng)
        })
      }

      // Click map to place / move pin
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        if (!isInTanzania(lat, lng)) return

        if (!markerRef.current) {
          const marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map)
          markerRef.current = marker
          marker.on('dragend', (de: any) => {
            const pos = de.target.getLatLng()
            if (!isInTanzania(pos.lat, pos.lng)) return
            handleCoordChange(pos.lat, pos.lng)
          })
        } else {
          markerRef.current.setLatLng([lat, lng])
        }

        handleCoordChange(lat, lng)
      })
    })()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to + place marker at given coords
  const flyTo = useCallback((lat: number, lng: number) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo([lat, lng], 17, { animate: true, duration: 1 })

    if (!markerRef.current) {
      ;(async () => {
        const L = (await import('leaflet')).default
        const pinIcon = L.divIcon({
          className: '',
          html: `<div style="width:36px;height:44px;position:relative;cursor:grab">
            <div style="
              width:36px;height:36px;background:#1D9E75;
              border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              border:3px solid #085041;box-shadow:0 3px 12px rgba(0,0,0,.5);
            "></div>
            <div style="
              position:absolute;top:7px;left:7px;width:22px;height:22px;
              background:#fff;border-radius:50%;display:flex;
              align-items:center;justify-content:center;font-size:13px;
            ">📍</div>
          </div>`,
          iconSize: [36, 44], iconAnchor: [18, 44], popupAnchor: [0, -46],
        })
        const marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map)
        markerRef.current = marker
        marker.on('dragend', (de: any) => {
          const pos = de.target.getLatLng()
          if (!isInTanzania(pos.lat, pos.lng)) return
          handleCoordChange(pos.lat, pos.lng)
        })
      })()
    } else {
      markerRef.current.setLatLng([lat, lng])
    }
  }, [handleCoordChange])

  // Address search autocomplete
  const handleSearchInput = useCallback(async (query: string) => {
    setSearchQuery(query)
    setSuggestions([])
    if (query.length < 3) { setShowSugg(false); return }

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setSearching(true)
    try {
      const results = await autocompleteAddress(query, abortRef.current.signal)
      setSuggestions(results)
      setShowSugg(results.length > 0)
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSuggestionSelect = useCallback((s: AutocompleteResult) => {
    setSearchQuery(s.displayName)
    setAddress(s.displayName)
    setShowSugg(false)
    setSuggestions([])
    flyTo(s.lat, s.lng)
    onLocationChange({ latitude: s.lat, longitude: s.lng, address_full: s.displayName })
  }, [flyTo, onLocationChange])

  function handleGPS() {
    if (!navigator.geolocation) { setGpsError('Simu yako haisaidii GPS'); return }
    setLocating(true)
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setLocating(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        if (!isInTanzania(lat, lng)) {
          setGpsError('Mahali ulipo haiko Tanzania. Tumia utafutaji badala yake.')
          return
        }
        flyTo(lat, lng)
        await handleCoordChange(lat, lng)
        if (searchQuery) setSearchQuery('')
      },
      err => {
        setLocating(false)
        if (err.code === 1)      setGpsError('Ruhusu GPS kwenye simu yako kisha jaribu tena')
        else if (err.code === 2) setGpsError('GPS haiwezi kupata mahali. Jaribu tena')
        else                     setGpsError('GPS imeshindwa. Jaribu tena')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  function handleViewToggle(v: 'satellite' | 'street') {
    setMapView(v)
    if (mapRef.current) {
      ;(mapRef.current as any)._applyTiles(v)
    }
  }

  function handleClear() {
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current)
      markerRef.current = null
    }
    setPosition(null)
    setAddress('')
    setSearchQuery('')
    setGpsError('')
  }

  return (
    <div className="space-y-3">

      {/* GPS button */}
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

      {gpsError && <p className="text-xs text-red-500 text-center -mt-1">{gpsError}</p>}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">AU tafuta kwa jina</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Search box with autocomplete */}
      <div className="relative">
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl bg-white overflow-hidden focus-within:border-gray-400 transition-all">
          <div className="pl-3 text-gray-400">
            {searching
              ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
              : <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            }
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchInput(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSugg(true) }}
            placeholder="Andika mtaa, wilaya au mji... (e.g. Mbezi Beach)"
            className="flex-1 py-3 text-sm text-gray-900 outline-none bg-transparent"
            autoComplete="off"
          />
        </div>

        {showSugg && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[1000] overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={s.placeId || i}
                onClick={() => handleSuggestionSelect(s)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
              >
                <i className="ti ti-map-pin text-sm text-gray-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.shortName}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{s.displayName}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 300 }}>
        <div ref={containerRef} className="w-full h-full" />

        {/* View toggle */}
        <div className="absolute top-2 right-2 z-[999] flex rounded-lg overflow-hidden shadow border border-gray-200">
          <button type="button" onClick={() => handleViewToggle('satellite')}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              mapView === 'satellite' ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-600 hover:bg-gray-100'
            }`}>
            Setilaiti
          </button>
          <button type="button" onClick={() => handleViewToggle('street')}
            className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
              mapView === 'street' ? 'bg-gray-900 text-white' : 'bg-white/90 text-gray-600 hover:bg-gray-100'
            }`}>
            Ramani
          </button>
        </div>

        {/* Hint when no pin */}
        {!position && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none z-[999]">
            <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
              Bonyeza ramani kuweka pin ya nyumba
            </div>
          </div>
        )}

        {/* Reverse geocoding spinner */}
        {reversing && (
          <div className="absolute top-2 left-2 z-[999] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 flex items-center gap-1.5">
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
            Inatafuta anwani...
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
          onClick={handleClear}
          className="text-xs text-red-500 underline w-full text-center py-1"
        >
          Futa mahali
        </button>
      )}
    </div>
  )
}
