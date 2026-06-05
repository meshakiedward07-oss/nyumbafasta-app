import {
  createBrowser,
  createInstagramContext,
  hasInstagramSession,
  autoScroll,
  sleep
} from '../utils/browser'
import { processItems, RawItem } from '../core/processor'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export async function runInstagram(
  region: string
): Promise<ReturnType<typeof processItems>> {
  if (!hasInstagramSession()) {
    console.log('⚠️ Instagram cookies hazipatikani')
    console.log('   Weka ig-cookies.json kwenye lib/scraper/config/')
    return { total: 0, saved: 0, duplicates: 0, low_score: 0, errors: 0, analyzed: 0, leads: [] }
  }

  // Pata profiles kutoka DB
  const { data: dbProfiles } = await supabaseAdmin
    .from('instagram_profiles')
    .select('url, username, region')
    .eq('is_active', true)
    .or(`region.eq.${region},region.eq.Zote Tanzania`)

  if (!dbProfiles?.length) {
    console.log('⚠️ Hakuna Instagram profiles — ongeza kwenye /admin/instagram-profiles')
    return { total: 0, saved: 0, duplicates: 0, low_score: 0, errors: 0, analyzed: 0, leads: [] }
  }

  console.log(`\n📸 Instagram Scraper`)
  console.log(`📍 Region: ${region}`)
  console.log(`📋 Profiles: ${dbProfiles.length}`)
  console.log('='.repeat(40))

  const browser = await createBrowser()
  const rawItems: RawItem[] = []

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

    for (let i = 0; i < dbProfiles.length; i++) {
      const profile = dbProfiles[i]
      console.log(`\n[${i + 1}/${dbProfiles.length}] ${profile.url}`)

      try {
        await page.goto(profile.url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        })
        await sleep(3000)
        await autoScroll(page, 3)

        const profileData = await page.evaluate(() => {
          const bio = document.querySelector(
            '.-vDIg span, [data-testid="user-bio"], section > div > span, header section span'
          )?.textContent || ''
          const name = document.querySelector('h1, h2')?.textContent || ''
          const website = document.querySelector(
            'a[rel="me noopener noreferrer"]'
          )?.textContent || ''
          const followersEl = document.querySelector('span[title], ._ac2a')
          const followers = followersEl?.getAttribute('title') ||
            followersEl?.textContent || '0'

          // Pata captions za posts
          const captions = Array.from(
            document.querySelectorAll('img[alt]')
          ).map(img => img.getAttribute('alt') || '')
            .filter(alt => alt.length > 20)
            .slice(0, 5)
            .join(' ')

          return { bio, name, website, followers, captions }
        })

        // Pata post links na angalia captions
        const postLinks = await page.$$eval(
          'a[href*="/p/"]',
          links => [...new Set(
            links.map(l => l.getAttribute('href')).filter(Boolean)
          )].slice(0, 6)
        ) as string[]

        const postCaptions: string[] = []
        for (const postLink of postLinks.slice(0, 3)) {
          try {
            await page.goto(`https://www.instagram.com${postLink}`, {
              timeout: 10000, waitUntil: 'domcontentloaded'
            })
            await sleep(1500)
            const caption = await page.$eval(
              'h1, [data-testid="post-comment-root"] span',
              el => el.textContent || ''
            ).catch(() => '')
            if (caption.length > 20) postCaptions.push(caption)
            await page.goBack({ timeout: 5000 }).catch(() => {})
            await sleep(1000)
          } catch { continue }
        }

        const text = [
          profileData.name,
          `@${profile.username || ''}`,
          profileData.bio,
          profileData.captions,
          postCaptions.join('\n'),
          profileData.website,
          `Followers: ${profileData.followers}`,
          `Region: ${profile.region || region}`
        ].filter(Boolean).join('\n')

        console.log(`   ✅ Bio: ${profileData.bio?.slice(0, 60) || 'none'}`)
        console.log(`   📝 Posts peeked: ${postCaptions.length}`)

        if (text.length > 20) {
          rawItems.push({
            text,
            name: profileData.name || profile.username || '',
            url: profile.url,
            extra: {
              platform: 'instagram',
              username: profile.username,
              bio: profileData.bio,
              followers: profileData.followers,
            }
          })
        }

        // Update last_scraped_at
        await supabaseAdmin
          .from('instagram_profiles')
          .update({
            last_scraped_at: new Date().toISOString(),
            posts_found: postLinks.length,
          })
          .eq('url', profile.url)

        await sleep(3000)

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`   ❌ Error: ${msg}`)
      }
    }

  } finally {
    await browser.close()
  }

  console.log(`\n📊 Instagram items: ${rawItems.length}`)
  const result = await processItems(rawItems, 'instagram', region)

  if (result.saved > 0) {
    for (const profile of dbProfiles) {
      await supabaseAdmin
        .from('instagram_profiles')
        .update({ leads_found: result.saved })
        .eq('url', profile.url)
    }
  }

  return result
}
