import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

// GET /api/v1/organizations/:id/maintenance
export async function GET(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
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

    const url      = req.nextUrl
    const status   = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const unitId   = url.searchParams.get('unit_id')

    let query = admin
      .from('maintenance_requests')
      .select(`
        *,
        reporter:users!reported_by(id, full_name, phone, avatar_url),
        assignee:users!assigned_to(id, full_name, avatar_url),
        unit:property_units(id, unit_number, unit_type),
        comment_count:maintenance_comments(count)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (status)   query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)
    if (unitId)   query = query.eq('unit_id', unitId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ requests: data ?? [] })
  } catch (err) {
    console.error('[GET /organizations/:id/maintenance]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/:id/maintenance
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
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

    const body = await req.json()
    const {
      title, description, category = 'other', priority = 'medium',
      unit_id, lease_id, estimated_cost, scheduled_at, notes, images = [],
      tenant_phone,
    } = body

    if (!title?.trim()) return NextResponse.json({ error: 'Kichwa cha ombi linahitajika' }, { status: 400 })

    // If tenant_phone provided, set reported_by to that tenant
    let reported_by = user.id
    if (tenant_phone?.trim()) {
      const { data: tenant } = await admin
        .from('users')
        .select('id')
        .eq('phone', tenant_phone.trim())
        .single()
      if (tenant) reported_by = tenant.id
    }

    const { data: request, error: reqErr } = await admin
      .from('maintenance_requests')
      .insert({
        org_id:         orgId,
        unit_id:        unit_id || null,
        lease_id:       lease_id || null,
        title:          title.trim(),
        description:    description?.trim() || null,
        category,
        priority,
        status:         'open',
        reported_by,
        estimated_cost: estimated_cost || null,
        scheduled_at:   scheduled_at || null,
        notes:          notes?.trim() || null,
        images,
      })
      .select()
      .single()

    if (reqErr) throw reqErr

    // Auto-create a maintenance conversation if unit has an active lease
    if (unit_id) {
      try {
        const { data: lease } = await admin
          .from('leases')
          .select('id, tenant_id, landlord_id')
          .eq('unit_id', unit_id)
          .eq('status', 'active')
          .single()

        if (lease) {
          const { data: conv } = await admin
            .from('conversations')
            .insert({
              title:           `Matengenezo — ${title.trim()}`,
              conv_type:       'maintenance',
              context_type:    'service_request',
              context_id:      request.id,
              org_id:          orgId,
              created_by:      user.id,
              last_message_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (conv) {
            const participantSet = new Set([user.id, lease.tenant_id, lease.landlord_id])
            await admin.from('conversation_participants').insert(
              Array.from(participantSet).map((uid, i) => ({
                conversation_id: conv.id,
                user_id:         uid,
                role:            i === 0 ? 'owner' : 'member',
              }))
            )
            await admin.from('messages').insert({
              conversation_id: conv.id,
              sender_id:       user.id,
              body:            `Ombi la matengenezo limewasilishwa: "${title.trim()}". Tutashughulikia haraka iwezekanavyo.`,
              message_type:    'system',
            })
            await admin
              .from('maintenance_requests')
              .update({ conversation_id: conv.id })
              .eq('id', request.id)
          }
        }
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ request }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/:id/maintenance]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
