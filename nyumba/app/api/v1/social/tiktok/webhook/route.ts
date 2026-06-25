import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// GET — TikTok webhook challenge verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}

// POST — TikTok webhook events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    console.log('[TikTok Webhook]', JSON.stringify(body))

    // Handle video publish complete event
    if (body.event === 'video.publish_complete' && body.publish_id) {
      void supabaseAdmin
        .from('tiktok_posts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('publish_id', body.publish_id)
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ received: true })
  }
}
