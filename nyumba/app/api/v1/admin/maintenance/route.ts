import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/maintenance
// Fleet view of maintenance requests across all organizations.
// Query params: org_id, status, priority, category, q, limit, offset
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const admin    = createAdminClient()
    const url      = req.nextUrl
    const orgId    = url.searchParams.get('org_id')    ?? ''
    const status   = url.searchParams.get('status')    ?? ''
    const priority = url.searchParams.get('priority')  ?? ''
    const category = url.searchParams.get('category')  ?? ''
    const q        = url.searchParams.get('q')         ?? ''
    const limit    = Math.min(parseInt(url.searchParams.get('limit')  ?? '30'), 100)
    const offset   = parseInt(url.searchParams.get('offset') ?? '0')

    let query = admin
      .from('maintenance_requests')
      .select(`
        id, org_id, unit_id, title, category, priority, status,
        estimated_cost, scheduled_at, resolved_at, created_at, updated_at,
        organization:organizations!org_id(id, name),
        reporter:users!reported_by(id, full_name, phone, avatar_url),
        unit:property_units!unit_id(id, unit_number)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (orgId)    query = query.eq('org_id', orgId)
    if (status)   query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)
    if (category) query = query.eq('category', category)
    if (q)        query = query.ilike('title', `%${q}%`)

    const { data, count, error } = await query
    if (error) throw error

    // Global summary (no filters — total counts per status)
    const { data: allStats } = await admin
      .from('maintenance_requests')
      .select('status')

    const summary = {
      open:        allStats?.filter(r => r.status === 'open').length        ?? 0,
      in_progress: allStats?.filter(r => r.status === 'in_progress').length ?? 0,
      resolved:    allStats?.filter(r => r.status === 'resolved').length    ?? 0,
      closed:      allStats?.filter(r => r.status === 'closed').length      ?? 0,
    }

    return NextResponse.json({ requests: data ?? [], count: count ?? 0, summary })
  } catch (err) {
    console.error('[GET /admin/maintenance]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/admin/maintenance
// Body: { id, status?, priority?, notes? }
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const { id, status, priority, notes } = await req.json()
    if (!id) return NextResponse.json({ error: 'id inahitajika' }, { status: 400 })

    const VALID_STATUSES   = ['open', 'assigned', 'in_progress', 'resolved', 'closed']
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']
    if (status   && !VALID_STATUSES.includes(status))     return NextResponse.json({ error: 'Hali si sahihi'   }, { status: 400 })
    if (priority && !VALID_PRIORITIES.includes(priority)) return NextResponse.json({ error: 'Kipaumbele si sahihi' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status)   updates.status   = status
    if (priority) updates.priority = priority
    if (notes)    updates.notes    = notes
    if (status === 'resolved') updates.resolved_at = new Date().toISOString()

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('maintenance_requests')
      .update(updates)
      .eq('id', id)
      .select('id, status, priority, notes, resolved_at, updated_at')
      .single()

    if (error) throw error
    return NextResponse.json({ request: data })
  } catch (err) {
    console.error('[PATCH /admin/maintenance]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
