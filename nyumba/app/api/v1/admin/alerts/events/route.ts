import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/alerts/events — resolved/acknowledged history
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'resolved'
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const { data, error } = await adminDb
    .from('alert_events')
    .select(`
      id, threshold_id, metric, display_name, current_value,
      threshold_value, severity, sop_id, status,
      acknowledged_by, acknowledged_at, resolved_at, notes, created_at,
      sop:sop_id ( slug, title )
    `)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data ?? [] })
}

// PATCH /api/v1/admin/alerts/events — acknowledge or resolve an event
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { id: string; action: 'acknowledge' | 'resolve'; notes?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, action, notes } = body
  if (!id || !action) return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
  if (!['acknowledge', 'resolve'].includes(action)) {
    return NextResponse.json({ error: 'action must be acknowledge or resolve' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const fields: Record<string, unknown> = notes ? { notes } : {}

  if (action === 'acknowledge') {
    fields.status          = 'acknowledged'
    fields.acknowledged_by = user.id
    fields.acknowledged_at = now
  } else {
    fields.status      = 'resolved'
    fields.resolved_at = now
  }

  const { error } = await adminDb.from('alert_events').update(fields).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
