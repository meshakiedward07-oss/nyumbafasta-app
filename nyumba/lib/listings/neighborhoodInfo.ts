import { createAdminClient } from '@/lib/supabase/server'

export interface NearbyPlace {
  name:     string
  distance: number
}

export interface NeighborhoodData {
  schools:        NearbyPlace[]
  hospitals:      NearbyPlace[]
  markets:        NearbyPlace[]
  transport:      NearbyPlace[]
  banks:          NearbyPlace[]
  cbdDistanceKm:  number
  cbdDurationMin: number
  cbdLabel:       string
}

// ── City-centre reference points by region ───────────────────────────────────
const REGION_CBD: Record<string, { lat: number; lng: number; label: string }> = {
  'Dar es Salaam':            { lat: -6.8160, lng: 39.2803, label: 'Posta, Dar es Salaam' },
  'Arusha':                   { lat: -3.3869, lng: 36.6830, label: 'Arusha CBD' },
  'Mwanza':                   { lat: -2.5164, lng: 32.9175, label: 'Mwanza CBD' },
  'Dodoma':                   { lat: -6.1722, lng: 35.7395, label: 'Dodoma CBD' },
  'Kilimanjaro':              { lat: -3.3544, lng: 37.3536, label: 'Moshi CBD' },
  'Tanga':                    { lat: -5.0668, lng: 39.0985, label: 'Tanga CBD' },
  'Mbeya':                    { lat: -8.9004, lng: 33.4607, label: 'Mbeya CBD' },
  'Morogoro':                 { lat: -6.8242, lng: 37.6643, label: 'Morogoro CBD' },
  'Zanzibar Mjini Magharibi': { lat: -6.1659, lng: 39.2026, label: 'Stone Town, Zanzibar' },
}
const DEFAULT_CBD = { lat: -6.8160, lng: 39.2803, label: 'Posta, Dar es Salaam' }

// ── Haversine straight-line distance (km) ────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10
}

function estimateDriving(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm * 1.35) / 25 * 60))
}

// ── Nominatim geocoding (OpenStreetMap) ──────────────────────────────────────
// Converts district/ward/region names to lat/lng. Free, no API key required.
interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

