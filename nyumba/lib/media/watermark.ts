/**
 * Image watermarking via Sharp (server-side, Vercel-compatible).
 *
 * Strategy:
 *  - Cloudinary URLs  → insert overlay transformation segment into the URL
 *                       (zero processing, rendered by Cloudinary CDN on demand)
 *  - All other URLs   → fetch → sharp composite SVG pill → re-upload to Supabase
 */

import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// ─── Watermark text ───────────────────────────────────────────────────────────
const WM_TEXT    = 'nyumbafasta.co'
const WM_SUBTEXT = 'NyumbaFasta'

// ─── Cloudinary URL transformation ───────────────────────────────────────────

/**
 * Returns true when the URL is hosted on Cloudinary.
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com')
}

/**
 * Insert a watermark overlay segment into a Cloudinary image URL.
 *
 * Input:  https://res.cloudinary.com/{cloud}/image/upload/{version}/{path}.jpg
 * Output: https://res.cloudinary.com/{cloud}/image/upload/{transformation}/{version}/{path}.jpg
 *
 * Position: bottom-right for images.
 */
export function addCloudinaryImageWatermark(imageUrl: string): string {
  // Match the upload/ boundary — transformations go immediately after it
  const marker = '/image/upload/'
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return imageUrl

  const base = imageUrl.slice(0, idx + marker.length)
  const rest = imageUrl.slice(idx + marker.length)

  // Cloudinary overlay: white text on semi-transparent dark rounded pill, bottom-right
  // bo_ = transparent border used as padding; r_ = corner radius on the background
  const overlay = [
    `l_text:Arial_26_bold:${encodeURIComponent(WM_TEXT)}`,
    'co_white',
    'b_rgb:000000BF',
    'bo_10px_solid_rgb:00000000',
    'r_max',
    'g_south_east',
    'x_16',
    'y_16',
  ].join(',')

  return `${base}${overlay}/${rest}`
}

// ─── Sharp fallback (non-Cloudinary images) ───────────────────────────────────

/**
 * Build the SVG overlay pill proportional to the image dimensions.
 * Uses only basic glyphs — no emoji — for universal font compatibility.
 */
function buildWatermarkSvg(imgWidth: number, imgHeight: number): Buffer {
  const fontSize  = Math.max(14, Math.round(imgHeight * 0.033))  // ~3.3% of height
  const padding   = Math.round(fontSize * 0.7)
  const lineH     = fontSize + padding * 2

  // Estimate text width: ~0.55 × fontSize per character
  const mainW     = Math.round(WM_TEXT.length    * fontSize * 0.55)
  const subW      = Math.round(WM_SUBTEXT.length * fontSize * 0.55)
  const pillW     = Math.max(mainW, subW) + padding * 2 + 8
  const pillH     = lineH * 2 + padding

  const svg = `
<svg width="${pillW}" height="${pillH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${pillW}" height="${pillH}" rx="14" fill="rgba(0,0,0,0.70)"/>
  <text
    x="${pillW / 2}" y="${padding + fontSize}"
    text-anchor="middle"
    font-family="sans-serif" font-size="${Math.round(fontSize * 0.80)}" font-weight="600"
    fill="rgba(255,255,255,0.80)"
    letter-spacing="0.5"
  >${WM_SUBTEXT}</text>
  <text
    x="${pillW / 2}" y="${padding + fontSize + lineH - 4}"
    text-anchor="middle"
    font-family="sans-serif" font-size="${fontSize}" font-weight="700"
    fill="white"
  >${WM_TEXT}</text>
</svg>`

  return Buffer.from(svg.trim())
}

/**
 * Parse a Supabase Storage public URL into bucket + path.
 * https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
 */
function parseSupabaseStorageUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/?#]+)\/(.+)/)
  if (!match) return null
  return { bucket: match[1], path: match[2].split('?')[0] }
}

/**
 * Download, watermark with sharp, then re-upload to Supabase Storage.
 * Returns the public URL of the watermarked image.
 */
async function addSharpWatermark(
  imageUrl: string,
  position: 'bottom-right' | 'bottom-center' = 'bottom-right',
): Promise<string> {
  // 1. Download
  const fetchRes = await fetch(imageUrl)
  if (!fetchRes.ok) throw new Error(`[Watermark] Failed to fetch image: ${imageUrl}`)
  const original = Buffer.from(await fetchRes.arrayBuffer())

  // Lazy-load sharp — dynamic import so the module loads fine even if sharp binary is missing
  const sharp = (await import('sharp')).default

  // 2. Get image dimensions
  const meta  = await sharp(original).metadata()
  const imgW  = meta.width  ?? 1080
  const imgH  = meta.height ?? 1080

  // 3. Build SVG watermark pill
  const pillSvg = buildWatermarkSvg(imgW, imgH)

  // Get actual pill dimensions from the SVG (parse from string)
  const wMatch = pillSvg.toString().match(/width="(\d+)"/)
  const hMatch = pillSvg.toString().match(/height="(\d+)"/)
  const pillW  = parseInt(wMatch?.[1] ?? '200')
  const pillH  = parseInt(hMatch?.[1] ?? '60')

  const margin = 20
  let left: number
  const top = imgH - pillH - margin

  if (position === 'bottom-right') {
    left = imgW - pillW - margin
  } else {
    left = Math.round((imgW - pillW) / 2)
  }

  // 4. Composite watermark onto image
  const watermarked = await sharp(original)
    .composite([{
      input:  pillSvg,
      top:    Math.max(0, top),
      left:   Math.max(0, left),
      blend:  'over',
    }])
    .jpeg({ quality: 90 })
    .toBuffer()

  // 5. Upload to Supabase Storage
  const parsed  = parseSupabaseStorageUrl(imageUrl)
  const bucket  = parsed?.bucket ?? 'listings'
  const origPath = parsed?.path  ?? `unknown/${Date.now()}.jpg`
  const destPath = `watermarked/${origPath.replace(/\.(jpg|jpeg|png|webp)$/i, '.jpg')}`

  const { error: upErr } = await supabaseAdmin.storage
    .from(bucket)
    .upload(destPath, watermarked, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (upErr) {
    // If upload fails, log it but return original — never block the post
    console.error('[Watermark] Storage upload failed:', upErr.message)
    return imageUrl
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(destPath)

  console.log(`[Watermark] Image watermarked: ${publicUrl}`)
  return publicUrl
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add NyumbaFasta watermark to an image URL.
 *
 * - Cloudinary URLs: returns a Cloudinary transformation URL (instant, free)
 * - Other URLs:      downloads, composites, re-uploads to Supabase (fallback)
 *
 * Never throws — on failure returns the original URL and logs the error.
 */
export async function watermarkImage(
  imageUrl: string,
  position: 'bottom-right' | 'bottom-center' = 'bottom-right',
): Promise<string> {
  if (!imageUrl) return imageUrl

  try {
    if (isCloudinaryUrl(imageUrl)) {
      const url = addCloudinaryImageWatermark(imageUrl)
      console.log(`[Watermark] Cloudinary image watermark applied`)
      return url
    }

    return await addSharpWatermark(imageUrl, position)
  } catch (err) {
    console.error('[Watermark] Image watermark failed, using original:', err)
    return imageUrl
  }
}

/**
 * Watermark an array of image URLs.
 * Processes all in parallel.
 */
export async function watermarkImages(
  imageUrls: string[],
  position: 'bottom-right' | 'bottom-center' = 'bottom-right',
): Promise<string[]> {
  return Promise.all(imageUrls.map(url => watermarkImage(url, position)))
}
