/**
 * Ad creative processing pipeline.
 *
 * Images  → sharp (Vercel-compatible) → 5 landscape variants → Supabase Storage
 * Videos  → Cloudinary REST API (signed upload) → thumbnail URL via transformation
 * Carousel → each image through same sharp pipeline
 *
 * All variants use 16:9 or 3:1 landscape ratios with cover+attention cropping.
 * A thin NyumbaFasta brand stripe is composited onto every image variant.
 */

import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'listings'
const CLOUD   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
const API_KEY = process.env.CLOUDINARY_API_KEY ?? ''
const API_SEC = process.env.CLOUDINARY_API_SECRET ?? ''

export const VARIANTS = {
  banner:   { w: 1200, h: 400 },   // 3:1 — homepage wide banner
  search:   { w: 600,  h: 200 },   // 3:1 — search results
  nearby:   { w: 300,  h: 200 },   // 3:2 — horizontal scroll card
  featured: { w: 800,  h: 450 },   // 16:9 — directory card
  thumb:    { w: 640,  h: 360 },   // 16:9 — video thumbnail / fallback
} as const

type VariantKey = keyof typeof VARIANTS

// Portrait warning: height > 1.3× width is too portrait for landscape crops
export const PORTRAIT_THRESHOLD = 1.3

// Ad video limits — enforced here too (not just client-side in
// UploadCreative.tsx) since this API can be called directly with an
// already-uploaded Storage path, bypassing any browser-side check.
// Found/added 2026-09-01: unbounded video length/size is a real system
// risk (Cloudinary storage+bandwidth cost, transcode time, page-load
// weight for every visitor who sees the ad) — rejected outright, not just
// warned, since (unlike the portrait-ratio check) there's no legitimate
// reason to force an oversized/overlong ad video through.
export const MAX_VIDEO_BYTES_SERVER    = 50 * 1024 * 1024
export const MAX_VIDEO_DURATION_SECONDS = 30

// Thrown for a video that fails validation (too big / too long) — kept
// distinct from a generic processing failure so the API route can surface
// the real, actionable Swahili message instead of the generic
// "Haikuweza kushughulikia faili" catch-all.
export class VideoValidationError extends Error {}

// ── Brand stripe overlay ──────────────────────────────────────────────────────

// Builds a solid #1D9E75 stripe as raw PNG — no librsvg required on Vercel Lambda.
async function brandStripeBuffer(width: number): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  return sharp({
    create: {
      width,
      height: 22,
      channels: 4,
      background: { r: 29, g: 158, b: 117, alpha: 0.92 }, // #1D9E75 at 92% opacity
    },
  })
    .png()
    .toBuffer()
}

// ── Image processing ──────────────────────────────────────────────────────────

