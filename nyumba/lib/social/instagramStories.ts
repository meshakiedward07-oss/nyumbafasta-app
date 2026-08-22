import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { isCloudinaryUrl } from '@/lib/media/watermark'
import { watermarkVideo } from '@/lib/media/videoWatermark'
import type { Listing } from '@/lib/types/database'

const GRAPH      = 'https://graph.facebook.com/v21.0'
const igToken    = () => process.env.INSTAGRAM_ACCESS_TOKEN ?? ''
const igUserId   = () => process.env.INSTAGRAM_USER_ID      ?? ''
// INSTAGRAM_ACCESS_TOKEN IS the Facebook Page Token — use it for FB page ops too
const fbToken    = () => process.env.INSTAGRAM_ACCESS_TOKEN ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN ?? ''
const fbPageId   = () => process.env.FACEBOOK_PAGE_ID ?? ''

// ── Build a 9:16 story-format image URL ───────────────────────────────────────
// For Cloudinary images: insert crop+watermark transformations
// For others: use as-is (Meta crops at display time)

export function buildStoryImageUrl(imageUrl: string): string {
  if (!isCloudinaryUrl(imageUrl)) return imageUrl

  const marker = '/image/upload/'
  const idx    = imageUrl.indexOf(marker)
  if (idx === -1) return imageUrl

  const base = imageUrl.slice(0, idx + marker.length)
  const rest = imageUrl.slice(idx + marker.length)

  // Crop to 9:16, then add watermark at bottom-center.
  // NOTE: pa_ (padding) is NOT supported for image overlays — use bo_ (transparent border trick) instead.
  // Tested: this format returns HTTP 200 from Cloudinary. pa_12 causes HTTP 400.
  const transforms = [
    'ar_9:16,c_fill,g_auto,w_1080',
    [
      'l_text:Arial_32_bold:NyumbaFasta%20%E2%80%A2%20nyumbafasta.co',
      'co_white',
      'b_rgb:000000B3',
      'bo_10px_solid_rgb:00000000',  // transparent border = padding (pa_ not supported on images)
      'r_20',                         // border radius
      'g_south',                      // bottom-center
      'y_60',
    ].join(','),
  ].join('/')

  return `${base}${transforms}/${rest}`
}

// ── Post a single Instagram Story ─────────────────────────────────────────────

export async function postInstagramStory(params: {
  imageUrl:    string
  listingUrl?: string
}): Promise<{ success: boolean; storyId?: string; error?: string }> {
  if (!igUserId() || !igToken()) {
    return { success: false, error: 'INSTAGRAM_USER_ID au INSTAGRAM_ACCESS_TOKEN hazijakonfigurwa' }
  }

  try {
    console.log('[IG Stories] Creating story container...')

    const containerBody: Record<string, unknown> = {
      image_url:    params.imageUrl,
      media_type:   'STORIES',
      access_token: igToken(),
    }

    // Link sticker — optional; domain must be whitelisted in Meta app settings.
    // Retry without sticker if container creation fails, so the story still posts.
    if (params.listingUrl) {
      containerBody.sticker_data = {
        link_sticker: { link: params.listingUrl },
      }
    }

    let containerData: { id?: string; error?: { message: string } }

    const attempt1 = await fetch(`${GRAPH}/${igUserId()}/media`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(containerBody),
    })
    containerData = await attempt1.json() as typeof containerData

    // If sticker caused the failure, retry without it
    if (containerData.error && containerBody.sticker_data) {
      console.warn('[IG Stories] Sticker failed, retrying without:', containerData.error.message)
      delete containerBody.sticker_data
      const attempt2 = await fetch(`${GRAPH}/${igUserId()}/media`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(containerBody),
      })
      containerData = await attempt2.json() as typeof containerData
    }

    if (containerData.error) {
      console.error('[IG Stories] Container error:', containerData.error.message)
      return { success: false, error: containerData.error.message }
    }

    if (!containerData.id) {
      return { success: false, error: 'Instagram haikurudisha container ID' }
    }

    const containerId = containerData.id
    console.log('[IG Stories] Container created:', containerId)

    // Poll until Meta finishes processing the container (up to 30s)
    let ready = false
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes  = await fetch(
        `${GRAPH}/${containerId}?fields=status_code,status&access_token=${igToken()}`
      )
      const statusData = await statusRes.json() as { status_code?: string; status?: string }
      if (statusData.status_code === 'FINISHED' || statusData.status === 'FINISHED') {
        ready = true
        break
      }
      if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
        return { success: false, error: `Container processing failed: ${statusData.status_code}` }
      }
    }
    if (!ready) console.warn('[IG Stories] Container not FINISHED after 30s — attempting publish anyway')

    // Publish the story
    const publishRes  = await fetch(`${GRAPH}/${igUserId()}/media_publish`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        creation_id:  containerId,
        access_token: igToken(),
      }),
    })
    const publishData = await publishRes.json() as { id?: string; error?: { message: string } }

    if (publishData.error) {
      console.error('[IG Stories] Publish error:', publishData.error.message)
      return { success: false, error: publishData.error.message }
    }

    console.log('[IG Stories] Story published:', publishData.id)
    return { success: true, storyId: publishData.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[IG Stories] Exception:', msg)
    return { success: false, error: msg }
  }
}

