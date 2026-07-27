import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { listActiveSocialSessions } from '@/lib/social/socialHandover'

// GET /api/v1/social/sessions?status=pending|admin|all
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const status = req.nextUrl.searchParams.get('status') as 'pending' | 'admin' | undefined
    const sessions = await listActiveSocialSessions(status || undefined)

    return NextResponse.json({ sessions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/v1/social/sessions]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
