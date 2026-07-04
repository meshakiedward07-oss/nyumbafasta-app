// Geoapify geocoding helpers — forward, reverse, and autocomplete

const BASE = 'https://api.geoapify.com/v1/geocode'
const apiKey = () => process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? ''

export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
  city?: string
  district?: string
  region?: string
  country?: string
}

export interface AutocompleteResult {
  placeId: string
  displayName: string
  shortName: string
  lat: number
  lng: number
  city?: string
  district?: string
  region?: string
}

function parseFeature(f: any, overrideLat?: number, overrideLng?: number): GeocodeResult {
  const p = f.properties
  const [lng, lat] = f.geometry.coordinates
  return {
    lat: overrideLat ?? lat,
    lng: overrideLng ?? lng,
    displayName: p.formatted ?? '',
    city: p.city,
    district: p.county ?? p.district,
    region: p.state,
    country: p.country,
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const key = apiKey()
  if (!key) return null
  try {
    const url = `${BASE}/reverse?lat=${lat}&lon=${lng}&lang=en&apiKey=${key}`
    const res = await fetch(url)
    const data = await res.json()
    if (!data.features?.length) return null
    return parseFeature(data.features[0], lat, lng)
  } catch {
    return null
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = apiKey()
  if (!key) return null
  try {
    const params = new URLSearchParams({
      text: address,
      filter: 'countrycode:tz',
      lang: 'en',
      limit: '1',
      apiKey: key,
    })
    const res = await fetch(`${BASE}/search?${params}`)
    const data = await res.json()
    if (!data.features?.length) return null
    return parseFeature(data.features[0])
  } catch {
    return null
  }
}

export async function autocompleteAddress(
  query: string,
  signal?: AbortSignal,
): Promise<AutocompleteResult[]> {
  const key = apiKey()
  if (!key || query.length < 3) return []
  try {
    const params = new URLSearchParams({
      text: query,
      filter: 'countrycode:tz',
      bias: 'proximity:39.2083,-6.7924',
      lang: 'en',
      limit: '5',
      apiKey: key,
    })
    const res = await fetch(`${BASE}/autocomplete?${params}`, { signal })
    const data = await res.json()
    return (data.features ?? []).map((f: any): AutocompleteResult => ({
      placeId: f.properties.place_id ?? '',
      displayName: f.properties.formatted ?? '',
      shortName: f.properties.address_line1 ?? f.properties.city ?? f.properties.formatted ?? '',
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      city: f.properties.city,
      district: f.properties.county,
      region: f.properties.state,
    }))
  } catch (err: any) {
    if (err?.name === 'AbortError') return []
    return []
  }
}
