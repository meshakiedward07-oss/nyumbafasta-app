import { NextRequest, NextResponse } from 'next/server'
import { trackImpressions } from '@/lib/ads/trackImpression'

// Manual impression tracking for cases where the client renders ads
// directly (e.g. BannerAd, VideoAdCard) without going through /ads/ranked.
export async function POST(req: NextRequest) {
  try {
    const { session_id, campaign_ids } = await req.json() as {
      session_id: string
      campaign_ids: string[]
    }
    if (!session_id || !Array.isArray(campaign_ids) || campaign_ids.length === 0) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    await trackImpressions(session_id, campaign_ids.slice(0, 20))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
