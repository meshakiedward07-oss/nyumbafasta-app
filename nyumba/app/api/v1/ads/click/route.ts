import { NextRequest, NextResponse } from 'next/server'
import { trackClick } from '@/lib/ads/trackClick'

export async function POST(req: NextRequest) {
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
