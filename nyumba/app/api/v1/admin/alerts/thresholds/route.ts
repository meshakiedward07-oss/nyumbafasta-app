import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, userId: '', response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { ok: false, userId: '', response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, response: null }
}

const VALID_OPERATORS  = ['gt', 'lt', 'gte', 'lte', 'eq']
const VALID_SEVERITIES = ['info', 'warning', 'critical']

// GET /api/v1/admin/alerts/thresholds
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response!

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('alert_thresholds')
    .select('*, sop:sop_id(slug, title)')
    .order('severity')
    .order('display_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ thresholds: data ?? [] })
}

// POST /api/v1/admin/alerts/thresholds — create
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response!

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { metric, display_name, description, operator, threshold_value, severity, sop_id } = body

  if (!metric || !display_name || threshold_value == null) {
    return NextResponse.json({ error: 'metric, display_name, and threshold_value are required' }, { status: 400 })
  }
  if (operator && !VALID_OPERATORS.includes(String(operator))) {
    return NextResponse.json({ error: `operator must be one of: ${VALID_OPERATORS.join(', ')}` }, { status: 400 })
  }
  if (severity && !VALID_SEVERITIES.includes(String(severity))) {
    return NextResponse.json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('alert_thresholds')
    .insert({
      metric:          String(metric),
      display_name:    String(display_name),
      description:     description ? String(description) : null,
      operator:        operator ? String(operator) : 'gt',
      threshold_value: Number(threshold_value),
      severity:        severity ? String(severity) : 'warning',
      sop_id:          sop_id ? String(sop_id) : null,
      is_active:       true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ threshold: data }, { status: 201 })
}

// PATCH /api/v1/admin/alerts/thresholds — update
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response!

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const allowed = ['display_name', 'description', 'operator', 'threshold_value', 'severity', 'sop_id', 'is_active']
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (rest[key] !== undefined) fields[key] = rest[key]
  }

  const admin = createAdminClient()
  const { error } = await admin.from('alert_thresholds').update(fields).eq('id', String(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE /api/v1/admin/alerts/thresholds?id=...
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response!

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('alert_thresholds').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
