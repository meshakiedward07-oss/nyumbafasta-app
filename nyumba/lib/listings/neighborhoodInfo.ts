import { createAdminClient } from '@/lib/supabase/server'

const PLACES_API = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
const DISTANCE_API = 'https://maps.googleapis.com/maps/api/distancematrix/json'

// City-centre reference points by region — used as local "CBD"
const REGION_CBD: Record<string, { lat: number; lng: number; label: string }> = {
  'Dar es Salaam':             { lat: -6.8160, lng: 39.2803, label: 'Posta' },
  'Arusha':                    { lat: -3.3869, lng: 36.6830, label: 'Arusha CBD' },
  'Mwanza':                    { lat: -2.5164, lng: 32.9175, label: 'Mwanza CBD' },
  'Dodoma':                    { lat: -6.1722, lng: 35.7395, label: 'Dodoma CBD' },
  'Kilimanjaro':               { lat: -3.3544, lng: 37.3536, label: 'Moshi CBD' },
  'Tanga':                     { lat: -5.0668, lng: 39.0985, label: 'Tanga CBD' },
  'Mbeya':                     { lat: -8.9004, lng: 33.4607, label: 'Mbeya CBD' },
  'Morogoro':                  { lat: -6.8242, lng: 37.6643, label: 'Morogoro CBD' },
  'Zanzibar Mjini Magharibi':  { lat: -6.1659, lng: 39.2026, label: 'Stone Town' },
}

const DEFAULT_CBD = { lat: -6.8160, lng: 39.2803, label: 'Posta' }

export interface NearbyPlace {
  name: string
  distance: number
  rating?: number
}

export interface NeighborhoodData {
  schools:    NearbyPlace[]
  hospitals:  NearbyPlace[]
  markets:    NearbyPlace[]
  transport:  NearbyPlace[]
  banks:      NearbyPlace[]
  cbdDistanceKm:  number
  cbdDurationMin: number
  cbdLabel:       string
}

// ── Haversine distance (km) ─────────────────────────────
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

// ── Google Places nearby search ─────────────────────────
async function searchNearby(
  lat: number,
  lng: number,
  type: string,
  radius = 1500,
): Promise<NearbyPlace[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return []

  try {
    const url =
      `${PLACES_API}?location=${lat},${lng}` +
      `&radius=${radius}&type=${type}&key=${key}`

    const res  = await fetch(url, { next: { revalidate: 0 } })
    const json = await res.json() as {
      status: string
      results: Array<{
        name: string
        rating?: number
        geometry: { location: { lat: number; lng: number } }
      }>
    }

    if (json.status !== 'OK') return []

    return json.results
      .slice(0, 5)
      .map(p => ({
        name:     p.name,
        distance: haversineKm(lat, lng, p.geometry.location.lat, p.geometry.location.lng),
        rating:   p.rating,
      }))
      .sort((a, b) => a.distance - b.distance)
  } catch {
    return []
  }
}

// ── Distance Matrix (driving) ───────────────────────────
async function getDrivingDistance(
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
): Promise<{ distanceKm: number; durationMin: number }> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    return { distanceKm: haversineKm(fromLat, fromLng, toLat, toLng), durationMin: 0 }
  }

  try {
    const url =
      `${DISTANCE_API}?origins=${fromLat},${fromLng}` +
      `&destinations=${toLat},${toLng}` +
      `&mode=driving&key=${key}`

    const res  = await fetch(url, { next: { revalidate: 0 } })
    const json = await res.json() as {
      rows?: Array<{ elements?: Array<{
        status: string
        distance: { value: number }
        duration: { value: number }
      }> }>
    }

    const el = json.rows?.[0]?.elements?.[0]
    if (el?.status === 'OK') {
      return {
        distanceKm:  Math.round(el.distance.value / 100) / 10,
        durationMin: Math.round(el.duration.value / 60),
      }
    }
  } catch { /* fall through */ }

  return { distanceKm: haversineKm(fromLat, fromLng, toLat, toLng), durationMin: 0 }
}

// ── Main export ─────────────────────────────────────────
export async function getNeighborhoodInfo(
  listingId: string,
  lat:       number,
  lng:       number,
  region?:   string,
): Promise<NeighborhoodData> {
  const admin = createAdminClient()
  const cbd   = REGION_CBD[region ?? ''] ?? DEFAULT_CBD

  // Check cache first
  const { data: cached } = await admin
    .from('neighborhood_cache')
    .select('*')
    .eq('listing_id', listingId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached) {
    return {
      schools:        cached.schools    ?? [],
      hospitals:      cached.hospitals  ?? [],
      markets:        cached.markets    ?? [],
      transport:      cached.transport  ?? [],
      banks:          cached.banks      ?? [],
      cbdDistanceKm:  cached.cbd_distance_km ?? 0,
      cbdDurationMin: cached.cbd_duration_min ?? 0,
      cbdLabel:       cbd.label,
    }
  }

  // Fetch all data in parallel
  const [schools, hospitals, markets, transport, banks, driving] = await Promise.all([
    searchNearby(lat, lng, 'school'),
    searchNearby(lat, lng, 'hospital'),
    searchNearby(lat, lng, 'supermarket', 2000),
    searchNearby(lat, lng, 'bus_station', 1000),
    searchNearby(lat, lng, 'bank', 1500),
    getDrivingDistance(lat, lng, cbd.lat, cbd.lng),
  ])

  const result: NeighborhoodData = {
    schools,
    hospitals,
    markets,
    transport,
    banks,
    cbdDistanceKm:  driving.distanceKm,
    cbdDurationMin: driving.durationMin,
    cbdLabel:       cbd.label,
  }

  // Upsert into cache (fire-and-forget — don't block response)
  Promise.resolve(
    admin.from('neighborhood_cache').upsert({
      listing_id:      listingId,
      latitude:        lat,
      longitude:       lng,
      schools,
      hospitals,
      markets,
      transport,
      banks,
      cbd_distance_km:  driving.distanceKm,
      cbd_duration_min: driving.durationMin,
      fetched_at:  new Date().toISOString(),
      expires_at:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'listing_id' })
  ).catch(() => {})

  return result
}