// ── Facebook Story ────────────────────────────────────────────────────────────
//
// Facebook Stories require video — photo_stories is not supported on most page types.
// When the listing has no video we convert the Cloudinary story image to a 3-second MP4
// by changing the delivery type from image to video and requesting the .mp4 extension.
// Cloudinary renders the same 9:16 crop + watermark transformations as the image version.

function buildFBStoryVideoUrl(imageUrl: string): string | null {
  const marker = '/image/upload/'
  const idx    = imageUrl.indexOf(marker)
  if (idx === -1) return null

  const base        = imageUrl.slice(0, idx)
  const afterUpload = imageUrl.slice(idx + marker.length)
  const withMp4     = afterUpload.replace(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i, '.mp4$2')

  // du_3 = 3-second duration clip; preserves all existing transforms (9:16 crop, watermark)
  return `${base}/video/upload/du_3/${withMp4}`
}

// Facebook's /{page-id}/video_stories edge does NOT accept a one-shot
// { video: { file_url } } POST like the regular /videos edge does — it uses
// the Resumable Upload protocol with three explicit phases. Confirmed live
// 2026-08-22: the one-shot POST returned "(#100) The parameter upload_phase
// is required."
async function startFBVideoUpload(): Promise<{ videoId: string; uploadUrl: string }> {
  const res  = await fetch(`${GRAPH}/${fbPageId()}/video_stories`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ upload_phase: 'start', access_token: fbToken() }),
  })
  const data = await res.json() as { video_id?: string; upload_url?: string; error?: { message: string } }
  if (data.error) throw new Error(`start: ${data.error.message}`)
  if (!data.video_id || !data.upload_url) throw new Error('start: Facebook haikurudisha video_id/upload_url')
  return { videoId: data.video_id, uploadUrl: data.upload_url }
}

async function transferFBVideoFromUrl(uploadUrl: string, videoUrl: string): Promise<void> {
  const res  = await fetch(uploadUrl, {
    method:  'POST',
    headers: {
      'Authorization': `OAuth ${fbToken()}`,
      'file_url':      videoUrl,
    },
  })
  const data = await res.json().catch(() => ({})) as { success?: boolean; error?: { message: string } }
  if (data.error) throw new Error(`transfer: ${data.error.message}`)
  if (data.success === false) throw new Error('transfer: Facebook video upload haikufaulu')
}

async function finishFBVideoUpload(videoId: string): Promise<string> {
  const res  = await fetch(`${GRAPH}/${fbPageId()}/video_stories`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ upload_phase: 'finish', video_id: videoId, access_token: fbToken() }),
  })
  const data = await res.json() as { success?: boolean; post_id?: string; error?: { message: string } }
  if (data.error) throw new Error(`finish: ${data.error.message}`)
  return data.post_id ?? videoId
}

