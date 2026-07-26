import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

// GET /api/v1/organizations/:id/leases
export async function GET(_req: NextRequest, { params }: Params) {
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

    const { data, error } = await admin
      .from('leases')
      .select(`
        *,
        tenant:users!tenant_id(id, full_name, phone, email, avatar_url),
        unit:property_units(id, unit_number, unit_type, monthly_rent),
        listing:listings(id, title, district, region)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ leases: data ?? [] })
  } catch (err) {
    console.error('[GET /organizations/:id/leases]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/:id/leases
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
    const canWrite = isAdminStaff || ['owner', 'branch_manager', 'agent'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa ya kuunda mkataba' }, { status: 403 })

    const body = await req.json()
    const { unit_id, tenant_phone, monthly_rent, deposit_amount,
            start_date, end_date, notes, deposit_paid = false } = body

    if (!unit_id) return NextResponse.json({ error: 'unit_id inahitajika' }, { status: 400 })
    if (!tenant_phone?.trim()) return NextResponse.json({ error: 'Nambari ya simu ya mpangaji inahitajika' }, { status: 400 })
    if (!monthly_rent || monthly_rent <= 0) return NextResponse.json({ error: 'Kodi ya kila mwezi inahitajika' }, { status: 400 })
    if (!start_date) return NextResponse.json({ error: 'Tarehe ya kuanza inahitajika' }, { status: 400 })

    // Look up tenant by phone
    const { data: tenantProfile } = await admin
      .from('users')
      .select('id, full_name, phone')
      .eq('phone', tenant_phone.trim())
      .single()

    if (!tenantProfile) {
      return NextResponse.json({
        error: 'Mpangaji hajapatikana. Lazima awe na akaunti ya NyumbaFasta na nambari hii ya simu.',
      }, { status: 404 })
    }

    // Verify unit belongs to this org and is vacant
    const { data: unit } = await admin
      .from('property_units')
      .select('id, status, listing_id, org_id, unit_number')
      .eq('id', unit_id)
      .single()

    if (!unit) return NextResponse.json({ error: 'Kitengo hakipatikani' }, { status: 404 })
    if (unit.org_id !== orgId && !isAdminStaff) return NextResponse.json({ error: 'Kitengo hiki si cha shirika lako' }, { status: 403 })
    if (unit.status === 'occupied') return NextResponse.json({ error: 'Kitengo hiki tayari kina mpangaji' }, { status: 409 })

    // Get org landlord (org owner)
    const { data: ownerMember } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('role', 'owner')
      .single()

    const landlord_id = ownerMember?.user_id ?? user.id

    // Create lease
    const { data: lease, error: leaseErr } = await admin
      .from('leases')
      .insert({
        unit_id,
        listing_id: unit.listing_id,
        org_id: orgId,
        tenant_id: tenantProfile.id,
        landlord_id,
        monthly_rent,
        deposit_amount: deposit_amount || null,
        deposit_paid,
        deposit_paid_at: deposit_paid ? new Date().toISOString() : null,
        start_date,
        end_date: end_date || null,
        notes: notes?.trim() || null,
        status: 'active',
      })
      .select()
      .single()

    if (leaseErr) throw leaseErr

    // Mark unit as occupied
    await admin
      .from('property_units')
      .update({ status: 'occupied', updated_at: new Date().toISOString() })
      .eq('id', unit_id)

    // Auto-generate first payment record
    const firstDue = new Date(start_date)
    const { data: firstPayment } = await admin.from('lease_payments').insert({
      lease_id: lease.id,
      amount_due: monthly_rent,
      due_date: firstDue.toISOString().split('T')[0],
      status: 'pending',
    }).select('id').single()

    // Auto-create a lease conversation between tenant and org
    try {
      const { data: conv } = await admin
        .from('conversations')
        .insert({
          title:        `Mkataba — ${tenantProfile.full_name ?? tenantProfile.phone}`,
          conv_type:    'lease',
          context_type: 'lease',
          context_id:   lease.id,
          org_id:       orgId,
          created_by:   user.id,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (conv) {
        // Org member who created + tenant as participants
        await admin.from('conversation_participants').insert([
          { conversation_id: conv.id, user_id: user.id,           role: 'owner'  },
          { conversation_id: conv.id, user_id: tenantProfile.id,  role: 'member' },
          ...(landlord_id !== user.id
            ? [{ conversation_id: conv.id, user_id: landlord_id, role: 'member' as const }]
            : []),
        ])
        // Welcome system message
        await admin.from('messages').insert({
          conversation_id: conv.id,
          sender_id:       user.id,
          body:            `Habari ${tenantProfile.full_name ?? ''}! Mkataba wako wa upangaji umeanzishwa. Unaweza kuwasiliana nasi hapa kwa maswali yoyote.`,
          message_type:    'system',
        })
      }
    } catch { /* conversation creation is non-critical */ }

    // Non-fatal: welcome tenant via in-app + WhatsApp
    ;(async () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
      const unitLabel = (unit as unknown as { unit_number?: string } | null)?.unit_number ?? 'kitengo chako'
      const startStr = new Date(start_date).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
      const rentStr = `TZS ${monthly_rent.toLocaleString()}`
      try {
        await admin.from('notifications').insert({
          user_id: tenantProfile.id,
          title: '🏠 Karibu NyumbaFasta!',
          body: `Mkataba wako wa ${unitLabel} umeanza tarehe ${startStr}. Kodi ya kwanza ya ${rentStr} inasubiri malipo.`,
          type: 'lease_created',
          is_read: false,
          data: JSON.stringify({ lease_id: lease.id, payment_id: firstPayment?.id }),
        })
      } catch { /* non-fatal */ }
      if (tenantProfile.phone) {
        const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
        let msg = `🏠 *NyumbaFasta — Karibu!*\n\nHabari ${tenantProfile.full_name ?? ''}!\n\nMkataba wako wa *${unitLabel}* umeanzishwa:\n💰 Kodi: *${rentStr}/mwezi*\n📅 Ilianza: *${startStr}*`
        if (end_date) msg += `\n📅 Inaisha: *${new Date(end_date).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })}*`
        if (firstPayment?.id) msg += `\n\nLipa kodi ya kwanza hapa:\n${appUrl}/rent/proof/${firstPayment.id}`
        sendTextMessage(formatPhoneNumber(tenantProfile.phone), msg).catch(() => {})
      }
    })().catch(() => {})

    return NextResponse.json({ lease, tenant: tenantProfile }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/:id/leases]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
