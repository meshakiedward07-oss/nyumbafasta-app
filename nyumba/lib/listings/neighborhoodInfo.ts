import { createAdminClient } from '@/lib/supabase/server'

// ── City-centre reference points by region ──────────────────
const REGION_CBD: Record<string, { lat: number; lng: number; label: string }> = {
  'Dar es Salaam':            { lat: -6.8160, lng: 39.2803, label: 'Posta' },
  'Arusha':                   { lat: -3.3869, lng: 36.6830, label: 'Arusha CBD' },
  'Mwanza':                   { lat: -2.5164, lng: 32.9175, label: 'Mwanza CBD' },
  'Dodoma':                   { lat: -6.1722, lng: 35.7395, label: 'Dodoma CBD' },
  'Kilimanjaro':              { lat: -3.3544, lng: 37.3536, label: 'Moshi CBD' },
  'Tanga':                    { lat: -5.0668, lng: 39.0985, label: 'Tanga CBD' },
  'Mbeya':                    { lat: -8.9004, lng: 33.4607, label: 'Mbeya CBD' },
  'Morogoro':                 { lat: -6.8242, lng: 37.6643, label: 'Morogoro CBD' },
  'Zanzibar Mjini Magharibi': { lat: -6.1659, lng: 39.2026, label: 'Stone Town' },
}
const DEFAULT_CBD = { lat: -6.8160, lng: 39.2803, label: 'Posta' }

export interface NearbyPlace {
  name:     string
  distance: number
  rating?:  number
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

// ── Haversine straight-line distance (km) ───────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10
}

// ── Estimate driving time without Google ────────────────────
// Road-detour factor ≈ 1.35 on typical Tanzanian roads; avg speed 25 km/h in city
function estimateDriving(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm * 1.35) / 25 * 60))
}

// ── Overpass API (OpenStreetMap) ────────────────────────────
// Free, no API key needed, actively updated with satellite + community data.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

// OSM tag filters for each category (nodes + ways)
const CATEGORY_FILTERS: Record<keyof Omit<NeighborhoodData, 'cbdDistanceKm' | 'cbdDurationMin' | 'cbdLabel'>, string[]> = {
  schools:   ['"amenity"="school"', '"amenity"="college"', '"amenity"="university"', '"amenity"="kindergarten"'],
  hospitals: ['"amenity"="hospital"', '"amenity"="clinic"', '"amenity"="health_post"', '"healthcare"="clinic"', '"healthcare"="hospital"'],
  markets:   ['"amenity"="marketplace"', '"shop"="supermarket"', '"shop"="mall"', '"shop"="grocery"', '"shop"="general"'],
  transport: ['"amenity"="bus_station"', '"highway"="bus_stop"', '"amenity"="taxi"', '"amenity"="ferry_terminal"'],
  banks:     ['"amenity"="bank"', '"amenity"="atm"', '"amenity"="mobile_money_agent"'],
}

interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id:   number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

// Build a single Overpass QL query that fetches all categories at once
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

// Try each endpoint with 8-second timeout; return elements or throw
async function fetchOverpass(query: string): Promise<OsmElement[]> {
  const body = `data=${encodeURIComponent(query)}`

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal:  ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const json = await res.json() as { elements?: OsmElement[] }
      if (Array.isArray(json.elements) && json.elements.length >= 0) {
        return json.elements
      }
    } catch {
      // try next endpoint
    }
  }
  return [] // all endpoints failed — return empty (graceful degradation)
}

// Match an OSM element to a category
function categorize(tags: Record<string, string>): keyof typeof CATEGORY_FILTERS | null {
  const { amenity, shop, highway, healthcare, public_transport } = tags

  if (['school', 'college', 'university', 'kindergarten'].includes(amenity ?? '')) return 'schools'
  if (['hospital', 'clinic', 'health_post'].includes(amenity ?? '') ||
      ['clinic', 'hospital'].includes(healthcare ?? '')) return 'hospitals'
  if (['marketplace'].includes(amenity ?? '') ||
      ['supermarket', 'mall', 'grocery', 'general'].includes(shop ?? '')) return 'markets'
  if (['bus_station', 'taxi', 'ferry_terminal'].includes(amenity ?? '') ||
      highway === 'bus_stop' ||
      public_transport === 'stop_position') return 'transport'
  if (['bank', 'atm', 'mobile_money_agent'].includes(amenity ?? '')) return 'banks'

  return null
}

