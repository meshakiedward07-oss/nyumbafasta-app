import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// GET — TikTok webhook challenge verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  if (challenge) return new NextResponse(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}

// POST — TikTok webhook events (return 200 immediately)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
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
