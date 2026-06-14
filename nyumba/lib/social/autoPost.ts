import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { generateCaption } from './captionGenerator'
import {
  createIGImageContainer,
  createIGVideoContainer,
  waitForIGContainer,
  publishIGContainer,
  postToFacebook,
} from './metaClient'
import { watermarkImage } from '@/lib/media/watermark'
import { watermarkVideo } from '@/lib/media/videoWatermark'
import type { Listing } from '@/lib/types/database'

type Platform = 'instagram' | 'facebook' | 'both'

export type PostResult = {
  postId:         string
  platform:       Platform
  instagramPostId?: string
  facebookPostId?:  string
  caption:        string
  status:         'published' | 'failed'
  error?:         string
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function postListingToSocialMedia(
  listingId:  string,
  platform:   Platform = 'both',
  createdBy?: string,
): Promise<PostResult> {
  // Fetch listing with all fields
  const { data: listing, error } = await supabaseAdmin
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error || !listing) {
    throw new Error(`Listing haipatikani: ${listingId}`)
  }

  const l = listing as Listing

  // Generate caption for the primary platform
  const primaryPlatform = platform === 'both' ? 'instagram' : platform
  const { caption, hashtags } = await generateCaption(l, primaryPlatform)
  const fullCaption = `${caption}\n\n${hashtags}`

  // Choose best media
  const rawImageUrl = l.images?.[0] ?? null
  const rawVideoUrl = l.video_url ?? null

  // Apply watermarks — mandatory before any post. Fail if watermark cannot be applied.
  let imageUrl = rawImageUrl
  let videoUrl = rawVideoUrl

  if (rawImageUrl) {
    imageUrl = await watermarkImage(rawImageUrl)
    if (imageUrl === rawImageUrl) {
      throw new Error('[Watermark] Watermark ya picha haikuweza kutumika — kuchapisha kumesimamishwa')
    }
  }

  if (rawVideoUrl) {
    videoUrl = watermarkVideo(rawVideoUrl)
    if (videoUrl === rawVideoUrl) {
      throw new Error('[Watermark] Watermark ya video haikuweza kutumika — kuchapisha kumesimamishwa')
    }
  }

  // Create DB record
  const mediaType = videoUrl ? 'video' : 'image'
  const { data: postRecord, error: insertErr } = await supabaseAdmin
    .from('social_posts')
    .insert({
      listing_id:  listingId,
      platform,
      media_type:  mediaType,
      caption:     caption,
      hashtags:    hashtags,
      status:      'publishing',
      created_by:  createdBy ?? null,
    })
    .select()
    .single()

  if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`)

  const postId = postRecord.id as string
  let igPostId: string | null = null
  let fbPostId: string | null = null
  let lastError: string | null = null

  // ── Instagram ─────────────────────────────────────────────────────────────
  if (platform === 'instagram' || platform === 'both') {
    try {
      if (!process.env.INSTAGRAM_USER_ID || !process.env.INSTAGRAM_ACCESS_TOKEN) {
        throw new Error('INSTAGRAM_USER_ID au INSTAGRAM_ACCESS_TOKEN hazijakonfigurwa')
      }

      let containerId: string

      if (videoUrl) {
        containerId = await createIGVideoContainer(videoUrl, fullCaption)
        await waitForIGContainer(containerId)
      } else if (imageUrl) {
        containerId = await createIGImageContainer(imageUrl, fullCaption)
      } else {
        throw new Error('Listing haina picha au video — haiwezi kupoatstwa kwenye Instagram')
      }

      await supabaseAdmin
        .from('social_posts')
        .update({ instagram_container_id: containerId })
        .eq('id', postId)

      igPostId = await publishIGContainer(containerId)
      console.log(`[Social] IG published: ${igPostId}`)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error('[Social] IG post failed:', lastError)
    }
  }

  // ── Facebook ──────────────────────────────────────────────────────────────
  if (platform === 'facebook' || platform === 'both') {
    try {
      if (!process.env.FACEBOOK_PAGE_ID || (!process.env.FACEBOOK_PAGE_ACCESS_TOKEN && !process.env.FACEBOOK_ACCESS_TOKEN)) {
        throw new Error('FACEBOOK_PAGE_ID au FACEBOOK_PAGE_ACCESS_TOKEN hazijakonfigurwa')
      }

      // Generate slightly different caption for FB (allow longer)
      const { caption: fbCaption, hashtags: fbHashtags } = await generateCaption(l, 'facebook')
      const fbFullCaption = `${fbCaption}\n\n${fbHashtags}`

      fbPostId = await postToFacebook(fbFullCaption, imageUrl ?? undefined)
      console.log(`[Social] FB published: ${fbPostId}`)
    } catch (err) {
      const e = err instanceof Error ? err.message : String(err)
      lastError = lastError ? `${lastError} | FB: ${e}` : e
      console.error('[Social] FB post failed:', e)
    }
  }

  // ── Update DB record ──────────────────────────────────────────────────────
  const published = !!(igPostId || fbPostId)
  await supabaseAdmin
    .from('social_posts')
    .update({
      instagram_post_id: igPostId,
      facebook_post_id:  fbPostId,
      status:            published ? 'published' : 'failed',
      error_message:     published ? null : lastError,
      published_at:      published ? new Date().toISOString() : null,
    })
    .eq('id', postId)

  // Mark listing as having been promoted (update view count as proxy signal)
  if (published) {
    await supabaseAdmin
      .from('listings')
      .update({ share_count: (l.share_count ?? 0) + 1 })
      .eq('id', listingId)
  }

  return {
    postId,
    platform,
    instagramPostId: igPostId ?? undefined,
    facebookPostId:  fbPostId ?? undefined,
    caption,
    status:  published ? 'published' : 'failed',
    error:   lastError ?? undefined,
  }
}

// ── Schedule a post in the queue ────────────────────────────────────────────

export async function schedulePost(
  listingId:   string,
  platform:    Platform,
  scheduledAt: Date,
  createdBy?:  string,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('post_schedule')
    .insert({
      listing_id:   listingId,
      platform,
      scheduled_at: scheduledAt.toISOString(),
      status:       'pending',
      created_by:   createdBy ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id as string
}

// ── Process due scheduled posts (called by cron) ───────────────────────────

export async function processDueScheduledPosts(): Promise<void> {
  const { data: due } = await supabaseAdmin
    .from('post_schedule')
    .select('id, listing_id, platform, created_by')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(5)

  for (const item of due ?? []) {
    try {
      const result = await postListingToSocialMedia(
        item.listing_id,
        item.platform as Platform,
        item.created_by ?? undefined,
      )

      await supabaseAdmin
        .from('post_schedule')
        .update({ status: result.status === 'published' ? 'posted' : 'failed', post_id: result.postId })
        .eq('id', item.id)

      // Rate limit between scheduled posts
      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.error('[Social] Scheduled post failed:', item.id, err)
      await supabaseAdmin
        .from('post_schedule')
        .update({ status: 'failed' })
        .eq('id', item.id)
    }
  }
}
