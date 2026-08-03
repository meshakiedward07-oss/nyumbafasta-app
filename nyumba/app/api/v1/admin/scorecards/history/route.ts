import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSnapshotHistory } from '@/lib/scorecards/snapshot'

// GET /api/v1/admin/scorecards/history?days=7
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') ?? '30', 10)))

  try {
    const history = await getSnapshotHistory(days)
    return NextResponse.json({ history, days })
  } catch (err) {
    console.error('[scorecards/history GET]', err)
    return NextResponse.json({ error: 'Imeshindwa kupata historia' }, { status: 500 })
  }
}
