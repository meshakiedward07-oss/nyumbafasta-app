import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { resolveSocialSession } from '@/lib/social/socialHandover'
import type { SocialPlatform } from '@/lib/social/socialHandover'

type Params = { params: { senderId: string } }

// POST /api/v1/social/sessions/[senderId]/resolve
// Body: { platform: 'instagram' | 'facebook' }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const senderId = decodeURIComponent(params.senderId)
    const body = await req.json().catch(() => ({}))
    const platform = (body.platform ?? 'instagram') as SocialPlatform

    await resolveSocialSession(platform, senderId)

    return NextResponse.json({ ok: true, status: 'resolved' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/v1/social/sessions/[senderId]/resolve]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
