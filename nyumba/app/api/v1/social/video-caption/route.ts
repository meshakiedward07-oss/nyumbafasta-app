import { NextRequest, NextResponse } from 'next/server'
import { generateVideoCaption } from '@/lib/social/captionGenerator'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 30

// POST /api/v1/social/video-caption
// Body: { title, videoType, description? }
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, videoType, description } = await req.json() as {
    title:        string
    videoType:    string
    description?: string
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title inahitajika' }, { status: 400 })
  }

  try {
    const captions = await generateVideoCaption({ title, videoType, description })
    return NextResponse.json({ ok: true, ...captions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    console.error('[VideoCaption]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
