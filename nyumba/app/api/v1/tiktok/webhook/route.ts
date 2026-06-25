import { NextRequest, NextResponse } from 'next/server'

// GET — TikTok webhook verification challenge
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  if (challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ ok: true })
}

// POST — TikTok webhook events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[TikTok Webhook]', JSON.stringify(body))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
