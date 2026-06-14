/**
 * Video watermarking via Cloudinary URL transformation.
 *
 * All videos in this project are uploaded to Cloudinary (cloud: daw8jlbbd,
 * preset: nyumba_listings, folder: nyumba/social-videos).
 *
 * Strategy: insert an overlay transformation segment into the Cloudinary URL.
 * Cloudinary renders the watermarked video on-the-fly and caches it at their CDN.
 * Zero FFmpeg, zero re-encoding, zero extra cost on the free tier.
 *
 * Position: bottom-center for videos (more visible for vertical Reels).
 *
 * Example:
 *  In:  https://res.cloudinary.com/daw8jlbbd/video/upload/v123/nyumba/social-videos/abc.mp4
 *  Out: https://res.cloudinary.com/daw8jlbbd/video/upload/{overlay}/v123/nyumba/social-videos/abc.mp4
 */

const WM_TEXT = 'NyumbaFasta%20%E2%80%A2%20nyumbafasta.co'
//  Decoded: "NyumbaFasta • nyumbafasta.co"
//  Cloudinary URL-encodes text in l_text layers — space → %20, • → %E2%80%A2

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'daw8jlbbd'

// ─── Cloudinary video overlay ─────────────────────────────────────────────────

function buildVideoOverlay(): string {
  return [
    `l_text:Arial_38_bold:${WM_TEXT}`,
    'co_white',
    'b_rgb:000000B3',   // semi-transparent black background (~70% opacity)
    'g_south',          // bottom-center (best for vertical Reels)
    'y_50',             // 50px from bottom
    'pa_12',            // 12px padding
    'r_20',             // 20px border radius
  ].join(',')
}

/**
 * Returns true when the URL is a Cloudinary video URL.
 */
export function isCloudinaryVideoUrl(url: string): boolean {
  return url.includes('res.cloudinary.com') && url.includes('/video/upload/')
}

/**
 * Insert a watermark overlay into a Cloudinary video URL.
 * Returns the original URL unchanged if it doesn't match the expected format.
 */
export function addCloudinaryVideoWatermark(videoUrl: string): string {
  if (!videoUrl) return videoUrl

  const marker = '/video/upload/'
  const idx    = videoUrl.indexOf(marker)
  if (idx === -1) return videoUrl

  const base    = videoUrl.slice(0, idx + marker.length)
  const rest    = videoUrl.slice(idx + marker.length)
  const overlay = buildVideoOverlay()

  const watermarked = `${base}${overlay}/${rest}`
  console.log(`[Watermark] Cloudinary video watermark applied`)
  return watermarked
}

/**
 * Construct a Cloudinary watermarked URL from a public_id
 * (for use when we only have the public_id, not the full URL).
 */
export function buildCloudinaryWatermarkedUrl(
  publicId: string,
  format: 'mp4' | 'webm' = 'mp4',
): string {
  const overlay = buildVideoOverlay()
  return `https://res.cloudinary.com/${CLOUD}/video/upload/${overlay}/${publicId}.${format}`
}

/**
 * Extract the Cloudinary public_id from a full Cloudinary URL.
 *
 * Input:  https://res.cloudinary.com/cloud/video/upload/v123/nyumba/social-videos/abc.mp4
 * Output: nyumba/social-videos/abc
 */
export function extractCloudinaryPublicId(url: string): string | null {
  // Match everything after /upload/ (skipping optional transformation + version segments)
  // Version looks like v{digits}, transformations have letters like "l_" or "f_"
  const match = url.match(/\/upload\/(?:[^/]+\/)*?(v\d+\/)?(.+?)(?:\.\w+)?$/)
  if (!match) return null
  const withVersion = match[2]
  // If the path starts with v{digits}/, strip it
  return withVersion.replace(/^v\d+\//, '')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add NyumbaFasta watermark to a video URL.
 *
 * Currently supports Cloudinary-hosted videos (which covers all videos in this project).
 * For non-Cloudinary video URLs, logs a warning and returns original.
 *
 * Never throws.
 */
export function watermarkVideo(videoUrl: string): string {
  if (!videoUrl) return videoUrl

  try {
    if (isCloudinaryVideoUrl(videoUrl)) {
      return addCloudinaryVideoWatermark(videoUrl)
    }

    // Non-Cloudinary video — cannot watermark without FFmpeg
    // Return original and log warning rather than blocking the post
    console.warn(
      '[Watermark] Non-Cloudinary video URL — watermark skipped. Upload via VideoUploadTab to enable watermarking.',
      videoUrl.slice(0, 80),
    )
    return videoUrl
  } catch (err) {
    console.error('[Watermark] Video watermark failed, using original:', err)
    return videoUrl
  }
}
