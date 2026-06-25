import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { getValidToken, checkTikTokPostStatus } from '@/lib/social/tiktok'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin tu' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const publishId = searchParams.get('publishId')

  if (!publishId) return NextResponse.json({ error: 'publishId inahitajika' }, { status: 400 })

  const accessToken = await getValidToken()
  if (!accessToken) return NextResponse.json({ error: 'TikTok haijaunganishwa' }, { status: 400 })

  const status = await checkTikTokPostStatus(publishId, accessToken)

  if (status.status === 'PUBLISH_COMPLETE') {
    await supabaseAdmin
      .from('tiktok_posts')
      .update({
        status: 'published',
        video_id: status.videoId,
        tiktok_video_url: status.shareUrl,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('publish_id', publishId)
  }

  return NextResponse.json(status)
}
