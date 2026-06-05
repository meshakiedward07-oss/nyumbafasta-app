import {
  createBrowser,
  createInstagramContext,
  hasInstagramSession,
  autoScroll,
  sleep
} from '../utils/browser'
import { processItems, RawItem } from '../core/processor'

export async function runInstagram(
  region: string
): Promise<ReturnType<typeof processItems>> {
  if (!hasInstagramSession()) {
    console.log('⚠️ Instagram cookies hazipatikani')
    console.log('   Weka ig-cookies.json kwenye lib/scraper/config/')
    return { total: 0, saved: 0, duplicates: 0, low_score: 0, errors: 0, analyzed: 0, leads: [] }
  }

  const browser = await createBrowser()
  const rawItems: RawItem[] = []
  const processedProfiles = new Set<string>()

  try {
    const context = await createInstagramContext(browser)
    const page = await context.newPage()

    // Test session
    await page.goto('https://www.instagram.com', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    })
    await sleep(3000)

    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="username"]')
    })

    if (!isLoggedIn) {
      console.log('❌ Instagram cookies zimekwisha')
      await browser.close()
      return { total: 0, saved: 0, duplicates: 0, low_score: 0, errors: 0, analyzed: 0, leads: [] }
    }

    console.log('✅ Instagram session inafanya kazi!')

    const hashtags = [
      'nyumbatz',
      'tanzaniarealestate',
      `mdalali${region.toLowerCase().replace(/\s+/g, '')}`,
      'nyumbainapangishwa',
      'realestatetanzania'
    ]

    for (const hashtag of hashtags) {
      try {
        console.log(`\n📸 Instagram #${hashtag}`)

        await page.goto(
          `https://www.instagram.com/explore/tags/${hashtag}/`,
          { timeout: 15000, waitUntil: 'domcontentloaded' }
        )
        await sleep(3000)
        await autoScroll(page, 3)

        const postLinks = await page.$$eval(
          'a[href*="/p/"]',
          links => [...new Set(
            links.map(l => l.getAttribute('href'))
              .filter(Boolean)
          )].slice(0, 12)
        ) as string[]

        for (const postLink of postLinks) {
          try {
            await page.goto(
              `https://www.instagram.com${postLink}`,
              { timeout: 10000, waitUntil: 'domcontentloaded' }
            )
            await sleep(2000)

            const profileLink = await page.$eval(
              'header a[href^="/"]',
              el => el.getAttribute('href')
            ).catch(() => null)

            if (!profileLink ||
                processedProfiles.has(profileLink)) continue
            processedProfiles.add(profileLink)

            const caption = await page.$eval(
              'h1',
              el => el.textContent || ''
            ).catch(() => '')

            await page.goto(
              `https://www.instagram.com${profileLink}`,
              { timeout: 10000, waitUntil: 'domcontentloaded' }
            )
            await sleep(2000)

            const profileData = await page.evaluate(() => {
              const bio = document.querySelector(
                '.-vDIg span, [data-testid="user-bio"], section > div > span'
              )?.textContent || ''
              const name = document.querySelector(
                'h1, h2'
              )?.textContent || ''
              const website = document.querySelector(
                'a[rel="me noopener noreferrer"]'
              )?.textContent || ''
              return { bio, name, website }
            })

            const text = [
              profileData.name,
              profileData.bio,
              caption,
              profileData.website,
              `Region: ${region}`,
              `Hashtag: #${hashtag}`
            ].filter(Boolean).join('\n')

            if (text.length > 20) {
              rawItems.push({
                text,
                name: profileData.name,
                url: `https://www.instagram.com${profileLink}`,
                extra: {
                  platform: 'instagram',
                  bio: profileData.bio,
                  hashtag
                }
              })
            }

            await sleep(2000)

          } catch {
            continue
          }
        }

        await sleep(4000)

      } catch (err) {
        console.error(`IG hashtag error: #${hashtag}`, err)
      }
    }

  } finally {
    await browser.close()
  }

  console.log(`📊 Instagram items: ${rawItems.length}`)
  return await processItems(rawItems, 'instagram', region)
}
