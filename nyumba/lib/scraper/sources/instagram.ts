import {
  createBrowser,
  createMobileContext,
  autoScroll,
  sleep
} from '../utils/browser'
import { processItems, RawItem } from '../core/processor'

export async function runInstagram(
  region: string
): Promise<ReturnType<typeof processItems>> {
  const browser = await createBrowser()
  const rawItems: RawItem[] = []
  const processedProfiles = new Set<string>()

  try {
    const context = await createMobileContext(browser)
    const page = await context.newPage()

    const hashtags = [
      'nyumbatz',
      'tanzaniarealestate',
      `mdalali${region.toLowerCase().replace(/\s+/g, '')}`,
      'nyumbainapangishwa',
      'realestatetanzania',
      `nyumba${region.toLowerCase().replace(/\s+/g, '')}`
    ]

    for (const hashtag of hashtags) {
      try {
        console.log(`📸 Instagram #${hashtag}`)

        await page.goto(
          `https://www.instagram.com/explore/tags/${hashtag}/`,
          { timeout: 20000, waitUntil: 'domcontentloaded' }
        )

        await sleep(4000)
        await autoScroll(page, 3)

        const postLinks = await page.$$eval(
          'a[href*="/p/"]',
          links => [...new Set(
            links.map(l => l.getAttribute('href'))
              .filter(Boolean)
          )].slice(0, 15)
        ) as string[]

        for (const postLink of postLinks) {
          try {
            await page.goto(
              `https://www.instagram.com${postLink}`,
              { timeout: 15000, waitUntil: 'domcontentloaded' }
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
              'h1, [data-testid="post-comment-root"] span',
              el => el.textContent || ''
            ).catch(() => '')

            await page.goto(
              `https://www.instagram.com${profileLink}`,
              { timeout: 15000, waitUntil: 'domcontentloaded' }
            )
            await sleep(2500)

            const profileData = await page.evaluate(() => {
              const bio = document.querySelector(
                '.-vDIg span, [data-testid="user-bio"]'
              )?.textContent || ''

              const name = document.querySelector(
                'h1, h2, ._aacl._aacs._aact._aacx._aada'
              )?.textContent || ''

              const website = document.querySelector(
                'a[rel="me noopener noreferrer"]'
              )?.getAttribute('href') || ''

              const followersEl = document.querySelector(
                'span[title], ._ac2a'
              )
              const followers = followersEl?.getAttribute('title') ||
                followersEl?.textContent || '0'

              return { bio, name, website, followers }
            })

            const text = [
              profileData.name,
              profileData.bio,
              caption,
              profileData.website,
              `Followers: ${profileData.followers}`,
              `Region hint: ${region}`
            ].filter(Boolean).join('\n')

            if (text.length > 30) {
              rawItems.push({
                text,
                name: profileData.name,
                url: `https://www.instagram.com${profileLink}`,
                extra: {
                  platform: 'instagram',
                  bio: profileData.bio,
                  website: profileData.website,
                  followers: profileData.followers,
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
        console.error(`IG error: #${hashtag}`, err)
      }
    }

  } finally {
    await browser.close()
  }

  console.log(`📊 Instagram found: ${rawItems.length} profiles`)
  return await processItems(rawItems, 'instagram', region)
}
