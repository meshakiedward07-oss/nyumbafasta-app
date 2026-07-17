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

// ── Brand stripe overlay ──────────────────────────────────────────────────────

function brandStripeSvg(width: number): Buffer {
  const svg = `<svg width="${width}" height="22" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="22" fill="#1D9E75" opacity="0.92"/>
    <text x="${width / 2}" y="15" text-anchor="middle"
          font-family="sans-serif" font-size="10" font-weight="700"
          fill="white" letter-spacing="1.5" opacity="0.9">
      nyumbafasta.co
    </text>
  </svg>`
  return Buffer.from(svg)
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

  // Composite brand stripe at bottom
  const stripe = brandStripeSvg(w)
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
  await admin.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType: 'image/webp',
    upsert: true,
  })
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
  const data = await res.json() as { public_id: string; secure_url: string }

  // Thumbnail: Cloudinary on-the-fly transformation (no extra upload)
  // so_2 = screenshot at 2 seconds; c_fill = cover crop
  const thumbUrl =
    `https://res.cloudinary.com/${CLOUD}/video/upload` +
    `/w_640,h_360,c_fill,so_2/${data.public_id}.jpg`

  return {
    video_url:       data.secure_url,
    video_thumb_url: thumbUrl,
    original_url:    data.secure_url,
  }
}

// ── Original image → Supabase Storage ────────────────────────────────────────

export async function uploadOriginal(
  buffer: Buffer,
  mimeType: string,
  storagePath: string,
): Promise<string> {
  const admin = createAdminClient()
  await admin.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: true,
  })
  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}
