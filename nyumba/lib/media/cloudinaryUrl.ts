/**
 * Cloudinary URL optimization utilities.
 *
 * Injects format and quality transformation segments into Cloudinary URLs so
 * that the CDN serves WebP/AVIF automatically based on the browser's Accept
 * header — no re-encoding on our servers, no extra round-trips.
 *
 * Cloudinary processes transformations left-to-right, so we inject our quality
 * segment just before the public_id (after any existing overlay segments like
 * watermarks). This means watermarks are composited first, then the whole
 * image is output in the optimal format.
 *
 * All functions are idempotent: calling twice returns the same URL.
 */

const IMAGE_MARKER = '/image/upload/'
const VIDEO_MARKER = '/video/upload/'

/**
 * Find the boundary between optional leading transformations and the
 * version/public-id segment of a Cloudinary URL path.
 *
 * e.g. "l_text:../fl_layer_apply/v1234/folder/file.jpg"
 *       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ = transforms
 *                                      ^^^^^^^^^^^^^^^^^ = publicPart
 */
function splitAtPublicId(rest: string): { transforms: string; publicPart: string } {
  // Version segment looks like v{5+ digits}/ at the start of the public_id
  const vMatch = rest.match(/^(.*?)(v\d{5,}\/.+)$/)
  if (vMatch) {
    return { transforms: vMatch[1], publicPart: vMatch[2] }
  }
  // No version segment — treat the whole thing as the public_id
  return { transforms: '', publicPart: rest }
}

/**
 * Add `f_auto,q_auto:eco,w_{maxWidth},c_limit` to a Cloudinary image URL.
 *
 * - maxWidth defaults to 1920 (property listing photos).
 * - Use `avatarMode: true` for profile pictures (400×400 face-aware fill).
 * - Returns the original URL unchanged for non-Cloudinary URLs.
 */
export function optimizeCloudinaryImageUrl(
  url: string,
  opts?: { maxWidth?: number; avatarMode?: boolean },
): string {
  if (!url || !url.includes('res.cloudinary.com')) return url

  const idx = url.indexOf(IMAGE_MARKER)
  if (idx === -1) return url

  const base = url.slice(0, idx + IMAGE_MARKER.length)
  const rest = url.slice(idx + IMAGE_MARKER.length)

  // Idempotent — already optimized
  if (rest.includes('f_auto') || rest.includes('q_auto')) return url

  const { transforms, publicPart } = splitAtPublicId(rest)

  const t = opts?.avatarMode
    ? 'f_auto,q_auto:good,w_400,h_400,c_fill,g_face'
    : `f_auto,q_auto:eco,w_${opts?.maxWidth ?? 1920},c_limit`

  return `${base}${transforms}${t}/${publicPart}`
}

/**
 * Add `f_auto,q_auto,vc_auto` to a Cloudinary video URL.
 *
 * `vc_auto` lets Cloudinary pick the most efficient codec (VP9/H.265/AV1)
 * for browsers that support it, while falling back to H.264 for others.
 *
 * Skips URLs that already have format/quality/watermark transforms applied.
 */
export function optimizeCloudinaryVideoUrl(url: string): string {
  if (!url || !url.includes('res.cloudinary.com')) return url

  const idx = url.indexOf(VIDEO_MARKER)
  if (idx === -1) return url

  const base = url.slice(0, idx + VIDEO_MARKER.length)
  const rest = url.slice(idx + VIDEO_MARKER.length)

  // Idempotent — already optimized or has complex overlay
  if (rest.includes('f_auto') || rest.includes('q_auto') || rest.includes('vc_auto')) return url

  // Social video watermarks use l_text — let those be; they are already processed
  // by the social pipeline and we don't want to re-inject
  if (rest.includes('l_text')) return url

  const { transforms, publicPart } = splitAtPublicId(rest)
  return `${base}${transforms}f_auto,q_auto,vc_auto/${publicPart}`
}

/**
 * Convenience — pick the right optimizer based on whether the URL is
 * an image or video URL.
 */
export function optimizeCloudinaryUrl(url: string): string {
  if (!url) return url
  if (url.includes(IMAGE_MARKER)) return optimizeCloudinaryImageUrl(url)
  if (url.includes(VIDEO_MARKER)) return optimizeCloudinaryVideoUrl(url)
  return url
}