// Convert OSM elements into NearbyPlace lists per category
function processElements(
  elements: OsmElement[],
  lat: number,
  lng: number,
): Record<keyof typeof CATEGORY_FILTERS, NearbyPlace[]> {
  const result: Record<keyof typeof CATEGORY_FILTERS, NearbyPlace[]> = {
    schools: [], hospitals: [], markets: [], transport: [], banks: [],
  }

  for (const el of elements) {
    const tags = el.tags ?? {}
    const cat  = categorize(tags)
    if (!cat) continue

    // Determine coordinates (node has lat/lon directly; way/relation has center)
    const elLat = el.lat ?? el.center?.lat
    const elLng = el.lon ?? el.center?.lon
    if (!elLat || !elLng) continue

    const name = tags.name ?? tags['name:en'] ?? tags['name:sw'] ?? ''
    if (!name) continue // skip unnamed POIs — they're not useful

    const distance = haversineKm(lat, lng, elLat, elLng)
    result[cat].push({ name, distance })
  }

  // Sort by distance, deduplicate by name, keep top 5 per category
  for (const cat of Object.keys(result) as (keyof typeof result)[]) {
    result[cat] = result[cat]
      .sort((a, b) => a.distance - b.distance)
      .filter((place, idx, arr) => arr.findIndex(p => p.name === place.name) === idx)
      .slice(0, 5)
  }

  return result
}

// ── Main export ─────────────────────────────────────────────
export async function getNeighborhoodInfo(
  listingId: string,
  lat:       number,
  lng:       number,
  region?:   string,
): Promise<NeighborhoodData> {
  const admin = createAdminClient()
  const cbd   = REGION_CBD[region ?? ''] ?? DEFAULT_CBD

  // Check cache first (30-day TTL)
  const { data: cached } = await admin
    .from('neighborhood_cache')
    .select('*')
    .eq('listing_id', listingId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
    return {
      schools:        cached.schools        ?? [],
      hospitals:      cached.hospitals      ?? [],
      markets:        cached.markets        ?? [],
      transport:      cached.transport      ?? [],
      banks:          cached.banks          ?? [],
      cbdDistanceKm:  cached.cbd_distance_km  ?? 0,
      cbdDurationMin: cached.cbd_duration_min ?? 0,
      cbdLabel:       cbd.label,
    }
  }

  // Fetch all nearby POIs in ONE Overpass request (2km radius)
  const query    = buildQuery(lat, lng, 2000)
  const elements = await fetchOverpass(query)
  const places   = processElements(elements, lat, lng)

  // CBD distance (straight-line + road factor estimate — no Google needed)
  const cbdDistanceKm  = haversineKm(lat, lng, cbd.lat, cbd.lng)
  const cbdDurationMin = estimateDriving(cbdDistanceKm)

  const result: NeighborhoodData = {
    ...places,
    cbdDistanceKm,
    cbdDurationMin,
    cbdLabel: cbd.label,
  }

  // Cache for 30 days (fire-and-forget)
  Promise.resolve(
    admin.from('neighborhood_cache').upsert({
      listing_id:      listingId,
      latitude:        lat,
      longitude:       lng,
      schools:         places.schools,
      hospitals:       places.hospitals,
      markets:         places.markets,
      transport:       places.transport,
      banks:           places.banks,
      cbd_distance_km:  cbdDistanceKm,
      cbd_duration_min: cbdDurationMin,
      fetched_at:  new Date().toISOString(),
      expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'listing_id' })
  ).catch(() => {})

  return result
}
