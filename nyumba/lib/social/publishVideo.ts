import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import {
  createIGVideoContainer,
  waitForIGContainer,
  publishIGContainer,
  uploadFacebookVideoUrl,
} from '@/lib/social/metaClient'
import { watermarkVideo } from '@/lib/media/videoWatermark'

export type VideoUploadRow = {
  id: string
  video_url: string
  title: string
}

export type PublishResult = {
  published: boolean
  igPostId:  string | null
  fbPostId:  string | null
  errors:    string[]
}

// Shared by the admin "Publish now" API route and the daily cron job that
// picks up due scheduled videos — both need the exact same watermark
// resolution + Cloudinary pre-warm + IG/FB publish + DB update sequence.
export async function publishVideoNow(
  video: VideoUploadRow,
  platforms: string[],
  captionIg: string,
  captionFb: string,
): Promise<PublishResult> {
  // Resolve watermarked URL — idempotent: if video_url already IS the eager-transformed
  // Cloudinary URL (stored that way since the upload flow was fixed), watermarkVideo() returns
  // it unchanged. Otherwise it constructs the lazy transformation URL.
  const watermarkedUrl = watermarkVideo(video.video_url) ?? video.video_url
  if (!watermarkedUrl) {
    await supabaseAdmin
      .from('video_uploads')
      .update({ post_status: 'failed', error_message: 'Video URL si sahihi au haipo.' })
      .eq('id', video.id)
    return { published: false, igPostId: null, fbPostId: null, errors: ['Video URL si sahihi au haipo.'] }
  }

  // Mark as posting
  await supabaseAdmin
    .from('video_uploads')
    .update({ post_status: 'posting', platforms, caption_ig: captionIg, caption_fb: captionFb })
    .eq('id', video.id)

  // ── Pre-warm the Cloudinary lazy transformation ─────────────────────────
  // Cloudinary builds the watermarked video on the FIRST request — for a 30MB video this
  // takes ~20–60 seconds. Instagram and Facebook fetch the URL themselves when they process
  // the container, and they time out if Cloudinary is still generating the video.
  // We fetch it here first (up to 90s) so it's cached before IG/FB try to download it.
  console.log('[VideoPublish] Pre-warming Cloudinary watermark URL...')
  try {
    const warmController = new AbortController()
    const warmTimeout = setTimeout(() => warmController.abort(), 90_000)
    const warmRes = await fetch(watermarkedUrl, { signal: warmController.signal })
    clearTimeout(warmTimeout)
    console.log('[VideoPublish] Cloudinary watermark ready — HTTP', warmRes.status)
    // Drain body so the TCP connection closes cleanly
    await warmRes.body?.cancel()
  } catch {
    // AbortError = still generating after 90s; network errors; etc.
    // Continue — IG/FB have their own retry mechanisms and may still succeed.
    console.warn('[VideoPublish] Cloudinary pre-warm timed out or failed — continuing with publish')
  }

  let igPostId: string | null = null
  let fbPostId: string | null = null
  const errors: string[] = []

  // ── Instagram Reel ──────────────────────────────────────────────────────
  if (platforms.includes('instagram')) {
    if (!process.env.INSTAGRAM_USER_ID || !process.env.INSTAGRAM_ACCESS_TOKEN) {
      errors.push('Instagram: INSTAGRAM_USER_ID au INSTAGRAM_ACCESS_TOKEN hazijakonfigurwa kwenye Vercel')
    } else {
      try {
        console.log('[VideoPublish] Creating IG reel container...')
        const containerId = await createIGVideoContainer(watermarkedUrl, captionIg, 'REELS')

        console.log('[VideoPublish] Polling IG container status (id:', containerId, ')...')
        await waitForIGContainer(containerId, 180_000) // 3-minute poll timeout

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

  // 1s cooldown between platforms
  if (platforms.includes('instagram') && platforms.includes('facebook')) {
    await new Promise((r) => setTimeout(r, 1000))
  }

  // ── Facebook Video ──────────────────────────────────────────────────────
  if (platforms.includes('facebook')) {
    if (!process.env.FACEBOOK_PAGE_ID || (!process.env.INSTAGRAM_ACCESS_TOKEN && !process.env.FACEBOOK_PAGE_ACCESS_TOKEN && !process.env.FACEBOOK_ACCESS_TOKEN)) {
      errors.push('Facebook: FACEBOOK_PAGE_ID au token hazijakonfigurwa kwenye Vercel')
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
    .eq('id', video.id)

  return { published, igPostId, fbPostId, errors }
}
