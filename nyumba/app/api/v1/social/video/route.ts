import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// POST /api/v1/social/video
// Body: { videoUrl, title, description?, videoType?, fileSize? }
// Called after client-side Cloudinary upload completes
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    videoUrl:     string
    title:        string
    description?: string
    videoType?:   string
    fileSize?:    number
  }

  const { videoUrl, title, description, videoType = 'promotion', fileSize } = body

  if (!videoUrl || !title?.trim()) {
    return NextResponse.json({ error: 'videoUrl na title vinahitajika' }, { status: 400 })
  }

  if (!videoUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'videoUrl lazima iwe HTTPS' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('video_uploads')
    .insert({
      admin_id:    admin.id,
      title:       title.trim(),
      description: description?.trim() ?? null,
      video_url:   videoUrl,
      video_type:  videoType,
      file_size:   fileSize ?? null,
      post_status: 'draft',
      platforms:   [],
    })
    .select('id')
    .single()

  if (error) {
    console.error('[VideoUpload] DB insert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, videoId: data.id, videoUrl })
}

// GET /api/v1/social/video — list uploads for current admin
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('video_uploads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ videos: data ?? [] })
}
