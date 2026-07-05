import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { generateCaption } from './captionGenerator'
import {
  createIGImageContainer,
  createIGVideoContainer,
  waitForIGContainer,
  publishIGContainer,
  postToFacebook,
  uploadFacebookVideoUrl,
} from './metaClient'
import { watermarkImage } from '@/lib/media/watermark'
import { watermarkVideo } from '@/lib/media/videoWatermark'
import type { Listing } from '@/lib/types/database'

type Platform = 'instagram' | 'facebook' | 'both'

export type PostResult = {
  postId:          string
  platform:        Platform
  instagramPostId?:  string
  facebookPostId?:   string
  caption:         string
  status:          'published' | 'failed'
  error?:          string
  groupsPosted?:   number
  storyPosted?:    boolean
  carouselPosted?: boolean
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function postListingToSocialMedia(
  listingId:     string,
  platform:      Platform = 'both',
  createdBy?:    string,
  options?: {
    postToGroups?:   boolean
    postToStories?:  boolean
    postToCarousel?: boolean
    imageOverride?:  string   // use this image URL instead of listing.images[0]
    videoOverride?:  string   // use this video URL (e.g. client-side mixed with music)
    captionOverride?: string  // use this caption instead of AI-generated
  },
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

  // Dedup guard — per-platform check so IG and FB are independent
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const skipPlatforms = new Set<string>()
  const platformsToCheck = platform === 'both' ? ['instagram', 'facebook'] : [platform]
  for (const p of platformsToCheck) {
    const { data: recent } = await supabaseAdmin
      .from('social_posts')
      .select('id')
      .eq('listing_id', listingId)
      .in('platform', [p, 'both'])
      .eq('status', 'published')
      .gte('published_at', since24h)
      .limit(1)
      .maybeSingle()
    if (recent) {
      if (platform !== 'both') {
        throw new Error(`[Dedup] ${p} tayari ilichapishwa saa 24 zilizopita`)
      }
      skipPlatforms.add(p)
      console.log(`[Dedup] Will skip ${p} — posted within 24h`)
    }
  }
  // If 'both' platforms are already posted, bail early
  if (platform === 'both' && skipPlatforms.size === 2) {
    throw new Error(`[Dedup] Instagram na Facebook zote tayari zimechapishwa saa 24 zilizopita`)
  }

  const l = listing as Listing

  // Resolve dalali's microsite URL for embedding in captions
  const { data: dalaliUser } = await supabaseAdmin
    .from('users')
    .select('username')
    .eq('id', l.dalali_id)
    .maybeSingle()
  const micrositeUrl = dalaliUser?.username
    ? `https://nyumbafasta.co/agent/${dalaliUser.username}`
    : `https://nyumbafasta.co/listings/${l.id}`

  // Generate caption (or use override)
  const primaryPlatform = platform === 'both' ? 'instagram' : platform
  let caption: string
  let hashtags: string
  if (options?.captionOverride) {
    caption  = options.captionOverride
    hashtags = ''
  } else {
    ;({ caption, hashtags } = await generateCaption(l, primaryPlatform, { micrositeUrl }))
  }
  const fullCaption = hashtags ? `${caption}\n\n${hashtags}` : caption

  // Choose best media (honour editor overrides)
  const rawImageUrl = options?.imageOverride ?? l.images?.[0] ?? null
  const rawVideoUrl = options?.videoOverride ?? l.video_url ?? null

  // Apply watermarks — best-effort. If watermark fails, continue with the original URL.
  let imageUrl = rawImageUrl
  let videoUrl = rawVideoUrl

  if (rawImageUrl) {
    imageUrl = await watermarkImage(rawImageUrl)
    if (imageUrl === rawImageUrl) {
      console.warn('[Watermark] Picha haijawekwa alama — inatumia picha ya asili')
    }
  }

  if (rawVideoUrl) {
    videoUrl = watermarkVideo(rawVideoUrl)
    if (videoUrl === rawVideoUrl) {
      console.warn('[Watermark] Video haijawekwa alama — inatumia video ya asili')
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
  if ((platform === 'instagram' || platform === 'both') && !skipPlatforms.has('instagram')) {
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
  if ((platform === 'facebook' || platform === 'both') && !skipPlatforms.has('facebook')) {
    try {
      if (!process.env.FACEBOOK_PAGE_ID || (!process.env.FACEBOOK_PAGE_ACCESS_TOKEN && !process.env.FACEBOOK_ACCESS_TOKEN)) {
        throw new Error('FACEBOOK_PAGE_ID au FACEBOOK_PAGE_ACCESS_TOKEN hazijakonfigurwa')
      }

      // Use override if provided; otherwise generate FB-specific caption (can be longer)
      let fbFullCaption: string
      if (options?.captionOverride) {
        fbFullCaption = options.captionOverride
      } else {
        const { caption: fbCaption, hashtags: fbHashtags } = await generateCaption(l, 'facebook', { micrositeUrl })
        fbFullCaption = `${fbCaption}\n\n${fbHashtags}`
      }

      if (videoUrl) {
        // Post video (Reel) to Facebook when video is available
        fbPostId = await uploadFacebookVideoUrl(videoUrl, fbFullCaption, l.title ?? undefined)
      } else {
        fbPostId = await postToFacebook(fbFullCaption, imageUrl ?? undefined)
      }
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

  // Mark listing as having been promoted
  if (published) {
    await supabaseAdmin
      .from('listings')
      .update({ share_count: (l.share_count ?? 0) + 1 })
      .eq('id', listingId)
  }

  // ── Facebook Groups (optional, non-blocking) ───────────────────────────────
  let groupsPosted = 0
  if (options?.postToGroups && imageUrl) {
    try {
      const { postToAllGroups } = await import('./facebookGroups')
      const groupResults = await postToAllGroups(l, imageUrl)
      groupsPosted = groupResults.filter(r => r.success).length
      console.log(`[AutoPost] Groups: ${groupsPosted}/${groupResults.length} posted`)
    } catch (err) {
      console.error('[AutoPost] Groups posting error (non-fatal):', err)
    }
  }

  // ── Story — all platforms (IG + FB + TikTok if video) ───────────────────────
  let storyPosted = false
  if (options?.postToStories) {
    try {
      const { postListingStoryAllPlatforms } = await import('./instagramStories')
      const storyResult = await postListingStoryAllPlatforms(l)
      storyPosted = storyResult.successCount > 0
      console.log(`[AutoPost] Story: ${storyResult.successCount}/${storyResult.results.length} platforms ✅`)
    } catch (err) {
      console.error('[AutoPost] Story posting error (non-fatal):', err)
    }
  }

  // ── Instagram Carousel (optional, non-blocking) ───────────────────────────
  let carouselPosted = false
  if (options?.postToCarousel && (l.images?.length ?? 0) >= 2) {
    try {
      const { postListingCarousel } = await import('./carouselPost')
      const carouselResult = await postListingCarousel(l)
      carouselPosted = carouselResult.success
      console.log(`[AutoPost] Carousel: ${carouselPosted ? '✅' : '❌'}`, carouselResult.error ?? '')
    } catch (err) {
      console.error('[AutoPost] Carousel posting error (non-fatal):', err)
    }
  }

  return {
    postId,
    platform,
    instagramPostId: igPostId ?? undefined,
    facebookPostId:  fbPostId ?? undefined,
    caption,
    status:          published ? 'published' : 'failed',
    error:           lastError ?? undefined,
    groupsPosted,
    storyPosted,
    carouselPosted,
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
