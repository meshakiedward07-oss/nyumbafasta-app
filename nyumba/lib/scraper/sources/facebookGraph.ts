import { processItems, RawItem } from '../core/processor'

// Known Tanzania real-estate Facebook pages (used when pages_search scope is absent)
const KNOWN_TZ_RE_PAGES = [
  'tanzaniarealestate',
  'nyumbaZanzibar',
  'daressalaamproperties',
  'tanzaniaproperties',
  'nyumbaTanzania',
  'ArushaPropety',
  'MwanzaRealEstate',
]

export async function runFacebookGraph(
  region: string
): Promise<ReturnType<typeof processItems>> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN
  if (!token) {
    console.log('⚠️  FACEBOOK_ACCESS_TOKEN haipo — skipping facebook_graph')
    return { total: 0, saved: 0, duplicates: 0, low_score: 0, errors: 0, analyzed: 0, leads: [] }
  }

  console.log(`\n📘 Facebook Graph API: ${region}`)

  const queries = [
    `mdalali nyumba ${region} Tanzania`,
    `real estate agent ${region} Tanzania`,
    `nyumba inapangishwa ${region}`,
    `property agency ${region} Tanzania`,
    `house for rent ${region} Tanzania`,
  ]

  const rawItems: RawItem[] = []
  const seenIds = new Set<string>()

  // --- Strategy 1: pages_search (requires pages_search scope) ---
  let searchWorked = false
  for (const query of queries) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/search` +
          `?q=${encodeURIComponent(query)}` +
          `&type=page` +
          `&fields=id,name,about,phone,website,fan_count,location,category` +
          `&limit=25` +
          `&access_token=${token}`
      )
      const data = await res.json()

      if (data.error) {
        // code 10 = permission denied; anything else is unexpected
        if (data.error.code !== 10) {
          console.error('FB search error:', data.error.message)
        }
        break
      }

      if (data.data?.length) searchWorked = true

      for (const page of data.data ?? []) {
        if (seenIds.has(page.id)) continue
        seenIds.add(page.id)
        rawItems.push(buildItem(page, query, region))
      }

      await delay(500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`FB query error: ${query}`, msg)
    }
  }

  if (!searchWorked) {
    console.log(
      '⚠️  pages_search scope haipo — inaomba pages_search kwenye Facebook App.\n' +
        '   Inatumia strategy mbadala (known page IDs)...'
    )

    // --- Strategy 2: fetch known Tanzania RE pages directly ---
    for (const slug of KNOWN_TZ_RE_PAGES) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v18.0/${slug}` +
            `?fields=id,name,about,phone,website,fan_count,location,category` +
            `&access_token=${token}`
        )
        const page = await res.json()

        if (page.error || !page.id) continue
        if (seenIds.has(page.id)) continue
        seenIds.add(page.id)

        rawItems.push(buildItem(page, `known:${slug}`, region))
        await delay(300)
      } catch {
        // page slug may not exist — ignore silently
      }
    }

    // --- Strategy 3: /me/accounts (pages user manages) ---
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts` +
          `?fields=id,name,about,phone,website,fan_count,category` +
          `&access_token=${token}`
      )
      const data = await res.json()

      for (const page of data.data ?? []) {
        if (seenIds.has(page.id)) continue
        seenIds.add(page.id)
        rawItems.push(buildItem(page, 'me/accounts', region))
      }
    } catch {
      // ignore
    }
  }

  console.log(`📊 Facebook Graph found: ${rawItems.length} pages`)
  return await processItems(rawItems, 'facebook_pages', region)
}

function buildItem(page: Record<string, unknown>, query: string, region: string): RawItem {
  const location = page.location as Record<string, string> | undefined
  const text = [
    page.name,
    page.about,
    page.category,
    page.phone ? `Phone: ${page.phone}` : '',
    page.website ? `Website: ${page.website}` : '',
    page.fan_count ? `Followers: ${page.fan_count}` : '',
    location?.city ? `Location: ${location.city}` : '',
    `Search: ${query}`,
    `Region: ${region}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    text,
    name: String(page.name ?? ''),
    url: `https://facebook.com/${page.id}`,
    extra: {
      platform: 'facebook_graph',
      pageId: page.id,
      phone: page.phone,
      website: page.website,
      fans: page.fan_count,
      category: page.category,
      location: page.location,
    },
  }
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