async function geocodeLocation(
  district: string,
  region:   string,
  ward?:    string | null,
): Promise<{ lat: number; lng: number } | null> {
  // Try progressively from most specific to least specific
  const queries = [
    ward ? `${ward}, ${district}, ${region}, Tanzania` : null,
    `${district}, ${region}, Tanzania`,
    `${district}, Tanzania`,
  ].filter(Boolean) as string[]

  for (const q of queries) {
    try {
      const url    = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=tz`
      const ctrl   = new AbortController()
      const timer  = setTimeout(() => ctrl.abort(), 6000)
      const res    = await fetch(url, {
        headers: { 'User-Agent': 'NyumbaFasta/1.0 (info@nyumbafasta.co)' },
        signal:  ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) continue

      const data = await res.json() as NominatimResult[]
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      }
    } catch { /* try next query */ }
  }
  return null
}

// ── Overpass API (OpenStreetMap POIs) ────────────────────────────────────────
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

const CATEGORY_FILTERS: Record<string, string[]> = {
  schools:   ['"amenity"="school"', '"amenity"="college"', '"amenity"="university"', '"amenity"="kindergarten"'],
  hospitals: ['"amenity"="hospital"', '"amenity"="clinic"', '"amenity"="health_post"', '"healthcare"="clinic"'],
  markets:   ['"amenity"="marketplace"', '"shop"="supermarket"', '"shop"="mall"', '"shop"="grocery"'],
  transport: ['"amenity"="bus_station"', '"highway"="bus_stop"', '"amenity"="taxi"', '"amenity"="ferry_terminal"'],
  banks:     ['"amenity"="bank"', '"amenity"="atm"', '"amenity"="mobile_money_agent"'],
}

interface OsmElement {
  type:    'node' | 'way' | 'relation'
  id:      number
  lat?:    number
  lon?:    number
  center?: { lat: number; lon: number }
  tags?:   Record<string, string>
}

function buildQuery(lat: number, lng: number, radiusM: number): string {
  const parts: string[] = []
  for (const filters of Object.values(CATEGORY_FILTERS)) {
    for (const tag of filters) {
      parts.push(`  node[${tag}](around:${radiusM},${lat},${lng});`)
      parts.push(`  way[${tag}](around:${radiusM},${lat},${lng});`)
    }
  }
  return `[out:json][timeout:20];\n(\n${parts.join('\n')}\n);\nout center 80;`
}

async function fetchOverpass(query: string): Promise<OsmElement[]> {
  const body = `data=${encodeURIComponent(query)}`
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ctrl  = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res   = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal:  ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const json = await res.json() as { elements?: OsmElement[] }
      if (Array.isArray(json.elements)) return json.elements
    } catch { /* try next endpoint */ }
  }
  return []
}

function categorize(tags: Record<string, string>): keyof typeof CATEGORY_FILTERS | null {
  const { amenity, shop, highway, healthcare } = tags
  if (['school', 'college', 'university', 'kindergarten'].includes(amenity ?? '')) return 'schools'
  if (['hospital', 'clinic', 'health_post'].includes(amenity ?? '') ||
      ['clinic', 'hospital'].includes(healthcare ?? '')) return 'hospitals'
  if (['marketplace'].includes(amenity ?? '') ||
      ['supermarket', 'mall', 'grocery'].includes(shop ?? '')) return 'markets'
  if (['bus_station', 'taxi', 'ferry_terminal'].includes(amenity ?? '') ||
      highway === 'bus_stop') return 'transport'
  if (['bank', 'atm', 'mobile_money_agent'].includes(amenity ?? '')) return 'banks'
  return null
}

async function fetchFromOverpass(
  lat: number,
  lng: number,
  region: string,
): Promise<NeighborhoodData> {
  const cbd      = REGION_CBD[region] ?? DEFAULT_CBD
  const elements = await fetchOverpass(buildQuery(lat, lng, 2500))

  const result: Record<string, NearbyPlace[]> = {
    schools: [], hospitals: [], markets: [], transport: [], banks: [],
  }

  for (const el of elements) {
    const tags = el.tags ?? {}
    const cat  = categorize(tags)
    if (!cat) continue
    const elLat = el.lat ?? el.center?.lat
    const elLng = el.lon ?? el.center?.lon
    if (!elLat || !elLng) continue
    const name = tags.name ?? tags['name:sw'] ?? tags['name:en'] ?? ''
    if (!name) continue
    result[cat].push({ name, distance: haversineKm(lat, lng, elLat, elLng) })
  }

  for (const cat of Object.keys(result)) {
    result[cat] = result[cat]
      .sort((a, b) => a.distance - b.distance)
      .filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i)
      .slice(0, 5)
  }

  const cbdDistanceKm  = haversineKm(lat, lng, cbd.lat, cbd.lng)
  const cbdDurationMin = estimateDriving(cbdDistanceKm)

  return {
    schools:        result.schools,
    hospitals:      result.hospitals,
    markets:        result.markets,
    transport:      result.transport,
    banks:          result.banks,
    cbdDistanceKm,
    cbdDurationMin,
    cbdLabel:       cbd.label,
  }
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function getNeighborhoodInfo(params: {
  listingId: string
  region:    string
  district:  string
  ward?:     string | null
  lat?:      number | null
  lng?:      number | null
}): Promise<NeighborhoodData> {
  const { listingId, region, district, ward, lat, lng } = params
  const admin    = createAdminClient()
  const cacheKey = [district, ward].filter(Boolean).join('-')

  // 1. Check listing-level cache (30-day TTL)
  const { data: cached } = await admin
    .from('neighborhood_cache')
    .select('*')
    .eq('listing_id', listingId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
    const cbd = REGION_CBD[region] ?? DEFAULT_CBD
    return {
      schools:        cached.schools        ?? [],
      hospitals:      cached.hospitals      ?? [],
      markets:        cached.markets        ?? [],
      transport:      cached.transport      ?? [],
      banks:          cached.banks          ?? [],
      cbdDistanceKm:  cached.cbd_distance_km  ?? 0,
      cbdDurationMin: cached.cbd_duration_min ?? 0,
      cbdLabel:       cached.cbd_label ?? cbd.label,
    }
  }

  // 2. Check district-level cache (reuse data for same district/ward)
  const { data: distCached } = await admin
    .from('neighborhood_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (distCached) {
    const cbd = REGION_CBD[region] ?? DEFAULT_CBD
    // Write listing-level entry pointing at same data
    void admin.from('neighborhood_cache').upsert({
      listing_id:       listingId,
      cache_key:        cacheKey,
      latitude:         lat ?? null,
      longitude:        lng ?? null,
      schools:          distCached.schools,
      hospitals:        distCached.hospitals,
      markets:          distCached.markets,
      transport:        distCached.transport,
      banks:            distCached.banks,
      cbd_distance_km:  distCached.cbd_distance_km,
      cbd_duration_min: distCached.cbd_duration_min,
      cbd_label:        distCached.cbd_label ?? cbd.label,
      fetched_at:  new Date().toISOString(),
      expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'listing_id' })
    return {
      schools:        distCached.schools        ?? [],
      hospitals:      distCached.hospitals      ?? [],
      markets:        distCached.markets        ?? [],
      transport:      distCached.transport      ?? [],
      banks:          distCached.banks          ?? [],
      cbdDistanceKm:  distCached.cbd_distance_km  ?? 0,
      cbdDurationMin: distCached.cbd_duration_min ?? 0,
      cbdLabel:       distCached.cbd_label ?? (REGION_CBD[region] ?? DEFAULT_CBD).label,
    }
  }

  // 3. Resolve coordinates: use listing GPS if available, else geocode via Nominatim
  let resolvedLat = lat && lng ? lat : null
  let resolvedLng = lat && lng ? lng : null

  if (!resolvedLat || !resolvedLng) {
    const geo = await geocodeLocation(district, region, ward)
    if (geo) {
      resolvedLat = geo.lat
      resolvedLng = geo.lng
    }
  }

  // 4. Fetch POIs from Overpass using resolved coordinates
  const cbd = REGION_CBD[region] ?? DEFAULT_CBD
  let result: NeighborhoodData

  if (resolvedLat && resolvedLng) {
    result = await fetchFromOverpass(resolvedLat, resolvedLng, region)
  } else {
    // Coords unavailable even after geocoding — return CBD distance only
    result = {
      schools: [], hospitals: [], markets: [], transport: [], banks: [],
      cbdDistanceKm:  0,
      cbdDurationMin: 0,
      cbdLabel:       cbd.label,
    }
  }

  // 5. Cache result (30 days) at both listing and district level
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const row = {
    cache_key:        cacheKey,
    latitude:         resolvedLat ?? null,
    longitude:        resolvedLng ?? null,
    schools:          result.schools,
    hospitals:        result.hospitals,
    markets:          result.markets,
    transport:        result.transport,
    banks:            result.banks,
    cbd_distance_km:  result.cbdDistanceKm,
    cbd_duration_min: result.cbdDurationMin,
    cbd_label:        result.cbdLabel,
    fetched_at:  new Date().toISOString(),
    expires_at:  expiresAt,
  }
  void admin.from('neighborhood_cache').upsert(
    { listing_id: listingId, ...row }, { onConflict: 'listing_id' }
  )
  // Also write district-level entry so future listings in same area skip API calls
  void admin.from('neighborhood_cache').upsert(
    { listing_id: `district:${cacheKey}`, ...row }, { onConflict: 'listing_id' }
  )

  return result
}
