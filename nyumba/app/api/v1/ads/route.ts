import { NextRequest, NextResponse } from 'next/server'
import { getActiveAds, getActiveAdsForRegion, getFeaturedBusinesses } from '@/lib/ads/fetcher'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type   = searchParams.get('type') as 'banner' | 'search' | 'nearby' | 'video' | 'featured' | null
    const region = searchParams.get('region')
    const limit  = parseInt(searchParams.get('limit') ?? '10', 10)

    const VALID_TYPES = ['banner', 'search', 'nearby', 'video', 'featured']
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type inahitajika. Chaguo: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (type === 'featured') {
      const ads = await getFeaturedBusinesses(region ?? undefined)
      return NextResponse.json({ ads })
    }

    const ads = region
      ? await getActiveAdsForRegion({ ad_type: type, region, limit })
      : await getActiveAds({ ad_type: type, limit })

    return NextResponse.json(
      { ads },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' } },
    )

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/ads]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
