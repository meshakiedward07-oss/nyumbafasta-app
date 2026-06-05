import { createBrowser, createFacebookContext, hasFacebookSession, autoScroll, sleep } from '../utils/browser'
import { processItems, RawItem } from '../core/processor'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { ALL_GROUPS } from '../config/facebookGroups'

type GroupPost = {
  text: string
  links: string[]
  images: string[]
  timestamp: string
}

export async function runFacebookGroups(
  region: string,
  customGroups?: string[]
): Promise<ReturnType<typeof processItems>> {
  const groupsToScrape = customGroups ?? ALL_GROUPS

  console.log(`\n👥 Facebook Groups Scraper`)
  console.log(`📍 Region: ${region}`)
  console.log(`📋 Groups: ${groupsToScrape.length}`)
  console.log('='.repeat(40))

  if (!hasFacebookSession()) {
    console.log('⚠️ Facebook cookies hazipatikani')
    console.log('   Weka fb-cookies.json kwenye lib/scraper/config/')
    return { total: 0, saved: 0, duplicates: 0, low_score: 0, errors: 0, analyzed: 0, leads: [] }
  }

  const browser = await createBrowser()
  const rawItems: RawItem[] = []

  try {
    const context = await createFacebookContext(browser)
    const page = await context.newPage()

    console.log('🔍 Checking Facebook session...')
    await page.goto('https://www.facebook.com', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await sleep(3000)

    const isLoggedIn = await page.evaluate(() => {
      const html = document.body.innerHTML
      return (
        html.includes('home') ||
        html.includes('feed') ||
        !html.includes('login') ||
        document.querySelector('[role="banner"]') !== null
      )
    })

    if (!isLoggedIn) {
      console.log('❌ Cookies zimekwisha — pata cookies mpya')
      await browser.close()
      return { total: 0, saved: 0, duplicates: 0, low_score: 0, errors: 0, analyzed: 0, leads: [] }
    }

    console.log('✅ Facebook session inafanya kazi!')

    for (let i = 0; i < groupsToScrape.length; i++) {
      const groupUrl = groupsToScrape[i]
      console.log(`\n[${i + 1}/${groupsToScrape.length}] ${groupUrl}`)

      try {
        await page.goto(groupUrl, { timeout: 20000, waitUntil: 'domcontentloaded' })
        await sleep(3000)

        const pageTitle = await page.title()
        console.log(`   Title: ${pageTitle}`)

        const isPrivate = await page.evaluate(() => {
          const text = document.body.innerText
          return (
            text.includes('Private group') ||
            text.includes('Kundi la siri') ||
            text.includes('Join group') ||
            text.includes('Log in')
          )
        })

        if (isPrivate) {
          console.log(`   ⚠️ Private/login required — skipping`)
          continue
        }

        await autoScroll(page, 8, 1500)

        const posts: GroupPost[] = await page.evaluate(() => {
          const items: GroupPost[] = []
          const selectors = [
            '[role="article"]',
            '[data-pagelet*="FeedUnit"]',
            'div[class*="userContent"]',
            'div[data-ad-preview="message"]',
          ]

          let postElements: NodeListOf<Element> | null = null
          for (const sel of selectors) {
            const els = document.querySelectorAll(sel)
            if (els.length > 0) { postElements = els; break }
          }
          if (!postElements) return items

          postElements.forEach(post => {
            const text = (post as HTMLElement).innerText || ''
            if (text.length < 30) return

            const links = Array.from(post.querySelectorAll('a[href*="facebook.com"]'))
              .map(a => (a as HTMLAnchorElement).href)
              .filter(h => !h.includes('/groups/') && !h.includes('/hashtag/'))

            const images = Array.from(post.querySelectorAll('img[src*="fbcdn"]'))
              .map(img => (img as HTMLImageElement).src)
              .slice(0, 3)

            items.push({
              text: text.slice(0, 2000),
              links: links.slice(0, 5),
              images,
              timestamp: (post.querySelector('abbr') as HTMLElement | null)
                ?.getAttribute('title') || '',
            })
          })

          return items.slice(0, 50)
        })

        console.log(`   ✅ Posts: ${posts.length}`)

        let postsKept = 0
        for (const post of posts) {
          const hasRelevantContent =
            /(\+?255|0)[67]\d{8}/.test(post.text) ||
            /nyumba|apartment|chumba|mdalali|property|rent|sale|bei/i.test(post.text)

          if (!hasRelevantContent) continue

          rawItems.push({
            text: post.text,
            name: post.text.split('\n')[0].trim().slice(0, 80),
            url: post.links[0] || groupUrl,
            extra: {
              platform: 'facebook_groups',
              groupUrl,
              profileLinks: post.links,
              timestamp: post.timestamp,
            },
          })
          postsKept++
        }
        console.log(`   📝 Relevant posts kept: ${postsKept}`)

        // Update last_scraped_at in DB (best effort)
        await supabaseAdmin
          .from('facebook_groups')
          .update({
            last_scraped_at: new Date().toISOString(),
            posts_found: posts.length,
          })
          .eq('url', groupUrl)

        await sleep(3000)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`   ❌ Error: ${msg}`)
        continue
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n📊 Facebook Groups total items: ${rawItems.length}`)

  const result = await processItems(rawItems, 'facebook_groups', region)

  // Update leads_found stats (best effort)
  if (result.saved > 0) {
    for (const groupUrl of groupsToScrape) {
      await supabaseAdmin
        .from('facebook_groups')
        .update({ leads_found: result.saved })
        .eq('url', groupUrl)
    }
  }

  return result
}

// Fetch active groups from Supabase DB — used by scheduler/API
export async function runFacebookGroupsFromDB(
  region: string
): Promise<ReturnType<typeof processItems>> {
  const { data: groups, error } = await supabaseAdmin
    .from('facebook_groups')
    .select('url, name, region')
    .eq('is_active', true)
    .or(`region.eq.${region},region.eq.Zote Tanzania`)

  if (error || !groups?.length) {
    console.log(`⚠️ Hakuna groups za kurun kwa ${region}`)
    return { total: 0, saved: 0, duplicates: 0, low_score: 0, errors: 0, analyzed: 0, leads: [] }
  }

  const groupUrls = groups.map(g => g.url)
  console.log(`📋 Running ${groupUrls.length} groups kwa ${region}`)
  return await runFacebookGroups(region, groupUrls)
}
