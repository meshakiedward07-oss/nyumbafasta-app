import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import {
  createIGVideoContainer,
  waitForIGContainer,
  publishIGContainer,
  uploadFacebookVideoUrl,
} from '@/lib/social/metaClient'
import { watermarkVideo } from '@/lib/media/videoWatermark'
import { requireAdminUser } from '@/lib/security/adminAuth'

// Instagram video polling can take 60-120s — requires Vercel Pro (300s limit)
export const maxDuration = 300
export const dynamic     = 'force-dynamic'

// POST /api/v1/social/video/{id}/publish
// Body: { platforms, captionIg, captionFb, scheduledAt? }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const videoId = params.id

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

  // Apply watermark — mandatory. Fail loudly rather than post without it.
  const watermarkedUrl = watermarkVideo(video.video_url)
  if (watermarkedUrl === video.video_url) {
    return NextResponse.json(
      { error: '[Watermark] Watermark ya video haikuweza kutumika — kuchapisha kumesimamishwa' },
      { status: 500 },
    )
  }

  // Mark as posting
  await supabaseAdmin
    .from('video_uploads')
    .update({ post_status: 'posting', platforms, caption_ig: captionIg, caption_fb: captionFb })
    .eq('id', videoId)

  let igPostId: string | null = null
  let fbPostId: string | null = null
  const errors: string[] = []

  // ── Instagram Reel ──────────────────────────────────────────────────────
  if (platforms.includes('instagram')) {
    if (!process.env.INSTAGRAM_USER_ID || !process.env.INSTAGRAM_ACCESS_TOKEN) {
      errors.push('INSTAGRAM_USER_ID au INSTAGRAM_ACCESS_TOKEN hazijakonfigurwa')
    } else {
      try {
        console.log('[VideoPublish] Creating IG reel container...')
        const containerId = await createIGVideoContainer(watermarkedUrl, captionIg, 'REELS')

        console.log('[VideoPublish] Polling IG container status...')
        await waitForIGContainer(containerId, 180_000) // 3-minute timeout

        console.log('[VideoPublish] Publishing IG reel...')
        igPostId = await publishIGContainer(containerId)
        console.log('[VideoPublish] IG reel published:', igPostId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[VideoPublish] IG failed:', msg)
        errors.push(`Instagram: ${msg}`)
      }
    }
  }

  // 500ms cooldown between platforms
  if (platforms.includes('instagram') && platforms.includes('facebook')) {
    await new Promise((r) => setTimeout(r, 500))
  }

  // ── Facebook Video ──────────────────────────────────────────────────────
  if (platforms.includes('facebook')) {
    if (!process.env.FACEBOOK_PAGE_ID || !process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      errors.push('FACEBOOK_PAGE_ID au FACEBOOK_PAGE_ACCESS_TOKEN hazijakonfigurwa')
    } else {
      try {
        console.log('[VideoPublish] Uploading to Facebook...')
        fbPostId = await uploadFacebookVideoUrl(watermarkedUrl, captionFb, video.title)
        console.log('[VideoPublish] FB video uploaded:', fbPostId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[VideoPublish] FB failed:', msg)
        errors.push(`Facebook: ${msg}`)
      }
    }
  }

  const published = !!(igPostId || fbPostId)

  await supabaseAdmin
    .from('video_uploads')
    .update({
      post_status:   published ? 'posted' : 'failed',
      ig_post_id:    igPostId,
      fb_post_id:    fbPostId,
      posted_at:     published ? new Date().toISOString() : null,
      error_message: errors.length ? errors.join(' | ') : null,
    })
    .eq('id', videoId)

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
