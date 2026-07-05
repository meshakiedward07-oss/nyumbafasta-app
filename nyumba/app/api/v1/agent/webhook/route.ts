import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

// Webhook endpoint kept for compatibility — scraping is now handled
// directly by the Playwright-based runners (no external Apify callbacks).
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const expected = process.env.WEBHOOK_SECRET

    if (!provided || !expected) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    let valid = false
    try {
      valid = timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    } catch {
      valid = false
    }
    if (!valid) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received — scraping now runs inline via Playwright runners'
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Webhook error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
