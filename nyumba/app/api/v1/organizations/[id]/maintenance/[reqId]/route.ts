import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; reqId: string }> }

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
      status, priority, assigned_to, vendor_id, estimated_cost, actual_cost,
      scheduled_at, resolved_at, notes, comment,
    } = body

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = { updated_at: now }
    if (status         !== undefined) updates.status         = status
    if (priority       !== undefined) updates.priority       = priority
    if (assigned_to    !== undefined) updates.assigned_to    = assigned_to
    if (vendor_id      !== undefined) updates.vendor_id      = vendor_id || null
    if (estimated_cost !== undefined) updates.estimated_cost = estimated_cost
    if (actual_cost    !== undefined) updates.actual_cost    = actual_cost
    if (scheduled_at   !== undefined) updates.scheduled_at   = scheduled_at
    if (notes          !== undefined) updates.notes          = notes?.trim() || null

    // Auto-set resolved_at when resolving
    if (status === 'resolved' && current.status !== 'resolved') {
      updates.resolved_at = now
    }
    if (resolved_at !== undefined) updates.resolved_at = resolved_at

    const { data: request, error } = await admin
      .from('maintenance_requests')
      .update(updates)
      .eq('id', reqId)
      .select('*, vendor:vendors(id, name, phone, category)')
      .single()

    if (error) throw error

    // Increment vendor jobs_completed when resolved/closed
    if (vendor_id && ['resolved', 'closed'].includes(status ?? '')) {
      const { data: v } = await admin.from('vendors').select('jobs_completed').eq('id', vendor_id).maybeSingle()
      if (v) {
        try {
          await admin.from('vendors')
            .update({ jobs_completed: ((v.jobs_completed as number) ?? 0) + 1, updated_at: now })
            .eq('id', vendor_id)
        } catch { /* non-fatal */ }
      }
    }

    // Notify vendor via WhatsApp when newly assigned
    const newVendorId = vendor_id !== undefined ? vendor_id : null
    const prevVendorId = (current as Record<string, unknown>).vendor_id ?? null
    if (newVendorId && newVendorId !== prevVendorId) {
      ;(async () => {
        const { data: vendor } = await admin.from('vendors').select('name, phone').eq('id', newVendorId).maybeSingle()
        if (!vendor?.phone) return
        const { data: req } = await admin.from('maintenance_requests').select('title, unit:property_units(unit_number)').eq('id', reqId).maybeSingle()
        const unitLabel = (req?.unit as unknown as { unit_number?: string } | null)?.unit_number ?? 'kitengo'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
        const { sendTextMessage, formatPhoneNumber } = await import('@/lib/whatsapp/client')
        const msg =
          `🔧 *NyumbaFasta — Kazi Mpya*\n\n` +
          `Habari ${vendor.name}!\n\nUmepewa kazi ya matengenezo:\n` +
          `📋 *${req?.title ?? 'Matengenezo'}*\n🏠 Kitengo: *${unitLabel}*\n\n` +
          `Wasiliana nasi au angalia maelezo zaidi:\n${appUrl}/property/maintenance/${reqId}`
        sendTextMessage(formatPhoneNumber(vendor.phone), msg).catch(() => {})
        await admin.from('maintenance_requests').update({ vendor_notified_at: now }).eq('id', reqId)
      })().catch(() => {})
    }

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
