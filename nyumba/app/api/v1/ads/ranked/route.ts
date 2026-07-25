import { NextRequest, NextResponse } from 'next/server'
import { rankAds, type AdType } from '@/lib/ads/rankingEngine'
import { trackImpressions } from '@/lib/ads/trackImpression'

const VALID_TYPES: AdType[] = ['banner', 'search', 'nearby', 'video', 'featured']

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const region    = searchParams.get('region')
    const typeParam = searchParams.get('type')
    const category  = searchParams.get('category') ?? undefined
    const placement = searchParams.get('placement') ?? undefined
    const sessionId = searchParams.get('sid')
    const limit     = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '5', 10), 3), 10)

    if (!region) {
      return NextResponse.json({ error: 'region inahitajika' }, { status: 400 })
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'sid inahitajika' }, { status: 400 })
    }

    // Validate ad type if provided
    const ad_type = typeParam
      ? VALID_TYPES.includes(typeParam as AdType)
        ? (typeParam as AdType)
        : undefined
      : undefined

    const result = await rankAds({ ad_type, region, category, placement, sessionId, limit })

    // Track impressions in background — skip for SSR sessions to avoid poisoning
    // the freq cap table with bot/crawler traffic (all SSR shares session 'ssr')
    if (result.ads.length > 0 && sessionId !== 'ssr') {
      trackImpressions(sessionId, result.ads.map(a => a.id)).catch(() => {})
    }

    return NextResponse.json(result, {
      headers: {
        // Per-user ad ranking — not publicly cacheable, but allow the browser
        // to cache briefly so rapid navigations don't re-fire this endpoint.
        'Cache-Control': 'private, max-age=30',
      },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/ads/ranked]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
