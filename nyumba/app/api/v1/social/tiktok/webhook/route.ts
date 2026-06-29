import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// GET — TikTok webhook challenge verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}

function verifyTikTokSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TIKTOK_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[TikTok Webhook] TIKTOK_WEBHOOK_SECRET not set — skipping verification')
    return true
  }
  if (!signature) return false

  // TikTok sends: X-TikTok-Signature: sha256=<hex>
  const prefix = 'sha256='
  if (!signature.startsWith(prefix)) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature.slice(prefix.length), 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

// POST — TikTok webhook events (return 200 immediately)
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-tiktok-signature')

  if (!verifyTikTokSignature(rawBody, signature)) {
    console.warn('[TikTok Webhook] Signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const body = JSON.parse(rawBody) as Record<string, unknown>
    // Fire-and-forget — return 200 immediately so TikTok doesn't retry
    void processTikTokEvent(body).catch(err => console.error('[TikTok Webhook]', err))
  } catch {
    // Ignore parse errors
  }
  return NextResponse.json({ received: true })
}

async function processTikTokEvent(body: Record<string, unknown>) {
  console.log('[TikTok Webhook] Event:', body.event, 'publish_id:', body.publish_id)

  if (body.event === 'video.publish_complete' && body.publish_id) {
    const videoId = body.video_id as string | undefined

    await supabaseAdmin
      .from('tiktok_posts')
      .update({
        status:       'published',
        video_id:     videoId ?? null,
        published_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('publish_id', body.publish_id)

    // Also sync to social_posts table if tracked there
    if (videoId) {
      await supabaseAdmin
        .from('social_posts')
        .update({
          status:           'published',
          platform_post_id: videoId,
          published_at:     new Date().toISOString(),
        })
        .eq('platform', 'tiktok')
        .eq('platform_post_id', body.publish_id)
    }
  }

  if (body.event === 'video.publish_failed' && body.publish_id) {
    const errMsg = ((body.error as Record<string, unknown> | undefined)?.message as string) ?? 'TikTok publish failed'

    await supabaseAdmin
      .from('tiktok_posts')
      .update({
        status:        'failed',
        error_message: errMsg,
        updated_at:    new Date().toISOString(),
      })
      .eq('publish_id', body.publish_id)
  }
}
