import { chromium, Browser, BrowserContext, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

export async function createBrowser(): Promise<Browser> {
  return await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ]
  })
}

export async function createDesktopContext(
  browser: Browser
): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'sw-TZ',
    timezoneId: 'Africa/Dar_es_Salaam',
    extraHTTPHeaders: {
      'Accept-Language': 'sw-TZ,sw;q=0.9,en;q=0.8'
    }
  })
  await blockResources(context)
  return context
}

export function hasFacebookSession(): boolean {
  return [
    'lib/scraper/config/fb-state.json',
    'lib/scraper/config/fb-cookies.json',
  ].some(p => fs.existsSync(path.join(process.cwd(), p)))
}

export async function createFacebookContext(
  browser: Browser
): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'sw-TZ',
    timezoneId: 'Africa/Dar_es_Salaam',
    extraHTTPHeaders: {
      'Accept-Language': 'sw-TZ,sw;q=0.9,en;q=0.8',
    },
  })

  const cookiePaths = [
    path.join(process.cwd(), 'lib/scraper/config/fb-state.json'),
    path.join(process.cwd(), 'lib/scraper/config/fb-cookies.json'),
  ]

  for (const cookiePath of cookiePaths) {
    if (!fs.existsSync(cookiePath)) continue
    try {
      const raw = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'))
      let cookies: any[] = []
      if (Array.isArray(raw)) {
        cookies = raw
      } else if (raw.cookies) {
        cookies = raw.cookies
      }
      if (cookies.length === 0) continue

      const fixedCookies = cookies.map((c: any) => ({
        name: c.name,
        value: c.value || '',
        domain: c.domain || '.facebook.com',
        path: c.path || '/',
        secure: c.secure !== undefined ? c.secure : true,
        httpOnly: c.httpOnly || false,
        sameSite: (['Strict', 'Lax', 'None'].includes(
          c.sameSite?.charAt(0).toUpperCase() + c.sameSite?.slice(1).toLowerCase()
        )
          ? c.sameSite.charAt(0).toUpperCase() + c.sameSite.slice(1).toLowerCase()
          : 'Lax') as 'Lax' | 'Strict' | 'None',
        expires: c.expirationDate || c.expires || -1,
      }))

      await context.addCookies(fixedCookies)
      console.log(
        `🍪 Facebook cookies loaded: ${fixedCookies.length} from ${path.basename(cookiePath)}`
      )
      break
    } catch (err: any) {
      console.error('Cookie load error:', err.message)
    }
  }

  await blockResources(context)
  return context
}

export async function createMobileContext(
  browser: Browser
): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    locale: 'sw-TZ',
    timezoneId: 'Africa/Dar_es_Salaam',
    isMobile: true,
    hasTouch: true
  })
  await blockResources(context)
  return context
}

async function blockResources(context: BrowserContext) {
  await context.route(
    '**/*.{png,jpg,jpeg,gif,svg,ico,mp4,webm,woff,woff2,ttf}',
    route => route.abort()
  )
  await context.route(
    '**/{analytics,ads,tracking,beacon,pixel}**',
    route => route.abort()
  )
  await context.route(
    '**/gtag/**',
    route => route.abort()
  )
}

export async function autoScroll(
  page: Page,
  times: number = 3,
  delay: number = 1200
) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.8)
    })
    await page.waitForTimeout(delay)
  }
}

export function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
