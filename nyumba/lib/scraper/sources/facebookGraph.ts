import axios from 'axios'
import * as cheerio from 'cheerio'
import { processItems, RawItem } from '../core/processor'

// Swahili-focused queries — different from googlePlaces.ts which uses English ones
const SWAHILI_QUERIES = [
  'mdalali nyumba {region}',
  'dalali nyumba {region} Tanzania',
  'nyumba za kupanga {region}',
  'makazi {region} Tanzania',
  'ghorofa za kupanga {region}',
  'ofisi ya mdalali {region}',
]

export async function runFacebookGraph(
  region: string
): Promise<ReturnType<typeof processItems>> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN
  const googleKey = process.env.GOOGLE_PLACES_API_KEY

  console.log(`\n📘 Facebook + Website Scraper: ${region}`)
  const rawItems: RawItem[] = []
  const seenIds = new Set<string>()

  // --- Strategy 1: /me/accounts — pages user manages + their posts ---
  if (token) {
    console.log('🔍 Strategy 1: Graph API /me/accounts...')
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts` +
          `?fields=id,name,about,phone,website,fan_count,category,posts{message,created_time}` +
          `&access_token=${token}`
      )
      const data = await res.json()

      for (const page of data.data ?? []) {
        if (seenIds.has(page.id)) continue
        seenIds.add(page.id)

        const postsText =
          (page.posts?.data as Array<{ message?: string }> | undefined)
            ?.map(p => p.message || '')
            .join('\n')
            .slice(0, 1500) || ''

        const text = [
          page.name,
          page.about,
          page.category,
          page.phone ? `Phone: ${page.phone}` : '',
          page.website ? `Website: ${page.website}` : '',
          page.fan_count ? `Followers: ${page.fan_count}` : '',
          postsText,
          `Region: ${region}`,
        ]
          .filter(Boolean)
          .join('\n')

        rawItems.push({
          text,
          name: page.name,
          url: `https://facebook.com/${page.id}`,
          extra: {
            platform: 'facebook',
            pageId: page.id,
            phone: page.phone,
            website: page.website,
            fans: page.fan_count,
          },
        })
        console.log(`  ✅ ${page.name} (${page.fan_count ?? 0} fans)`)
      }
    } catch (err: unknown) {
      console.error('me/accounts error:', err instanceof Error ? err.message : err)
    }
  }

  // --- Strategy 2: Google Places (Swahili queries) → enriched via website scraping ---
  if (googleKey) {
    console.log('🔍 Strategy 2: Google Places (Swahili queries) + website scraping...')

    for (const template of SWAHILI_QUERIES) {
      const query = template.replace('{region}', region)
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json` +
            `?query=${encodeURIComponent(query)}` +
            `&key=${googleKey}`
        )
        const data = await res.json()

        for (const place of (data.results ?? []).slice(0, 8)) {
          if (seenIds.has(place.place_id)) continue
          seenIds.add(place.place_id)

          try {
            const detRes = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json` +
                `?place_id=${place.place_id}` +
                `&fields=name,formatted_phone_number,website,formatted_address` +
                `&key=${googleKey}`
            )
            const det = (await detRes.json()).result ?? {}

            // Scrape their website for Facebook/WhatsApp/extra phones
            let fbUrl = ''
            let waUrl = ''
            let scrapedPhones: string[] = []

            if (det.website && !det.website.includes('facebook.com')) {
              const scraped = await scrapeWebsite(det.website)
              fbUrl = scraped.fbUrl
              waUrl = scraped.waUrl
              scrapedPhones = scraped.phones
            } else if (det.website?.includes('facebook.com')) {
              fbUrl = det.website
            }

            const allPhones = [
              det.formatted_phone_number,
              ...scrapedPhones,
            ].filter(Boolean).join(', ')

            const text = [
              det.name || place.name,
              det.formatted_address || place.formatted_address,
              allPhones ? `Phone: ${allPhones}` : '',
              det.website ? `Website: ${det.website}` : '',
              fbUrl ? `Facebook: ${fbUrl}` : '',
              waUrl ? `WhatsApp: ${waUrl}` : '',
              `Search: ${query}`,
              `Region: ${region}`,
            ]
              .filter(Boolean)
              .join('\n')

            rawItems.push({
              text,
              name: det.name || place.name,
              url: fbUrl || det.website || undefined,
              extra: {
                platform: 'facebook_via_google',
                phone: det.formatted_phone_number || scrapedPhones[0],
                website: det.website,
                facebook_url: fbUrl || undefined,
                whatsapp: waUrl || undefined,
              },
            })

            await delay(300)
          } catch {
            // individual place error — skip
          }
        }

        await delay(500)
      } catch (err: unknown) {
        console.error(`Query error: ${query}`, err instanceof Error ? err.message : err)
      }
    }
  }

  console.log(`📊 Facebook+Web found: ${rawItems.length} items`)
  return await processItems(rawItems, 'facebook_pages', region)
}

async function scrapeWebsite(url: string): Promise<{
  fbUrl: string
  waUrl: string
  phones: string[]
}> {
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      },
      maxRedirects: 3,
    })

    const $ = cheerio.load(res.data as string)
    const bodyText = $('body').text()
    const html = res.data as string

    // Extract Facebook URL
    const fbMatch =
      html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._%+\-/]+/)?.[0] || ''

    // Extract WhatsApp URL or number
    const waMatch =
      html.match(/https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^\s"'<>]+/)?.[0] ||
      html.match(/whatsapp[^\d]*(\+?255\d{9}|\+?0\d{9})/i)?.[1] || ''

    // Extract Tanzanian phone numbers (+255 or 0xxx)
    const phoneRegex = /(?:\+255|0)(?:6[1-9]|7[1-9])\d{7}/g
    const phones = [...new Set(bodyText.match(phoneRegex) ?? [])]

    return {
      fbUrl: fbMatch,
      waUrl: waMatch,
      phones: phones.slice(0, 3),
    }
  } catch {
    return { fbUrl: '', waUrl: '', phones: [] }
  }
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
