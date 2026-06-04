import { processItems, RawItem } from '../core/processor'

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
    `house for sale ${region} Tanzania`
  ]

  const rawItems: RawItem[] = []
  const seenIds = new Set<string>()

  for (const query of queries) {
    try {
      const searchRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json` +
        `?query=${encodeURIComponent(query)}&key=${apiKey}`
      )
      const searchData = await searchRes.json() as {
        status: string
        results?: Array<{ place_id: string }>
      }

      if (searchData.status !== 'OK') {
        console.log(`⚠️ Google status: ${searchData.status}`)
        continue
      }

      for (const place of searchData.results || []) {
        if (seenIds.has(place.place_id)) continue
        seenIds.add(place.place_id)

        try {
          const detailRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json` +
            `?place_id=${place.place_id}` +
            `&fields=name,formatted_phone_number,website,` +
            `formatted_address,rating,user_ratings_total,` +
            `opening_hours,business_status,editorial_summary` +
            `&key=${apiKey}`
          )
          const detailData = await detailRes.json() as {
            result?: {
              name: string
              formatted_address: string
              formatted_phone_number?: string
              website?: string
              rating?: number
              user_ratings_total?: number
              business_status?: string
              editorial_summary?: { overview?: string }
            }
          }
          const d = detailData.result

          if (!d) continue
          if (d.business_status === 'CLOSED_PERMANENTLY') continue

          const text = [
            d.name,
            d.formatted_address,
            d.formatted_phone_number ? `Phone: ${d.formatted_phone_number}` : '',
            d.website ? `Website: ${d.website}` : '',
            d.rating ? `Rating: ${d.rating}/5 (${d.user_ratings_total} reviews)` : '',
            d.editorial_summary?.overview || '',
            `Search query: ${query}`
          ].filter(Boolean).join('\n')

          rawItems.push({
            text,
            name: d.name,
            url: d.website || undefined,
            extra: {
              placeId: place.place_id,
              address: d.formatted_address,
              phone: d.formatted_phone_number,
              rating: d.rating,
              reviews: d.user_ratings_total,
              platform: 'google_maps'
            }
          })

          await new Promise(r => setTimeout(r, 150))

        } catch {
          continue
        }
      }

      await new Promise(r => setTimeout(r, 400))

    } catch (err) {
      console.error(`Google query error: ${query}`, err)
    }
  }

  console.log(`📊 Google Places found: ${rawItems.length} places`)
  return await processItems(rawItems, 'google_maps', region)
}
