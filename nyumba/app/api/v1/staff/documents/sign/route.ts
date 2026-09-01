import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

const CLOUD      = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const API_KEY    = process.env.CLOUDINARY_API_KEY!
const API_SECRET = process.env.CLOUDINARY_API_SECRET!
const ALLOWED    = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function sign(params: Record<string, string | number>): string {
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  // Cloudinary's upload API signs with SHA-1 by default (this account was
  // never configured for SHA-256) — using sha256 here made every signed
  // upload through this route fail with "Invalid Signature". Matches the
  // sha1 already used successfully in lib/ads/creative.ts's uploadVideo().
  return createHash('sha1').update(str + API_SECRET).digest('hex')
}

// GET /api/v1/staff/documents/sign?mimeType=...
// Returns a signed Cloudinary upload request so the browser uploads the
// document DIRECTLY to Cloudinary — never through this app's own Vercel
// functions, which enforce a hard 4.5MB request-body ceiling no
// maxDuration setting can raise. The old POST /staff/documents route
// relayed the raw file through Vercel first, so any document between
// 4.5MB and its own advertised 10MB limit would hang/fail against that
// platform ceiling before this app's code ever ran — the same class of
// bug found and fixed in the ads-creative upload pipeline the same day
// (see project_ads_creative_upload_fix memory notes).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (profile?.role === 'staff') {
    const { data: influencerCheck } = await admin.from('influencer_profiles')
      .select('id').eq('user_id', user.id).maybeSingle()
    if (influencerCheck) return NextResponse.json({ error: 'influencer_account' }, { status: 403 })
  }

  const mimeType = req.nextUrl.searchParams.get('mimeType') ?? 'application/pdf'
  if (!ALLOWED.includes(mimeType)) {
    return NextResponse.json({ error: 'Tumia PDF, JPG, au PNG pekee' }, { status: 400 })
  }

  const isPdf     = mimeType === 'application/pdf'
  const resType   = isPdf ? 'raw' : 'image'
  const folder    = `nyumbafasta/staff-docs/${user.id}`
  const timestamp = Math.round(Date.now() / 1000)
  // Cloudinary EXCLUDES resource_type (along with file/cloud_name/api_key/
  // signature) from the signed string — still sent as a normal request
  // parameter (below, and in the client's FormData), just never hashed.
  // Including it here was a second cause of "Invalid Signature", on top of
  // the sha256-vs-sha1 mismatch fixed earlier. Matches lib/ads/creative.ts's
  // working uploadVideo(), which never signed resource_type either.
  const signature = sign({ folder, timestamp })

  return NextResponse.json({
    uploadUrl:    `https://api.cloudinary.com/v1_1/${CLOUD}/${resType}/upload`,
    apiKey:       API_KEY,
    timestamp,
    signature,
    folder,
    resourceType: resType,
  })
}
