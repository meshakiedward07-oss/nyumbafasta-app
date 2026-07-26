import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string; reqId: string } }

// GET /api/v1/organizations/:id/maintenance/:reqId
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: orgId, reqId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { count: membership } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', user.id)

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!membership && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const [reqRes, commentsRes, membersRes] = await Promise.all([
      admin
        .from('maintenance_requests')
        .select(`
          *,
          reporter:users!reported_by(id, full_name, phone, avatar_url),
          assignee:users!assigned_to(id, full_name, avatar_url),
          unit:property_units(id, unit_number, unit_type, monthly_rent),
          lease:leases(id, start_date, end_date, monthly_rent,
            tenant:users!tenant_id(id, full_name, phone))
        `)
        .eq('id', reqId)
        .eq('org_id', orgId)
        .single(),
      admin
        .from('maintenance_comments')
        .select(`
          *,
          author:users!author_id(id, full_name, avatar_url)
        `)
        .eq('request_id', reqId)
        .order('created_at', { ascending: true }),
      admin
        .from('organization_members')
        .select('user_id, role, user:users(id, full_name, avatar_url)')
        .eq('organization_id', orgId),
    ])

    if (reqRes.error || !reqRes.data) {
      return NextResponse.json({ error: 'Ombi halipatikani' }, { status: 404 })
    }

    return NextResponse.json({
      request:  reqRes.data,
      comments: commentsRes.data ?? [],
      members:  membersRes.data ?? [],
    })
  } catch (err) {
    console.error('[GET /organizations/:id/maintenance/:reqId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/organizations/:id/maintenance/:reqId
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId, reqId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!membership && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    // Fetch current request to track status changes
    const { data: current } = await admin
      .from('maintenance_requests')
      .select('status, org_id')
      .eq('id', reqId)
      .single()

    if (!current || current.org_id !== orgId) {
      return NextResponse.json({ error: 'Ombi halipatikani' }, { status: 404 })
    }

    const body = await req.json()
    const {
      status, priority, assigned_to, estimated_cost, actual_cost,
      scheduled_at, resolved_at, notes, comment,
    } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status        !== undefined) updates.status         = status
    if (priority      !== undefined) updates.priority       = priority
    if (assigned_to   !== undefined) updates.assigned_to    = assigned_to
    if (estimated_cost !== undefined) updates.estimated_cost = estimated_cost
    if (actual_cost   !== undefined) updates.actual_cost    = actual_cost
    if (scheduled_at  !== undefined) updates.scheduled_at   = scheduled_at
    if (notes         !== undefined) updates.notes          = notes?.trim() || null

    // Auto-set resolved_at when resolving
    if (status === 'resolved' && current.status !== 'resolved') {
      updates.resolved_at = new Date().toISOString()
    }
    if (resolved_at !== undefined) updates.resolved_at = resolved_at

    const { data: request, error } = await admin
      .from('maintenance_requests')
      .update(updates)
      .eq('id', reqId)
      .select()
      .single()

    if (error) throw error

    // Add a comment for status changes or explicit comment
    const statusChange = status && status !== current.status ? `${current.status}→${status}` : null
    if (statusChange || comment?.trim()) {
      await admin.from('maintenance_comments').insert({
        request_id:    reqId,
        author_id:     user.id,
        body:          (comment?.trim()) || (STATUS_COMMENT_LABELS[statusChange ?? ''] ?? `Hali imebadilishwa: ${statusChange}`),
        status_change: statusChange,
      })
    }

    return NextResponse.json({ request })
  } catch (err) {
    console.error('[PATCH /organizations/:id/maintenance/:reqId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

const STATUS_COMMENT_LABELS: Record<string, string> = {
  'open→assigned':              'Ombi limepewa mtu.',
  'open→in_progress':           'Kazi imeanza.',
  'assigned→in_progress':       'Kazi imeanza.',
  'in_progress→awaiting_parts': 'Inasubiri vifaa.',
  'in_progress→resolved':       'Tatizo limeshughulikiwa.',
  'awaiting_parts→in_progress': 'Vifaa vimepatikana, kazi imeanza tena.',
  'awaiting_parts→resolved':    'Tatizo limeshughulikiwa.',
  'resolved→closed':            'Ombi limefungwa.',
}
