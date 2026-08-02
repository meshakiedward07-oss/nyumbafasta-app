import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { listActiveSocialSessions } from '@/lib/social/socialHandover'

// GET /api/v1/social/sessions?status=pending|admin|amina|resolved|all&platform=instagram|facebook
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const { searchParams } = req.nextUrl
    const status   = (searchParams.get('status')   ?? undefined) as Parameters<typeof listActiveSocialSessions>[0]
    const platform = (searchParams.get('platform') ?? undefined) as Parameters<typeof listActiveSocialSessions>[1]

    const sessions = await listActiveSocialSessions(status, platform)

    return NextResponse.json(
      { sessions },
      { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=10' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/v1/social/sessions]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