async function processVariant(
  source: Buffer,
  key: VariantKey,
): Promise<Buffer> {
  const { w, h } = VARIANTS[key]
  const sharp = (await import('sharp')).default

  const resized = await sharp(source)
    .resize(w, h, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer()

  // Composite brand stripe at bottom — raw PNG avoids the librsvg dependency
  const stripe = await brandStripeBuffer(w)
  return sharp(resized)
    .composite([{ input: stripe, gravity: 'south', blend: 'over' }])
    .webp({ quality: 82 })
    .toBuffer()
}

async function uploadVariant(
  buffer: Buffer,
  storagePath: string,
): Promise<string> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType: 'image/webp',
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed (${storagePath}): ${error.message}`)
  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

// ── Ratio validation ──────────────────────────────────────────────────────────

export type RatioCheck = { ok: true } | { ok: false; ratio: number; message: string }

export async function checkImageRatio(buffer: Buffer): Promise<RatioCheck> {
  const sharp = (await import('sharp')).default
  const { width = 1, height = 1 } = await sharp(buffer).metadata()
  const ratio = height / width
  if (ratio > PORTRAIT_THRESHOLD) {
    return {
      ok: false,
      ratio,
      message:
        `Picha yako ni ndefu mno (ratio ${ratio.toFixed(2)}:1 — urefu > upana). ` +
        `Crop itaharibu maudhui muhimu. Pakia picha yenye upana zaidi (landscape), ` +
        `kama vile picha ya kawaida ya simu iliyogeuzwa pembeni.`,
    }
  }
  return { ok: true }
}

// ── Single image → all variants ───────────────────────────────────────────────

export type ImageVariants = {
  banner_url:      string
  search_url:      string
  nearby_url:      string
  featured_url:    string
  video_thumb_url: string
  original_url:    string
}

export async function processImage(
  buffer: Buffer,
  basePath: string,          // ad-creatives/{advertiserId}/{creativeId}
  originalUrl: string,
): Promise<ImageVariants> {
  const keys = Object.keys(VARIANTS) as VariantKey[]

  const urls = await Promise.all(
    keys.map(async key => {
      const varBuf = await processVariant(buffer, key)
      const path   = `${basePath}/${key}.webp`
      const url    = await uploadVariant(varBuf, path)
      return [key, url] as const
    }),
  )

  const map = Object.fromEntries(urls)
  return {
    banner_url:      map.banner,
    search_url:      map.search,
    nearby_url:      map.nearby,
    featured_url:    map.featured,
    video_thumb_url: map.thumb,
    original_url:    originalUrl,
  }
}

// ── Carousel → variants per slide ─────────────────────────────────────────────

export async function processCarousel(
  buffers: Buffer[],
  basePath: string,
  originalUrls: string[],
): Promise<{ carousel_urls: string[]; first: ImageVariants }> {
  const slides = await Promise.all(
    buffers.map((buf, i) =>
      processImage(buf, `${basePath}/slide-${i}`, originalUrls[i] ?? '')
    ),
  )

  return {
    carousel_urls: slides.map(s => s.banner_url),
    first:         slides[0],
  }
}

// ── Video → Cloudinary upload + thumbnail URL ─────────────────────────────────

export type VideoResult = {
  video_url:       string
  video_thumb_url: string
  original_url:    string
}

export async function uploadVideo(
  buffer: Buffer,
  mimeType: string,
  advertiserId: string,
): Promise<VideoResult> {
  if (!CLOUD || !API_KEY || !API_SEC) {
    throw new Error(
      'Cloudinary credentials hazijawekwa — weka NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, ' +
      'CLOUDINARY_API_KEY, na CLOUDINARY_API_SECRET kwenye Vercel environment variables.',
    )
  }

  // Size check BEFORE spending a Cloudinary upload call on a file we're
  // going to reject anyway — buffer.length is already the real file size
  // at this point (downloaded from Storage), no need to wait for
  // Cloudinary's own response to know this.
  if (buffer.length > MAX_VIDEO_BYTES_SERVER) {
    const mb = (buffer.length / (1024 * 1024)).toFixed(1)
    throw new VideoValidationError(
      `Video ni kubwa mno (${mb}MB). Kiwango cha juu ni 50MB ili kulinda mfumo — punguza ubora wa video au rekodi fupi zaidi.`,
    )
  }

  const folder    = `ad-creatives/${advertiserId}`
  const timestamp = Math.floor(Date.now() / 1000)
  const paramStr  = `folder=${folder}&timestamp=${timestamp}`
  const signature = createHash('sha1').update(paramStr + API_SEC).digest('hex')

  const form = new FormData()
  form.append('file',      new Blob([new Uint8Array(buffer)], { type: mimeType }))
  form.append('api_key',   API_KEY)
  form.append('timestamp', String(timestamp))
  form.append('signature', signature)
  form.append('folder',    folder)

  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`, {
    method: 'POST',
    body:   form,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cloudinary upload failed: ${err}`)
  }
  const data = await res.json() as { public_id: string; secure_url: string; duration?: number }

  // Duration check AFTER upload — Cloudinary is the only place that can
  // actually tell us the real duration of an arbitrary video container, and
  // it reports it in the same response as the upload itself, so this is
  // the earliest point it's knowable. Reject and clean up rather than warn:
  // an ad video has no legitimate reason to exceed 30s, unlike the
  // portrait-ratio case which can be a deliberate creative choice.
  if (typeof data.duration === 'number' && data.duration > MAX_VIDEO_DURATION_SECONDS) {
    await destroyCloudinaryVideo(data.public_id).catch(() => {})
    throw new VideoValidationError(
      `Video ni ndefu mno (sekunde ${Math.round(data.duration)}). Kiwango cha juu ni sekunde 30 ili kulinda mfumo — punguza urefu wa video kabla ya kupakia tena.`,
    )
  }

  // Thumbnail: Cloudinary on-the-fly transformation (no extra upload)
  // so_2 = screenshot at 2 seconds; c_fill = cover crop
  const thumbUrl =
    `https://res.cloudinary.com/${CLOUD}/video/upload` +
    `/w_640,h_360,c_fill,so_2/${data.public_id}.jpg`

  // Delivery URL uses Cloudinary's smart/perceptual compression — q_auto:good
  // picks the highest compression that doesn't introduce visible artifacts
  // (content-aware, not a blanket bitrate cut), f_auto + vc_auto pick the
  // smallest format/codec the requesting browser actually supports (e.g.
  // WebM/VP9 or H.265 instead of always serving raw H.264 MP4). On-the-fly,
  // same technique already proven for social video posts
  // (app/api/v1/social/video/upload-sign/route.ts's eager transform) — no
  // extra upload step, Cloudinary transforms + CDN-caches on first request.
  // Deliberately NOT the aggressive resolution/bitrate cap
  // lib/video/compress.ts uses for listing preview clips — an advertiser is
  // paying to show a polished ad, not a quick phone-video preview.
  const videoUrl =
    `https://res.cloudinary.com/${CLOUD}/video/upload` +
    `/q_auto:good,f_auto,vc_auto/${data.public_id}.mp4`

  return {
    video_url:       videoUrl,
    video_thumb_url: thumbUrl,
    original_url:    data.secure_url,
  }
}

// Removes a video that failed post-upload validation (too long) — Cloudinary
// has no "reject before storing" option for duration, so a too-long clip is
// briefly stored then deleted rather than left billing/counting against the
// account forever. Best-effort: called with .catch(() => {}) at the call
// site, since a failed cleanup shouldn't block surfacing the real
// validation error to the advertiser.
async function destroyCloudinaryVideo(publicId: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000)
  const paramStr  = `public_id=${publicId}&timestamp=${timestamp}`
  const signature = createHash('sha1').update(paramStr + API_SEC).digest('hex')

  const form = new FormData()
  form.append('public_id', publicId)
  form.append('api_key',   API_KEY)
  form.append('timestamp', String(timestamp))
  form.append('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/video/destroy`, {
    method: 'POST',
    body:   form,
  })
  if (!res.ok) throw new Error(`Cloudinary destroy failed: ${await res.text()}`)
}

// ── Original image → Supabase Storage ────────────────────────────────────────

export async function uploadOriginal(
  buffer: Buffer,
  mimeType: string,
  storagePath: string,
): Promise<string> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed (${storagePath}): ${error.message}`)
  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}
