import { NextRequest, NextResponse } from 'next/server'
import { rankAds, type AdType } from '@/lib/ads/rankingEngine'
import { trackImpressions } from '@/lib/ads/trackImpression'

const VALID_TYPES: AdType[] = ['banner', 'search', 'nearby', 'video', 'featured']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const region    = searchParams.get('region')
  const typeParam = searchParams.get('type')
  const category  = searchParams.get('category') ?? undefined
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

  const result = await rankAds({ ad_type, region, category, sessionId, limit })

  // Track impressions in background — don't block the response
  if (result.ads.length > 0) {
    trackImpressions(sessionId, result.ads.map(a => a.id)).catch(() => {})
  }

  return NextResponse.json(result, {
    headers: {
      // Short cache — rotation changes daily, freq cap changes per user
      'Cache-Control': 'no-store',
    },
  })
}
