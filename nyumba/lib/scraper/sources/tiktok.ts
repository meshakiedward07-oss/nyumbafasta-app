import {
  createBrowser,
  createDesktopContext,
  sleep
} from '../utils/browser'
import { processItems, RawItem } from '../core/processor'

export async function runTikTok(
  region: string
): Promise<ReturnType<typeof processItems>> {
  const browser = await createBrowser()
  const rawItems: RawItem[] = []
  const processedProfiles = new Set<string>()

  try {
    const context = await createDesktopContext(browser)
    const page = await context.newPage()

    const hashtags = [
      'nyumbatz',
      'tanzaniarealestate',
      'mdalali',
      `nyumba${region.toLowerCase().replace(/\s+/g, '')}`,
      'realestatetanzania',
      'nyumbainapangishwa'
    ]

    for (const hashtag of hashtags) {
      try {
        console.log(`🎵 TikTok #${hashtag}`)

        await page.goto(
          `https://www.tiktok.com/tag/${hashtag}`,
          { timeout: 20000, waitUntil: 'domcontentloaded' }
        )

        await sleep(4000)

        for (let i = 0; i < 4; i++) {
          await page.evaluate(() => window.scrollBy(0, 900))
          await sleep(1200)
        }

        const profileLinks = await page.$$eval(
          'a[href*="/@"]',
          links => [...new Set(
            links.map(l => l.getAttribute('href'))
              .filter(l => l?.includes('/@'))
              .map(l => l?.split('/video/')[0])
              .filter(Boolean)
          )].slice(0, 20)
        ) as string[]

        for (const profilePath of profileLinks) {
          if (processedProfiles.has(profilePath)) continue
          processedProfiles.add(profilePath)

          try {
            const profileUrl = profilePath.startsWith('http')
              ? profilePath
              : `https://www.tiktok.com${profilePath}`

            await page.goto(profileUrl, {
              timeout: 15000,
              waitUntil: 'domcontentloaded'
            })
            await sleep(3000)

            const profileData = await page.evaluate(() => {
              const bio = document.querySelector(
                '[data-e2e="user-bio"]'
              )?.textContent || ''

              const name = document.querySelector(
                '[data-e2e="user-title"]'
              )?.textContent || ''

              const username = document.querySelector(
                '[data-e2e="user-subtitle"]'
              )?.textContent || ''

              const website = document.querySelector(
                'a[data-e2e="user-link"]'
              )?.textContent || ''

              const followers = document.querySelector(
                '[data-e2e="followers-count"]'
              )?.textContent || '0'

              const captions = Array.from(
                document.querySelectorAll('[data-e2e="video-desc"]')
              ).map(el => el.textContent || '')
               .slice(0, 5)
               .join(' ')

              return { bio, name, username, website, followers, captions }
            })

            const text = [
              profileData.name,
              `@${profileData.username}`,
              profileData.bio,
              profileData.captions,
              profileData.website,
              `Followers: ${profileData.followers}`,
              `Region hint: ${region}`
            ].filter(Boolean).join('\n')

            if (text.length > 30) {
              rawItems.push({
                text,
                name: profileData.name,
                url: profileUrl,
                extra: {
                  platform: 'tiktok',
                  username: profileData.username,
                  followers: profileData.followers,
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
        console.error(`TikTok error: #${hashtag}`, err)
      }
    }

  } finally {
    await browser.close()
  }

  console.log(`📊 TikTok found: ${rawItems.length} profiles`)
  return await processItems(rawItems, 'tiktok', region)
}
