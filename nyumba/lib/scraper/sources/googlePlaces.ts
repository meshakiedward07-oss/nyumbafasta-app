import { processItems, RawItem } from '../core/processor'

// Coordinates za mikoa yote 31 ya Tanzania kwa location bias
const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  'Dar es Salaam':              { lat: -6.8161, lng: 39.2803 },
  'Arusha':                     { lat: -3.3869, lng: 36.6830 },
  'Mwanza':                     { lat: -2.5164, lng: 32.9175 },
  'Dodoma':                     { lat: -6.1722, lng: 35.7395 },
  'Kilimanjaro':                { lat: -3.3544, lng: 37.3536 },
  'Tanga':                      { lat: -5.0668, lng: 39.0985 },
  'Mbeya':                      { lat: -8.9004, lng: 33.4607 },
  'Morogoro':                   { lat: -6.8242, lng: 37.6643 },
  'Iringa':                     { lat: -7.7676, lng: 35.6940 },
  'Kigoma':                     { lat: -4.8831, lng: 29.6269 },
  'Tabora':                     { lat: -5.0209, lng: 32.8002 },
  'Shinyanga':                  { lat: -3.6609, lng: 33.4234 },
  'Mara':                       { lat: -1.6883, lng: 34.0693 },
  'Kagera':                     { lat: -1.2489, lng: 31.2354 },
  'Rukwa':                      { lat: -7.9139, lng: 31.4480 },
  'Katavi':                     { lat: -6.3669, lng: 31.1300 },
  'Songwe':                     { lat: -8.9000, lng: 32.9000 },
  'Ruvuma':                     { lat: -10.6833, lng: 35.6500 },
  'Lindi':                      { lat: -9.9996, lng: 39.7149 },
  'Mtwara':                     { lat: -10.2667, lng: 40.1833 },
  'Singida':                    { lat: -4.8189, lng: 34.7441 },
  'Geita':                      { lat: -2.8667, lng: 32.1667 },
  'Simiyu':                     { lat: -2.8500, lng: 34.0167 },
  'Manyara':                    { lat: -4.3167, lng: 36.0500 },
  'Njombe':                     { lat: -9.3333, lng: 34.7667 },
  'Pwani':                      { lat: -7.0000, lng: 38.5000 },
  'Zanzibar Mjini Magharibi':   { lat: -6.1659, lng: 39.2026 },
  'Zanzibar Kaskazini Unguja':  { lat: -5.8333, lng: 39.3500 },
  'Zanzibar Kusini Unguja':     { lat: -6.3167, lng: 39.5167 },
  'Zanzibar Kaskazini Pemba':   { lat: -5.0333, lng: 39.7333 },
  'Zanzibar Kusini Pemba':      { lat: -5.3167, lng: 39.7000 },
}

const BASE = 'https://maps.googleapis.com/maps/api/place'

type SearchResult = {
  place_id: string
  name: string
  formatted_address: string
  rating?: number
  user_ratings_total?: number
  business_status?: string
}

type SearchResponse = {
  status: string
  results?: SearchResult[]
  next_page_token?: string
  error_message?: string
}

type DetailsResponse = {
  status: string
  result?: {
    name: string
    formatted_address: string
    formatted_phone_number?: string
    international_phone_number?: string
    website?: string
    rating?: number
    user_ratings_total?: number
    business_status?: string
    editorial_summary?: { overview?: string }
  }
}

async function textSearch(
  query: string,
  apiKey: string,
  coords?: { lat: number; lng: number },
  pageToken?: string
): Promise<SearchResponse> {
  let url =
    `${BASE}/textsearch/json` +
    `?query=${encodeURIComponent(query)}` +
    `&key=${apiKey}`

  if (coords) {
    url += `&location=${coords.lat},${coords.lng}&radius=50000`
  }

  if (pageToken) {
    url += `&pagetoken=${encodeURIComponent(pageToken)}`
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
  return await res.json() as SearchResponse
}

async function placeDetails(
  placeId: string,
  apiKey: string
): Promise<DetailsResponse> {
  const fields = [
    'name',
    'formatted_address',
    'formatted_phone_number',
    'international_phone_number',
    'website',
    'rating',
    'user_ratings_total',
    'business_status',
    'editorial_summary',
  ].join(',')

  const url =
    `${BASE}/details/json` +
    `?place_id=${placeId}` +
    `&fields=${fields}` +
    `&key=${apiKey}`

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  return await res.json() as DetailsResponse
}

export async function runGooglePlaces(
  region: string
): Promise<ReturnType<typeof processItems>> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY haipo')

  console.log(`\n🗺️ Google Places: ${region}`)

  const queries = [
    `real estate agent ${region} Tanzania`,
    `mdalali wa nyumba ${region} Tanzania`,
    `property agency ${region} Tanzania`,
    `nyumba inapangishwa ${region}`,
    `house for rent ${region} Tanzania`,
    `apartment for rent ${region} Tanzania`,
  ]

  const coords = REGION_COORDS[region]
  const rawItems: RawItem[] = []
  const seenIds = new Set<string>()

  for (const query of queries) {
    let pageToken: string | undefined
    let page = 0

    do {
      try {
        console.log(`  🔍 "${query}" (ukurasa ${page + 1})`)

        // Lazima usubiri kidogo kabla kutumia pagetoken
        if (pageToken) await new Promise(r => setTimeout(r, 2000))

        const searchData = await textSearch(query, apiKey, coords, pageToken)

        if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
          console.log(`  ⚠️ Status: ${searchData.status} — ${searchData.error_message || ''}`)
          break
        }

        for (const place of searchData.results || []) {
          if (seenIds.has(place.place_id)) continue
          seenIds.add(place.place_id)

          if (place.business_status === 'CLOSED_PERMANENTLY') continue

          try {
            const detailData = await placeDetails(place.place_id, apiKey)
            const d = detailData.result
            if (!d) continue

            const phone = d.international_phone_number || d.formatted_phone_number

            const text = [
              d.name,
              d.formatted_address,
              phone ? `Phone: ${phone}` : '',
              d.website ? `Website: ${d.website}` : '',
              d.rating ? `Rating: ${d.rating}/5 (${d.user_ratings_total} reviews)` : '',
              d.editorial_summary?.overview || '',
              `Search query: ${query}`,
            ].filter(Boolean).join('\n')

            rawItems.push({
              text,
              name: d.name,
              url: d.website || undefined,
              extra: {
                placeId: place.place_id,
                address: d.formatted_address,
                phone,
                rating: d.rating,
                reviews: d.user_ratings_total,
                platform: 'google_maps',
              }
            })

            await new Promise(r => setTimeout(r, 150))

          } catch {
            continue
          }
        }

        pageToken = searchData.next_page_token
        page++

      } catch (err) {
        console.error(`  ❌ Error: "${query}" ukurasa ${page + 1}:`, err)
        break
      }
    } while (pageToken && page < 3)

    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`📊 Google Places: ${rawItems.length} mahali palipatikana`)
  return await processItems(rawItems, 'google_maps', region)
}
