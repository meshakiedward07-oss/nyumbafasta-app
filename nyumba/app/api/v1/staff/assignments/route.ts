import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — staff gets their own assignments; admin gets all or by staff_id
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staff_id')
  const status  = searchParams.get('status') // pending|in_progress|completed|all

  let query = admin
    .from('staff_assignments')
    .select('id, title, description, category, priority, status, ref_type, ref_id, due_date, notes, created_at, completed_at, staff:staff_id(id, full_name), assigned_by_user:assigned_by(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (profile?.role === 'staff') {
    query = query.eq('staff_id', user.id)
  } else if (staffId) {
    query = query.eq('staff_id', staffId)
  }

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data ?? [] })
}

// POST — admin assigns a task to a staff member
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin tu anaweza kutoa kazi' }, { status: 403 })
  }

  let body: {
    staff_id: string
    title: string
    description?: string
    category?: string
    priority?: string
    ref_type?: string
    ref_id?: string
    due_date?: string
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.staff_id || !body.title) {
    return NextResponse.json({ error: 'staff_id na title vinahitajika' }, { status: 400 })
  }

  const { data: targetUser } = await admin.from('users').select('role').eq('id', body.staff_id).single()
  if (!targetUser || targetUser.role !== 'staff') {
    return NextResponse.json({ error: 'Mpokeaji lazima awe mfanyakazi aliyesajiliwa' }, { status: 400 })
  }

  const { data, error } = await admin.from('staff_assignments').insert({
    staff_id:    body.staff_id,
    assigned_by: user.id,
    title:       body.title,
    description: body.description ?? null,
    category:    body.category ?? 'general',
    priority:    body.priority ?? 'normal',
    ref_type:    body.ref_type ?? null,
    ref_id:      body.ref_id ?? null,
    due_date:    body.due_date ?? null,
    status:      'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the staff member
  await admin.from('notifications').insert({
    user_id: body.staff_id,
    title:   '📋 Kazi Mpya Imekupewa',
    body:    `Admin amekupa kazi mpya: "${body.title}"`,
    type:    'staff_assignment',
    is_read: false,
  })

  return NextResponse.json({ ok: true, assignment: data })
}

// PATCH — staff updates assignment status (e.g., mark in_progress or completed)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role, staff_active').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (profile?.role === 'staff' && profile?.staff_active === false) {
    return NextResponse.json({ error: 'Akaunti ya staff imezimwa' }, { status: 403 })
  }

  let body: { id: string; status: string; notes?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const staffStatuses  = ['pending', 'in_progress', 'completed']
  const adminStatuses  = ['pending', 'in_progress', 'completed', 'cancelled']
  const validStatuses  = profile?.role === 'admin' ? adminStatuses : staffStatuses
  if (!body.id || !validStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'id na status sahihi vinahitajika' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {
    status: body.status,
    notes:  body.notes ?? null,
  }
  if (body.status === 'completed') updatePayload.completed_at = new Date().toISOString()

  // Staff can only update their own; admin can update any
  let query = admin.from('staff_assignments').update(updatePayload).eq('id', body.id)
  if (profile?.role === 'staff') query = query.eq('staff_id', user.id)

  const { data: rows, error } = await query.select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows || rows.length === 0) return NextResponse.json({ error: 'Kazi haikupatikana' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
