import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CLOUD  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_PROFILE_PRESET!

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Hakuna faili' }, { status: 400 })
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Picha ni kubwa sana (max 2MB)' }, { status: 400 })
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', PRESET)
    fd.append('folder', 'nyumba/profiles')

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
