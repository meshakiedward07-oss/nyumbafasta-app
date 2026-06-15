import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { isCloudinaryUrl } from '@/lib/media/watermark'
import type { Listing } from '@/lib/types/database'

const GRAPH      = 'https://graph.facebook.com/v18.0'
const igToken    = () => process.env.INSTAGRAM_ACCESS_TOKEN ?? ''
const igUserId   = () => process.env.INSTAGRAM_USER_ID      ?? ''

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

  // Crop to 9:16, then add watermark at bottom-center
  const transforms = [
    'ar_9:16,c_fill,g_auto,w_1080',
    [
      'l_text:Arial_32_bold:NyumbaFasta%20%E2%80%A2%20nyumbafasta.co',
      'co_white',
      'b_rgb:000000B3',
      'g_south',
      'y_60',
      'pa_12',
      'r_20',
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

    // Link sticker — requires pages_read_engagement permission on the account
    if (params.listingUrl) {
      containerBody.sticker_data = {
        link_sticker: {
          link:         params.listingUrl,
          display_text: 'Angalia Nyumba',
        },
      }
    }

    const containerRes  = await fetch(`${GRAPH}/${igUserId()}/media`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(containerBody),
    })
    const containerData = await containerRes.json() as { id?: string; error?: { message: string } }

    if (containerData.error) {
      console.error('[IG Stories] Container error:', containerData.error.message)
      return { success: false, error: containerData.error.message }
    }

    const containerId = containerData.id!
    console.log('[IG Stories] Container created:', containerId)

    // Wait for Meta to process the image
    await new Promise(r => setTimeout(r, 4000))

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

// ── Post listing as story ─────────────────────────────────────────────────────

export async function postListingStory(
  listing: Listing,
): Promise<{ success: boolean; storyId?: string; error?: string }> {
  const rawImageUrl = listing.images?.[0]
  if (!rawImageUrl) {
    return { success: false, error: 'Listing haina picha' }
  }

  const storyImageUrl = buildStoryImageUrl(rawImageUrl)
  const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
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

// ── Get story history ─────────────────────────────────────────────────────────

export async function getRecentStories(limit = 20) {
  const { data } = await supabaseAdmin
    .from('instagram_stories')
    .select('*, listings(title, district, region, images)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
