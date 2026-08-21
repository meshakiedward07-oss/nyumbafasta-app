import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// Cloudinary eager transformation chain:
//   1. Quality + format optimization (f_auto,q_auto,vc_auto)
//   2. Watermark text overlay (two segments required by Cloudinary video overlay API)
// IMPORTANT: In Cloudinary transformation syntax, spaces in text must be underscores (_),
// NOT %20 or literal spaces — Cloudinary decodes %20 before signature verification,
// causing a mismatch if we sign the %20 form. Use _ for spaces, avoid % encoding in eager.
const OVERLAY =
  'f_auto,q_auto,vc_auto' +
  '/l_text:Arial_38_bold:NyumbaFasta_-_nyumbafasta.co,co_white,b_rgb:000000B3,r_20' +
  '/fl_layer_apply,g_south,y_50'

// GET /api/v1/social/video/upload-sign
// Returns a Cloudinary signed upload signature so the client can upload
// directly without an upload preset.
// The eager transformation pre-generates the watermarked URL at upload time.
export async function GET() {
  try {
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
    // signature_algorithm MUST be included when using sha256 — required by Cloudinary signing spec
    const paramsToSign: Record<string, string | number> = {
      eager:               OVERLAY,
      folder,
      signature_algorithm: 'sha256',
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

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/social/video/upload-sign]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
