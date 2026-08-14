import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/my-maintenance
// Returns maintenance requests the current tenant submitted.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    const { data: requests } = await admin
      .from('maintenance_requests')
      .select(`
        id, title, description, category, priority, status,
        created_at, updated_at, resolved_at, scheduled_at,
        images, notes,
        unit:property_units(id, unit_number, unit_type),
        assignee:users!assigned_to(id, full_name, avatar_url)
      `)
      .eq('reported_by', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ requests: requests ?? [] })
  } catch (err) {
    console.error('[GET /my-maintenance]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/my-maintenance
// Tenant submits a new maintenance request.
// Resolves org_id + unit_id from their active lease.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Find the tenant's active lease to get org + unit
    const { data: lease } = await admin
      .from('leases')
      .select('id, org_id, unit_id')
      .eq('tenant_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lease) {
      return NextResponse.json({ error: 'Huna mkataba hai wa upangaji' }, { status: 403 })
    }

    const body = await req.json()
    const { title, description, category = 'other', priority = 'medium', images = [] } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Kichwa cha tatizo linahitajika' }, { status: 400 })
    }

    const { data: request, error: insertErr } = await admin
      .from('maintenance_requests')
      .insert({
        org_id:      lease.org_id,
        unit_id:     lease.unit_id ?? null,
        lease_id:    lease.id,
        title:       title.trim(),
        description: description?.trim() || null,
        category,
        priority,
        status:      'open',
        reported_by: user.id,
        images:      images.length > 0 ? images : null,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    // Notify org owner (non-fatal)
    ;(async () => {
      const { data: ownerRow } = await admin
        .from('organization_members')
        .select('user:users(id, phone, full_name)')
        .eq('organization_id', lease.org_id)
        .eq('role', 'owner')
        .maybeSingle()

      const owner = ownerRow?.user as unknown as { id: string; phone: string | null } | null
      if (!owner) return

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

      try {
        await admin.from('notifications').insert({
          user_id: owner.id,
          title:   '🔧 Ombi Jipya la Matengenezo',
          body:    `Mpangaji amewasilisha ombi la matengenezo: "${title.trim()}"`,
          type:    'maintenance_request',
          is_read: false,
          data:    JSON.stringify({ request_id: request.id, org_id: lease.org_id }),
        })
      } catch { /* non-fatal */ }

      if (owner.phone) {
        const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
        const msg =
          `🔧 *NyumbaFasta — Ombi la Matengenezo*\n\n` +
          `Mpangaji amewasilisha tatizo jipya:\n*${title.trim()}*\n\n` +
          `Angalia na ushughulikie hapa:\n${appUrl}/property/maintenance`
        sendTextMessage(formatPhoneNumber(owner.phone), msg).catch(() => {})
      }
    })().catch(() => {})

    return NextResponse.json({ request }, { status: 201 })
  } catch (err) {
    console.error('[POST /my-maintenance]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
