import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

// Webhook endpoint kept for compatibility — scraping is now handled
// directly by the Playwright-based runners (no external Apify callbacks).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { secret } = body

    if (secret !== process.env.WEBHOOK_SECRET) {
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
