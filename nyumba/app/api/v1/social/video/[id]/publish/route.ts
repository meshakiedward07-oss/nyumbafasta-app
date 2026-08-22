import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { publishVideoNow } from '@/lib/social/publishVideo'
import { requireAdminUser } from '@/lib/security/adminAuth'

// Instagram video polling can take 60-120s — requires Vercel Pro (300s limit)
export const maxDuration = 300
export const dynamic     = 'force-dynamic'

// POST /api/v1/social/video/{id}/publish
// Body: { platforms, captionIg, captionFb, scheduledAt? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const videoId = id

  const body = await req.json() as {
    platforms:    string[]
    captionIg:    string
    captionFb:    string
    scheduledAt?: string
  }

  const { platforms, captionIg, captionFb, scheduledAt } = body

  if (!platforms?.length) {
    return NextResponse.json({ error: 'Chagua angalau jukwaa moja' }, { status: 400 })
  }

  // Fetch video record
  const { data: video, error: fetchErr } = await supabaseAdmin
    .from('video_uploads')
    .select('*')
    .eq('id', videoId)
    .single()

  if (fetchErr || !video) {
    return NextResponse.json({ error: 'Video haipatikani' }, { status: 404 })
  }

  if (video.post_status === 'posted') {
    return NextResponse.json({ error: 'Video hii imeshachapishwa' }, { status: 400 })
  }

  // Scheduling
  if (scheduledAt) {
    await supabaseAdmin
      .from('video_uploads')
      .update({
        platforms,
        caption_ig:  captionIg,
        caption_fb:  captionFb,
        post_status: 'scheduled',
        scheduled_at: scheduledAt,
      })
      .eq('id', videoId)

    return NextResponse.json({ ok: true, scheduled: true, scheduledAt })
  }

  const { published, igPostId, fbPostId, errors } = await publishVideoNow(video, platforms, captionIg, captionFb)

  if (!published) {
    return NextResponse.json(
      { error: errors.join(' | ') || 'Kuchapisha kumeshindwa' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    igPostId,
    fbPostId,
    warnings: errors.length ? errors : undefined,
  })
}
