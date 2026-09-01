import { NextRequest, NextResponse } from 'next/server'
import { trackClick } from '@/lib/ads/trackClick'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'

// No auth required — anonymous browsers generate real clicks too. Rate-limited
// per IP to prevent artificial inflation/deflation of advertiser-facing CTR
// stats — this route had no protection at all until the 2026-09-01
// ads-system audit (its sibling /api/v1/ads/impress already had this).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`ad_click:${ip}`, 60, 60_000) // 60 per minute per IP
  if (!rl.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  try {
    const { campaign_id } = await req.json()
    if (!campaign_id || typeof campaign_id !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    await trackClick(campaign_id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
