import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isAllowedImageBytes(buf: Buffer): boolean {
  if (buf.length < 4) return false
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true
  // WebP: RIFF....WEBP (bytes 0-3 = 52 49 46 46, bytes 8-11 = 57 45 42 50)
  if (buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true
  return false
}

const CLOUD  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Hakuna faili' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Picha ni kubwa sana (max 10MB)' }, { status: 400 })
    }
    // MIME allowlist checked against both declared type and magic bytes
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Aina ya faili hairuhusiwi. Tumia JPEG, PNG, WebP au GIF' }, { status: 400 })
    }
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    if (!isAllowedImageBytes(fileBuffer)) {
      return NextResponse.json({ error: 'Faili si picha halisi. Tumia JPEG, PNG, WebP au GIF' }, { status: 400 })
    }

    const fd = new FormData()
    fd.append('file', new Blob([fileBuffer], { type: file.type }), file.name)
    fd.append('upload_preset', PRESET)
    fd.append('folder', 'nyumba/listings')

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
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
      { status: 500 }
    )
  }
}
