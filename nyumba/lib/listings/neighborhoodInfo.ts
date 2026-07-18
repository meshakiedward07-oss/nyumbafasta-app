import Anthropic from '@anthropic-ai/sdk'
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

// ── Claude AI neighborhood generator ─────────────────────────────────────────
// Generates realistic neighborhood info from region/district/ward knowledge.
// No GPS required. Used as primary source for listings without coordinates,
// and as fallback when Overpass API is unavailable.
async function generateWithClaude(
  region: string,
  district: string,
  ward?: string | null,
): Promise<NeighborhoodData> {
  const cbd       = REGION_CBD[region] ?? DEFAULT_CBD
  const location  = [ward, district, region].filter(Boolean).join(', ')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response  = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 900,
    messages: [{
      role: 'user',
      content: `Toa habari za mtaa huu: ${location}, Tanzania.

Jibu kwa JSON peke yake (bila maelezo zaidi), muundo huu:
{
  "schools":   [{"name": "Jina la Shule",    "distance": 0.5}],
  "hospitals": [{"name": "Jina la Hospitali","distance": 1.2}],
  "markets":   [{"name": "Jina la Soko",     "distance": 0.8}],
  "transport": [{"name": "Kituo cha Usafiri","distance": 0.3}],
  "banks":     [{"name": "Jina la Benki/ATM","distance": 0.6}],
  "cbdDistanceKm":  5,
  "cbdDurationMin": 15,
  "cbdLabel":       "${cbd.label}"
}

Kanuni:
- Toa vitu 3-5 halisi/vinavyojulikana kwa kila kategoria katika ${district}
- Umbali ni km takriban kutoka katikati ya ${district}
- cbdDistanceKm ni umbali wa km kutoka ${district} hadi ${cbd.label}
- JSON tu — usitoe maelezo mengine`,
    }],
  })

  const text  = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Claude haditoa JSON sahihi')

  const d = JSON.parse(match[0]) as Record<string, unknown>

  const toPlaces = (arr: unknown): NearbyPlace[] =>
    Array.isArray(arr)
      ? (arr as Array<Record<string, unknown>>)
          .map(p => ({ name: String(p.name ?? ''), distance: Number(p.distance ?? 0) }))
          .filter(p => p.name)
          .slice(0, 5)
      : []

  return {
    schools:        toPlaces(d.schools),
    hospitals:      toPlaces(d.hospitals),
    markets:        toPlaces(d.markets),
    transport:      toPlaces(d.transport),
    banks:          toPlaces(d.banks),
    cbdDistanceKm:  Number(d.cbdDistanceKm ?? 0),
    cbdDurationMin: Number(d.cbdDurationMin ?? 0),
    cbdLabel:       String(d.cbdLabel ?? cbd.label),
  }
}

// ── Overpass API (OpenStreetMap) — used when GPS coordinates are available ───
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

const CATEGORY_FILTERS: Record<string, string[]> = {
  schools:   ['"amenity"="school"', '"amenity"="college"', '"amenity"="university"', '"amenity"="kindergarten"'],
  hospitals: ['"amenity"="hospital"', '"amenity"="clinic"', '"amenity"="health_post"', '"healthcare"="clinic"'],
  markets:   ['"amenity"="marketplace"', '"shop"="supermarket"', '"shop"="mall"', '"shop"="grocery"'],
  transport: ['"amenity"="bus_station"', '"highway"="bus_stop"', '"amenity"="taxi"'],
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

function buildQuery(lat: number, lng: number, radiusM: number): string {
  const parts: string[] = []
  for (const filters of Object.values(CATEGORY_FILTERS)) {
    for (const tag of filters) {
      parts.push(`  node[${tag}](around:${radiusM},${lat},${lng});`)
      parts.push(`  way[${tag}](around:${radiusM},${lat},${lng});`)
    }
  }
  return `[out:json][timeout:15];\n(\n${parts.join('\n')}\n);\nout center 60;`
}

async function fetchOverpass(query: string): Promise<OsmElement[]> {
  const body = `data=${encodeURIComponent(query)}`
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ctrl  = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 7000)
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
    } catch { /* try next */ }
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
  if (['bus_station', 'taxi'].includes(amenity ?? '') || highway === 'bus_stop') return 'transport'
  if (['bank', 'atm', 'mobile_money_agent'].includes(amenity ?? '')) return 'banks'
  return null
}

async function fetchFromOverpass(
  lat: number, lng: number, region: string,
): Promise<NeighborhoodData | null> {
  try {
    const cbd      = REGION_CBD[region] ?? DEFAULT_CBD
    const elements = await fetchOverpass(buildQuery(lat, lng, 2000))
    if (elements.length === 0) return null

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

    const hasEnoughData = Object.values(result).some(arr => arr.length >= 2)
    if (!hasEnoughData) return null

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
  } catch {
    return null
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
  const admin = createAdminClient()

  // Cache key: district + ward combination (independent of listing)
  const cacheKey = [district, ward].filter(Boolean).join('-')

  // Check cache first (30-day TTL) — keyed by listing_id
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

  // Also check district-level cache (any listing in same district/ward)
  const { data: districtCached } = await admin
    .from('neighborhood_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  let result: NeighborhoodData | null = null

  if (districtCached) {
    const cbd = REGION_CBD[region] ?? DEFAULT_CBD
    result = {
      schools:        districtCached.schools        ?? [],
      hospitals:      districtCached.hospitals      ?? [],
      markets:        districtCached.markets        ?? [],
      transport:      districtCached.transport      ?? [],
      banks:          districtCached.banks          ?? [],
      cbdDistanceKm:  districtCached.cbd_distance_km  ?? 0,
      cbdDurationMin: districtCached.cbd_duration_min ?? 0,
      cbdLabel:       districtCached.cbd_label ?? cbd.label,
    }
  } else {
    // 1. Try Overpass if GPS is available
    if (lat && lng) {
      result = await fetchFromOverpass(lat, lng, region)
    }

    // 2. Fall back to Claude AI (primary when no GPS, fallback when Overpass empty)
    if (!result) {
      result = await generateWithClaude(region, district, ward)
    }

    // Cache at district level (30 days)
    void admin.from('neighborhood_cache').upsert({
      listing_id:      listingId,
      cache_key:       cacheKey,
      latitude:        lat ?? null,
      longitude:       lng ?? null,
      schools:         result.schools,
      hospitals:       result.hospitals,
      markets:         result.markets,
      transport:       result.transport,
      banks:           result.banks,
      cbd_distance_km:  result.cbdDistanceKm,
      cbd_duration_min: result.cbdDurationMin,
      cbd_label:        result.cbdLabel,
      fetched_at:  new Date().toISOString(),
      expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'listing_id' })
  }

  return result
}
