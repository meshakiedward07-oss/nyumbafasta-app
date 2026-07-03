import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { getUnifiedStats } from '@/lib/social/unifiedPost'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') ?? 'month') as 'today' | 'week' | 'month' | 'all'

    const stats = await getUnifiedStats(period)
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[GET /social/stats]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
