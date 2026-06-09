import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

// Private/auth-only areas — kept out of all crawlers
const DISALLOW = ['/admin/', '/dashboard/', '/api/', '/account/', '/saved/', '/login']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Main search engines — full access to public content
      { userAgent: 'Googlebot', allow: '/', disallow: DISALLOW },
      { userAgent: 'Bingbot', allow: '/', disallow: DISALLOW },

      // AI crawlers — explicitly allowed so NyumbaFasta content is
      // discoverable in AI search (ChatGPT, Claude, Perplexity, Gemini)
      { userAgent: 'GPTBot', allow: '/', disallow: DISALLOW },
      { userAgent: 'Google-Extended', allow: '/', disallow: DISALLOW },
      { userAgent: 'anthropic-ai', allow: '/', disallow: DISALLOW },
      { userAgent: 'Claude-Web', allow: '/', disallow: DISALLOW },
      { userAgent: 'PerplexityBot', allow: '/', disallow: DISALLOW },
      { userAgent: 'facebookexternalhit', allow: '/', disallow: DISALLOW },

      // Everything else — allowed but throttled to protect the DB-backed pages
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
        crawlDelay: 5,
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  }
}