export async function postFacebookStory(params: {
  imageUrl:  string
  videoUrl?: string
}): Promise<{ success: boolean; storyId?: string; error?: string }> {
  if (!fbPageId() || !fbToken()) {
    return { success: false, error: 'FACEBOOK_PAGE_ID au FACEBOOK_PAGE_ACCESS_TOKEN hazijakonfigurwa' }
  }

  try {
    // Use provided video, or convert the Cloudinary story image → 3-second MP4
    const storyVideoUrl = params.videoUrl ?? buildFBStoryVideoUrl(params.imageUrl)

    if (!storyVideoUrl) {
      return { success: false, error: 'Haiwezi kuunda video ya FB Story — picha sio Cloudinary URL' }
    }

    // Pre-warm Cloudinary video URL so it is cached before Facebook fetches it
    try {
      await fetch(storyVideoUrl, { signal: AbortSignal.timeout(20_000) })
      console.log('[FB Story] Video URL pre-warmed')
    } catch (e) {
      console.warn('[FB Story] Pre-warm failed, attempting anyway:', e)
    }

    console.log('[FB Story] Starting resumable upload...')
    const { videoId, uploadUrl } = await startFBVideoUpload()

    console.log('[FB Story] Transferring video from URL...')
    await transferFBVideoFromUrl(uploadUrl, storyVideoUrl)

    console.log('[FB Story] Finishing upload / publishing...')
    const postId = await finishFBVideoUpload(videoId)

    console.log('[FB Story] Video story posted:', postId)
    return { success: true, storyId: postId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[FB Story] Exception:', msg)
    return { success: false, error: msg }
  }
}

// ── TikTok "Story" (posted as regular video — TikTok has no Story API) ──────

export async function postTikTokStory(params: {
  videoUrl:   string
  listingId?: string
  caption?:   string
}): Promise<{ success: boolean; storyId?: string; error?: string }> {
  try {
    const { postVideoToTikTok } = await import('./tiktok')
    const caption = params.caption ?? '🏠 Nyumba mpya inapatikana! nyumbafasta.co #NyumbaFasta #Tanzania #fyp'
    const result  = await postVideoToTikTok({
      videoUrl:  params.videoUrl,
      caption,
      listingId: params.listingId,
    })
    return { success: result.success, storyId: result.publishId, error: result.error }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[TikTok Story] Exception:', msg)
    return { success: false, error: msg }
  }
}

// ── Post to ALL 3 platforms in parallel ──────────────────────────────────────

export type StoryPlatformResult = {
  platform: 'instagram' | 'facebook' | 'tiktok'
  success:  boolean
  storyId?: string
  error?:   string
}

export async function postAllPlatformStories(params: {
  imageUrl:   string       // used by IG + FB
  videoUrl?:  string       // used by TikTok (and FB video story if present)
  listingId?: string
  listingUrl?: string
  caption?:   string
}): Promise<{ results: StoryPlatformResult[]; successCount: number; failedCount: number }> {
  const tasks: Promise<StoryPlatformResult>[] = [
    // Instagram Story
    postInstagramStory({ imageUrl: params.imageUrl, listingUrl: params.listingUrl })
      .then(r => ({ platform: 'instagram' as const, ...r })),

    // Facebook Story
    postFacebookStory({ imageUrl: params.imageUrl, videoUrl: params.videoUrl })
      .then(r => ({ platform: 'facebook' as const, ...r })),
  ]

  // TikTok Story only if video is available (TikTok is video-only platform)
  if (params.videoUrl) {
    tasks.push(
      postTikTokStory({ videoUrl: params.videoUrl, listingId: params.listingId, caption: params.caption })
        .then(r => ({ platform: 'tiktok' as const, ...r })),
    )
  }

  const results = await Promise.all(tasks)
  return {
    results,
    successCount: results.filter(r => r.success).length,
    failedCount:  results.filter(r => !r.success).length,
  }
}

// ── Post listing as story ─────────────────────────────────────────────────────

export async function postListingStory(
  listing: Listing,
): Promise<{ success: boolean; storyId?: string; error?: string }> {
  const rawImageUrl = listing.images?.[0]
  if (!rawImageUrl) {
    return { success: false, error: 'Listing haina picha' }
  }

  const storyImageUrl = buildStoryImageUrl(rawImageUrl)
  const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
  const listingUrl    = `${appUrl}/listings/${listing.id}`

  const result = await postInstagramStory({ imageUrl: storyImageUrl, listingUrl })

  // Always record the attempt
  try {
    await supabaseAdmin.from('instagram_stories').insert({
      listing_id:    listing.id,
      story_type:    'listing',
      media_url:     storyImageUrl,
      story_id:      result.storyId ?? null,
      status:        result.success ? 'posted' : 'failed',
      error_message: result.error ?? null,
      expires_at:    result.success
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
      posted_at:     result.success ? new Date().toISOString() : null,
    })
  } catch (dbErr) {
    console.error('[IG Stories] DB save failed:', dbErr)
  }

  return result
}

// ── Post promotional story (custom image) ─────────────────────────────────────

export async function postPromoStory(params: {
  imageUrl: string
  linkUrl?: string
}): Promise<{ success: boolean; storyId?: string; error?: string }> {
  const result = await postInstagramStory({
    imageUrl:    params.imageUrl,
    listingUrl:  params.linkUrl,
  })

  try {
    await supabaseAdmin.from('instagram_stories').insert({
      listing_id:    null,
      story_type:    'promotion',
      media_url:     params.imageUrl,
      story_id:      result.storyId ?? null,
      status:        result.success ? 'posted' : 'failed',
      error_message: result.error ?? null,
      expires_at:    result.success
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
      posted_at:     result.success ? new Date().toISOString() : null,
    })
  } catch (dbErr) {
    console.error('[IG Stories] DB save failed:', dbErr)
  }

  return result
}

// ── Post listing story to ALL 3 platforms ────────────────────────────────────

export async function postListingStoryAllPlatforms(
  listing: Listing,
): Promise<{ results: StoryPlatformResult[]; successCount: number; failedCount: number }> {
  const rawImageUrl = listing.images?.[0]
  if (!rawImageUrl) {
    return {
      results:      [{ platform: 'instagram', success: false, error: 'Listing haina picha' }],
      successCount: 0,
      failedCount:  1,
    }
  }

  const storyImageUrl = buildStoryImageUrl(rawImageUrl)
  const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
  const listingUrl    = `${appUrl}/listings/${listing.id}`
  // Watermark real listing videos before they go to FB Story / TikTok — every
  // other outbound video path (Reels, Feed) watermarks first; this one didn't.
  const rawVideoUrl   = listing.video_url ?? undefined
  const videoUrl      = rawVideoUrl ? (watermarkVideo(rawVideoUrl) ?? rawVideoUrl) : undefined

  // Pre-warm Cloudinary lazy transformation so Meta can fetch the image immediately
  try {
    await fetch(storyImageUrl, { signal: AbortSignal.timeout(25_000) })
    console.log('[IG Stories] Cloudinary URL pre-warmed')
  } catch (e) {
    console.warn('[IG Stories] Pre-warm failed, attempting anyway:', e)
  }

  const { results, successCount, failedCount } = await postAllPlatformStories({
    imageUrl:   storyImageUrl,
    videoUrl,
    listingId:  listing.id,
    listingUrl,
  })

  // Record every attempt in DB (one row per platform)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await Promise.allSettled(
    results.map(r =>
      supabaseAdmin.from('instagram_stories').insert({
        listing_id:    listing.id,
        story_type:    'listing',
        media_url:     storyImageUrl,
        story_id:      r.storyId ?? null,
        status:        r.success ? 'posted' : 'failed',
        error_message: r.error  ?? null,
        expires_at:    r.success ? expiresAt : null,
        posted_at:     r.success ? new Date().toISOString() : null,
      })
    )
  )

  console.log(`[Stories] All platforms: ${successCount}/${results.length} ✅`)
  return { results, successCount, failedCount }
}

// ── Get story history ─────────────────────────────────────────────────────────

export async function getRecentStories(limit = 20) {
  const { data } = await supabaseAdmin
    .from('instagram_stories')
    .select('*, listings(title, district, region, images)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
