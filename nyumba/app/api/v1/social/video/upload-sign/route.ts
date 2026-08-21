import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// 1x1 transparent PNG — used only to test whether the Cloudinary API key
// has "create" (upload) permission, without needing a real video file.
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

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

// GET /api/v1/social/video/upload-sign?self_test=1
// Diagnostic: signs + uploads a throwaway 1x1 PNG (as resource_type=image) using
// the SAME CLOUDINARY_API_KEY/SECRET as real video uploads, then deletes it.
// Isolates whether "Request forbidden due to missing permissions. action = create"
// is caused by the key itself (scoped/restricted Access Key in Cloudinary Console
// lacking Upload permission) rather than anything video- or eager-transform-specific.
// Never exposes the secret — only Cloudinary's own response is relayed.
async function runSelfTest(apiKey: string, apiSecret: string, cloudName: string) {
  const timestamp = Math.round(Date.now() / 1000)
  const folder = 'nyumba/_selftest'
  const paramsToSign: Record<string, string | number> = { folder, timestamp }
  const paramString = Object.keys(paramsToSign).sort().map(k => `${k}=${paramsToSign[k]}`).join('&')
  const signature = createHash('sha256').update(paramString + apiSecret).digest('hex')

  const fd = new FormData()
  fd.append('file', `data:image/png;base64,${TEST_PNG_BASE64}`)
  fd.append('api_key', apiKey)
  fd.append('timestamp', String(timestamp))
  fd.append('signature', signature)
  fd.append('folder', folder)

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
  })
  const uploadBody = await uploadRes.json().catch(() => ({}))

  if (!uploadRes.ok || !uploadBody.public_id) {
    return {
      ok: false,
      step: 'upload',
      http_status: uploadRes.status,
      cloudinary_error: uploadBody?.error?.message ?? 'Haikupata ujumbe wa kosa',
      cloud_name_used: cloudName,
      api_key_length: apiKey.length,
    }
  }

  // Cleanup — destroy the test asset (separate permission from "create")
  const destroyTimestamp = Math.round(Date.now() / 1000)
  const destroyParams: Record<string, string | number> = { public_id: uploadBody.public_id, timestamp: destroyTimestamp }
  const destroyParamString = Object.keys(destroyParams).sort().map(k => `${k}=${destroyParams[k]}`).join('&')
  const destroySignature = createHash('sha256').update(destroyParamString + apiSecret).digest('hex')
  const destroyFd = new FormData()
  destroyFd.append('public_id', uploadBody.public_id)
  destroyFd.append('api_key', apiKey)
  destroyFd.append('timestamp', String(destroyTimestamp))
  destroyFd.append('signature', destroySignature)
  const destroyRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    body: destroyFd,
  })
  const destroyBody = await destroyRes.json().catch(() => ({}))

  return {
    ok: true,
    message: 'Cloudinary create (upload) permission inafanya kazi ✅',
    cleanup: destroyBody?.result ?? 'unknown',
  }
}

// GET /api/v1/social/video/upload-sign
// Returns a Cloudinary signed upload signature so the client can upload
// directly without an upload preset.
// The eager transformation pre-generates the watermarked URL at upload time.
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const apiKey    = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'daw8jlbbd'

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET hazijawekwa' }, { status: 500 })
    }

    if (new URL(req.url).searchParams.get('self_test') === '1') {
      const result = await runSelfTest(apiKey, apiSecret, cloudName)
      return NextResponse.json(result)
    }

    const timestamp = Math.round(Date.now() / 1000)
    const folder    = 'nyumba/social-videos'

    // Params to sign (sorted alphabetically, excluding api_key/file/resource_type/cloud_name/signature_algorithm)
    // signature_algorithm is passed to the hash function, NOT included in the signed params string.
    // The client sends signature_algorithm=sha256 in FormData so Cloudinary knows which algorithm
    // to use for verification — but it is never part of the string that gets hashed.
    const paramsToSign: Record<string, string | number> = {
      eager: OVERLAY,
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

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/social/video/upload-sign]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
