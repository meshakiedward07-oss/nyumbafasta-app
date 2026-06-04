import { Page } from 'playwright'
import {
  createBrowser,
  createDesktopContext,
  autoScroll,
  sleep
} from '../utils/browser'
import { processItems, RawItem } from '../core/processor'

export async function runFacebook(
  region: string
): Promise<ReturnType<typeof processItems>> {
  const browser = await createBrowser()
  const rawItems: RawItem[] = []

  try {
    const context = await createDesktopContext(browser)
    const page = await context.newPage()

    const queries = [
      `mdalali nyumba ${region} Tanzania`,
      `real estate ${region} Tanzania`,
      `nyumba inapangishwa ${region}`,
      `property for rent ${region}`
    ]

    for (const query of queries) {
      try {
        console.log(`📘 FB Pages: ${query}`)

        await page.goto(
          `https://www.facebook.com/search/pages/?q=${encodeURIComponent(query)}`,
          { timeout: 20000, waitUntil: 'domcontentloaded' }
        )

        await sleep(3000)
        await autoScroll(page, 5)

        const items = await extractFacebookItems(page)
        rawItems.push(...items)

        await sleep(2000)

      } catch (err) {
        console.error(`FB pages error: ${query}`, err)
      }
    }

    for (const query of queries.slice(0, 2)) {
      try {
        console.log(`👥 FB Groups: ${query}`)

        await page.goto(
          `https://www.facebook.com/search/groups/?q=${encodeURIComponent(query)}`,
          { timeout: 20000, waitUntil: 'domcontentloaded' }
        )

        await sleep(3000)
        await autoScroll(page, 4)

        const items = await extractFacebookItems(page)
        rawItems.push(...items)

        await sleep(2000)

      } catch (err) {
        console.error(`FB groups error: ${query}`, err)
      }
    }

  } finally {
    await browser.close()
  }

  console.log(`📊 Facebook found: ${rawItems.length} items`)
  return await processItems(rawItems, 'facebook_pages', region)
}

async function extractFacebookItems(page: Page): Promise<RawItem[]> {
  const raw = await page.evaluate(() => {
    const items: Array<{ text: string; name: string; url: string | null; extra: Record<string, string> }> = []
    const cards = document.querySelectorAll(
      '[role="article"], [data-pagelet*="Search"] > div > div'
    )

    cards.forEach(card => {
      const text = (card as HTMLElement).innerText || ''
      const links = Array.from(card.querySelectorAll('a'))
        .map(a => a.href)
        .filter(h =>
          h.includes('facebook.com') &&
          !h.includes('/search/') &&
          !h.includes('#')
        )

      if (text.length > 30) {
        items.push({
          text: text.slice(0, 2000),
          name: text.split('\n')[0].slice(0, 80),
          url: links[0] || null,
          extra: { platform: 'facebook' }
        })
      }
    })

    return items.slice(0, 30)
  })

  return raw.map(item => ({
    ...item,
    url: item.url ?? undefined
  }))
}
