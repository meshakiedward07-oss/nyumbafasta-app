import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { optimizeCloudinaryImageUrl } from '@/lib/media/cloudinaryUrl'

const CLOUD      = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const API_KEY    = process.env.CLOUDINARY_API_KEY!
const API_SECRET = process.env.CLOUDINARY_API_SECRET!

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/3gpp',
  'application/pdf',
])
const MAX_SIZE = 100 * 1024 * 1024 // 100 MB (videos can be large)

function isImage(mime: string) { return mime.startsWith('image/') }
function isVideo(mime: string) { return mime.startsWith('video/') }

// POST /api/v1/upload/message-attachment
// FormData: file — image or PDF, max 20 MB
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Hakuna faili' }, { status: 400 })

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Aina ya faili hairelewi. Tumia picha, video (MP4/WEBM) au PDF.' },
        { status: 400 },
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Faili ni kubwa sana (max 100MB)' }, { status: 400 })
    }

    const fileBuffer  = Buffer.from(await file.arrayBuffer())
    const timestamp   = Math.round(Date.now() / 1000)
    const folder      = 'nyumba/message-attachments'
    const resourceType = isImage(file.type) ? 'image' : isVideo(file.type) ? 'video' : 'raw'

    const paramsToSign: Record<string, string | number> = { folder, resource_type: resourceType, timestamp }
    const paramString = Object.keys(paramsToSign).sort()
      .map((k) => `${k}=${paramsToSign[k]}`).join('&')
    const signature = createHash('sha256').update(paramString + API_SECRET).digest('hex')

    const fd = new FormData()
    fd.append('file', new Blob([fileBuffer], { type: file.type }), file.name)
    fd.append('api_key', API_KEY)
    fd.append('timestamp', String(timestamp))
    fd.append('signature', signature)
    fd.append('folder', folder)
    fd.append('resource_type', resourceType)

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/upload`
    const cdnRes = await fetch(uploadUrl, { method: 'POST', body: fd })
    const cdnData = await cdnRes.json()

    if (!cdnRes.ok || !cdnData.secure_url) {
      console.error('[upload/message-attachment] Cloudinary error:', cdnData)
      return NextResponse.json({ error: 'Haikuweza kupakia faili' }, { status: 502 })
    }

    const rawUrl = cdnData.secure_url as string
    const url = isImage(file.type) ? optimizeCloudinaryImageUrl(rawUrl, { maxWidth: 1200 }) : rawUrl
    return NextResponse.json({
      url,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    })
  } catch (err) {
    console.error('[upload/message-attachment]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
