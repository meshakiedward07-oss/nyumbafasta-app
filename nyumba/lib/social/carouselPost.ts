import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { watermarkImages } from '@/lib/media/watermark'
import { generateCaption } from './captionGenerator'
import {
  createIGCarouselItemContainer,
  createIGCarouselContainer,
  waitForIGContainer,
  publishIGContainer,
} from './metaClient'
import type { Listing } from '@/lib/types/database'

export type CarouselResult = {
  success:      boolean
  postId?:      string
  slidesCount?: number
  error?:       string
}

// ── Post Instagram Carousel ───────────────────────────────────────────────

export async function postInstagramCarousel(params: {
  imageUrls: string[]
  caption:   string
}): Promise<CarouselResult> {
  const images = params.imageUrls.slice(0, 10)

  if (images.length < 2) {
    return { success: false, error: 'Carousel inahitaji picha angalau 2' }
  }

  console.log('[Carousel] Starting —', images.length, 'slides')
  const containerIds: string[] = []

  for (let i = 0; i < images.length; i++) {
    // Pre-validate URL reachability — IG rejects non-200 URLs with a confusing error
    try {
      const head = await fetch(images[i], { method: 'HEAD', signal: AbortSignal.timeout(8_000) })
      if (!head.ok) {
        console.warn(`[Carousel] Item ${i + 1} URL returned ${head.status} — skipping`)
        continue
      }
    } catch {
      console.warn(`[Carousel] Item ${i + 1} URL unreachable — skipping`)
      continue
    }

    try {
      console.log('[Carousel] Creating item', i + 1, 'of', images.length)
      const id = await createIGCarouselItemContainer(images[i])
      containerIds.push(id)
      console.log('[Carousel] Item', i + 1, 'container:', id)
    } catch (err) {
      console.error('[Carousel] Item', i + 1, 'failed:', err instanceof Error ? err.message : err)
    }

    if (i < images.length - 1) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  if (containerIds.length < 2) {
    return {
      success: false,
      error:   `Picha za kutosha hazikufanikiwa kupakiwa (${containerIds.length}/${images.length})`,
    }
  }

  console.log('[Carousel] Creating carousel container with', containerIds.length, 'items')
  const carouselId = await createIGCarouselContainer(containerIds, params.caption)
  console.log('[Carousel] Container created:', carouselId)

  console.log('[Carousel] Waiting for processing...')
  await waitForIGContainer(carouselId, 60_000)

  console.log('[Carousel] Publishing...')
  const postId = await publishIGContainer(carouselId)
  console.log('[Carousel] Published:', postId)

  return { success: true, postId, slidesCount: containerIds.length }
}

// ── Post Listing as Carousel ──────────────────────────────────────────────

export async function postListingCarousel(listing: Listing): Promise<CarouselResult> {
  const images = listing.images ?? []

  if (images.length < 2) {
    const err = 'Listing haina picha za kutosha kwa carousel (inahitaji 2+)'
    console.error('[Carousel]', err)
    await supabaseAdmin.from('carousel_posts').insert({
      listing_id:    listing.id,
      status:        'failed',
      error_message: err,
      slides_count:  images.length,
    })
    return { success: false, error: err }
  }

  console.log('[Carousel] Processing', images.length, 'images for listing', listing.id)

  // Resolve dalali microsite URL for caption
  const { data: dalaliUser } = await supabaseAdmin
    .from('users')
    .select('username')
    .eq('id', listing.dalali_id)
    .maybeSingle()
  const micrositeUrl = dalaliUser?.username
    ? `https://nyumbafasta.co/agent/${dalaliUser.username}`
    : `https://nyumbafasta.co/listings/${listing.id}`

  // Watermark every slide — best-effort. watermarkImage returns original URL on failure.
  const rawSlides   = images.slice(0, 10)
  const watermarked = await watermarkImages(rawSlides, 'bottom-right')
  const unwatermarked = watermarked.filter((url, i) => url === rawSlides[i]).length
  if (unwatermarked > 0) {
    console.warn(`[Carousel] ${unwatermarked} picha hazikuwekwa alama — inatumia picha za asili`)
  }

  const slideUrls = watermarked

  // Generate caption via existing captionGenerator, add carousel-specific opener
  const { caption, hashtags } = await generateCaption(listing, 'instagram', { micrositeUrl })
  const carouselCaption = `Swipe kuona picha zote ➡️\n\n${caption}\n\n${hashtags}`

  let result: CarouselResult
  try {
    result = await postInstagramCarousel({
      imageUrls: slideUrls,
      caption:   carouselCaption,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Carousel] postInstagramCarousel exception:', msg)
    result = { success: false, error: msg }
  }

  await supabaseAdmin.from('carousel_posts').insert({
    listing_id:    listing.id,
    post_id:       result.postId ?? null,
    media_urls:    slideUrls,
    caption:       carouselCaption,
    slides_count:  result.slidesCount ?? slideUrls.length,
    status:        result.success ? 'posted' : 'failed',
    error_message: result.error ?? null,
    posted_at:     result.success ? new Date().toISOString() : null,
  })

  return result
}

// ── Fetch carousel history ────────────────────────────────────────────────

export async function getRecentCarousels(limit = 20) {
  const { data } = await supabaseAdmin
    .from('carousel_posts')
    .select('*, listings(id, title, district, region)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
