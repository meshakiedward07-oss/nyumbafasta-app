import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { runAlertCheck } from '@/lib/alerts/checker'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, response: null }
}

// GET /api/v1/admin/alerts — dashboard: open events + all thresholds + last check summary
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response!

  const admin = createAdminClient()

  const [eventsResult, thresholdsResult] = await Promise.all([
    admin
      .from('alert_events')
      .select(`
        id, threshold_id, metric, display_name, current_value,
        threshold_value, severity, sop_id, status,
        acknowledged_by, acknowledged_at, resolved_at, notes, created_at,
        sop:sop_id ( slug, title )
      `)
      .in('status', ['open', 'acknowledged'])
      .order('severity', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(100),

    admin
      .from('alert_thresholds')
      .select(`
        id, metric, display_name, description, operator,
        threshold_value, severity, is_active, sop_id, created_at, updated_at,
        sop:sop_id ( slug, title )
      `)
      .order('severity', { ascending: true })
      .order('display_name', { ascending: true }),
  ])

  return NextResponse.json({
    events:     eventsResult.data  ?? [],
    thresholds: thresholdsResult.data ?? [],
  })
}

// POST /api/v1/admin/alerts — run the alert check now
export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response!

  try {
    const result = await runAlertCheck()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[alerts POST]', err)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
