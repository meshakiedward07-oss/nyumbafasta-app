import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { getValidToken, checkTikTokPostStatus } from '@/lib/social/tiktok'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  const xHeader = req.headers.get('x-cron-secret')
  return auth === `Bearer ${secret}` || xHeader === secret
}

// POST / GET — poll status of all TikTok posts that are still processing
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []
  const errors:  string[] = []

  try {
    const cutoff       = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    // Posts stuck in processing/uploading for more than 2 hours are marked failed
    const stuckCutoff  = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    // Timeout stuck posts (no API call needed — just DB update)
    const { data: stuckPosts } = await supabaseAdmin
      .from('tiktok_posts')
      .select('id')
      .in('status', ['processing', 'uploading'])
      .lt('created_at', stuckCutoff)

    if (stuckPosts?.length) {
      await supabaseAdmin
        .from('tiktok_posts')
        .update({ status: 'failed', error_message: 'Muda umekwisha — TikTok haikujibu (timeout)', updated_at: new Date().toISOString() })
        .in('id', stuckPosts.map(p => p.id))
      results.push(`${stuckPosts.length} stuck posts timed out`)
    }

    const { data: processingPosts } = await supabaseAdmin
      .from('tiktok_posts')
      .select('id, publish_id')
      .eq('status', 'processing')
      .gte('created_at', cutoff)
      .gte('created_at', stuckCutoff)
      .not('publish_id', 'is', null)
      .limit(30)

    if (!processingPosts?.length) {
      return Response.json({ success: true, message: 'Hakuna posts za processing', results, timestamp: new Date().toISOString() })
    }

    const token = await getValidToken()
    if (!token) {
      return Response.json({ error: 'TikTok token haipatikani' }, { status: 400 })
    }

    let updated = 0
    for (const post of processingPosts) {
      try {
        const st = await checkTikTokPostStatus(post.publish_id as string, token)

        if (st.status === 'PUBLISH_COMPLETE') {
          await supabaseAdmin
            .from('tiktok_posts')
            .update({
              status:            'published',
              video_id:          st.videoId ?? null,
              tiktok_video_url:  st.shareUrl ?? null,
              published_at:      new Date().toISOString(),
              updated_at:        new Date().toISOString(),
            })
            .eq('id', post.id)
          updated++
        } else if (st.status === 'FAILED' || st.status === 'CANCELLED') {
          await supabaseAdmin
            .from('tiktok_posts')
            .update({
              status:     'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', post.id)
          updated++
        }
      } catch (e) {
        errors.push(`post ${post.id}: ${String(e)}`)
      }
    }

    results.push(`${updated}/${processingPosts.length} posts updated`)
  } catch (err) {
    errors.push(String(err))
  }

  return Response.json({
    success:   errors.length === 0,
    results,
    errors,
    timestamp: new Date().toISOString(),
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
