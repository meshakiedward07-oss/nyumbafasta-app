import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// Cloudinary video overlay — same as videoWatermark.ts
const OVERLAY = [
  'l_text:Arial_38_bold:NyumbaFasta%20%E2%80%A2%20nyumbafasta.co',
  'co_white',
  'b_rgb:000000B3',
  'g_south',
  'y_50',
  'pa_12',
  'r_20',
].join(',')

// GET /api/v1/social/video/upload-sign
// Returns a Cloudinary signed upload signature so the client can upload
// directly without an upload preset.
// The eager transformation pre-generates the watermarked URL at upload time.
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'daw8jlbbd'

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET hazijawekwa' }, { status: 500 })
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder    = 'nyumba/social-videos'

  // Params to sign (sorted alphabetically, excluding api_key/file/resource_type/cloud_name)
  // eager: pre-generate the watermarked version immediately after upload
  const paramsToSign: Record<string, string | number> = {
    eager:     OVERLAY,
    folder,
    timestamp,
  }

  const paramString = Object.keys(paramsToSign)
    .sort()
    .map(k => `${k}=${paramsToSign[k]}`)
    .join('&')

  const signature = createHash('sha256')
    .update(paramString + apiSecret)
    .digest('hex')

  return NextResponse.json({
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
    eager: OVERLAY,
  })
}
