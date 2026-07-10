import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

const CLOUD      = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const API_KEY    = process.env.CLOUDINARY_API_KEY!
const API_SECRET = process.env.CLOUDINARY_API_SECRET!

function isPdf(buf: Buffer): boolean {
  // PDF magic bytes: %PDF = 25 50 44 46
  return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Hakuna faili' }, { status: 400 })

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Faili lazima iwe PDF' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'PDF ni kubwa sana (max 10MB)' }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    if (!isPdf(fileBuffer)) {
      return NextResponse.json({ error: 'Faili si PDF halisi' }, { status: 400 })
    }

    const timestamp = Math.round(Date.now() / 1000)
    const folder    = 'nyumba/business-licenses'
    const paramsToSign: Record<string, string | number> = { folder, resource_type: 'raw', timestamp }
    const paramString = Object.keys(paramsToSign).sort()
      .map(k => `${k}=${paramsToSign[k]}`).join('&')
    const signature = createHash('sha256').update(paramString + API_SECRET).digest('hex')

    const fd = new FormData()
    fd.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), file.name)
    fd.append('api_key', API_KEY)
    fd.append('timestamp', String(timestamp))
    fd.append('signature', signature)
    fd.append('folder', folder)
    fd.append('resource_type', 'raw')

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/raw/upload`, {
      method: 'POST',
      body: fd,
    })
    const data = await res.json()
    if (!data.secure_url) {
      return NextResponse.json({ error: data.error?.message ?? 'Upload ilishindwa' }, { status: 500 })
    }

    return NextResponse.json({ url: data.secure_url })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Hitilafu ya seva' },
      { status: 500 },
    )
  }
}
