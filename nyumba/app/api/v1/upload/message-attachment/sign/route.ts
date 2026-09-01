import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

const CLOUD      = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const API_KEY    = process.env.CLOUDINARY_API_KEY!
const API_SECRET = process.env.CLOUDINARY_API_SECRET!

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/3gpp',
  'application/pdf',
])

function isImage(mime: string) { return mime.startsWith('image/') }
function isVideo(mime: string) { return mime.startsWith('video/') }

// GET /api/v1/upload/message-attachment/sign?mimeType=...
// Returns a signed Cloudinary upload request so the browser can upload the
// attachment DIRECTLY to Cloudinary — never through this app's own Vercel
// functions, which enforce a hard 4.5MB request-body ceiling no
// maxDuration setting can raise. The old POST /upload/message-attachment
// route relayed the raw file through Vercel first, so any attachment
// between 4.5MB and its own advertised 100MB limit would hang/fail against
// that platform ceiling before this app's code ever ran — the same class
// of bug found and fixed in the ads-creative upload pipeline the same day
// (see project_ads_creative_upload_fix memory notes).
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const mimeType = req.nextUrl.searchParams.get('mimeType') ?? 'image/jpeg'
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json({ error: 'Aina ya faili hairuhusiwi' }, { status: 400 })
    }

    const timestamp    = Math.round(Date.now() / 1000)
    const folder        = 'nyumba/message-attachments'
    const resourceType  = isImage(mimeType) ? 'image' : isVideo(mimeType) ? 'video' : 'raw'

    const paramsToSign: Record<string, string | number> = { folder, resource_type: resourceType, timestamp }
    const paramString = Object.keys(paramsToSign).sort()
      .map((k) => `${k}=${paramsToSign[k]}`).join('&')
    // Cloudinary's upload API signs with SHA-1 by default (this account was
    // never configured for SHA-256) — using sha256 here made every signed
    // upload through this route fail with "Invalid Signature". Matches the
    // sha1 already used successfully in lib/ads/creative.ts's uploadVideo().
    const signature = createHash('sha1').update(paramString + API_SECRET).digest('hex')

    return NextResponse.json({
      uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/upload`,
      apiKey:    API_KEY,
      timestamp,
      signature,
      folder,
      resourceType,
    })
  } catch (err) {
    console.error('[upload/message-attachment/sign]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
