import { NextRequest, NextResponse } from 'next/server'
import { trackImpressions } from '@/lib/ads/trackImpression'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'

// Impression tracking for client-rendered ads (BannerAd, VideoAdCard, etc.)
// No auth required — anonymous browsers generate real impressions too.
// Rate-limited per IP to prevent artificial inflation.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`impress:${ip}`, 120, 60_000) // 120 per minute per IP
  if (!rl.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

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
