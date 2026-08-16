import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { sendSocialAdminMessage, getSocialSession } from '@/lib/social/socialHandover'
import type { SocialPlatform } from '@/lib/social/socialHandover'

type Params = { params: Promise<{ senderId: string }> }

// POST /api/v1/social/sessions/[senderId]/send
// Body: { platform: 'instagram' | 'facebook', message: string }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const { senderId: rawSenderId } = await params
    const senderId = decodeURIComponent(rawSenderId)
    const body = await req.json().catch(() => ({}))
    const platform = (body.platform ?? 'instagram') as SocialPlatform
    const message  = (body.message ?? '').trim() as string

    if (!message) {
      return NextResponse.json({ error: 'Ujumbe haujakuwepo' }, { status: 400 })
    }

    const session = await getSocialSession(platform, senderId)
    if (!session) {
      return NextResponse.json({ error: 'Session haipatikani' }, { status: 404 })
    }

    if (session.status !== 'admin') {
      return NextResponse.json(
        { error: 'Session hii haiko chini ya udhibiti wa admin' },
        { status: 409 },
      )
    }

    await sendSocialAdminMessage(platform, senderId, session.id, message, auth.userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/v1/social/sessions/[senderId]/send]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
