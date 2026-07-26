import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ paymentId: string }> }

// GET /api/v1/payments/rent/:paymentId
// Tenant/org-member reads payment info + banking details for the proof-upload page.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { paymentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Fetch the payment and its parent lease
    const { data: payment } = await admin
      .from('lease_payments')
      .select('id, lease_id, status, amount_due, amount_paid, due_date, paid_date, proof_url, proof_note, proof_uploaded_at, verified_at')
      .eq('id', paymentId)
      .maybeSingle()

    if (!payment) return NextResponse.json({ error: 'Malipo hayapatikani' }, { status: 404 })

    // Fetch lease to get org_id and tenant_id for auth check
    const { data: lease } = await admin
      .from('leases')
      .select('id, org_id, tenant_id, monthly_rent, start_date, end_date, status, unit:property_units(unit_number, unit_type), listing:listings(title, district, region)')
      .eq('id', payment.lease_id)
      .maybeSingle()

    if (!lease) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })

    const orgId = lease.org_id as string

    // Auth: tenant, org member, or admin/staff
    const [{ data: profile }, { count: membership }] = await Promise.all([
      admin.from('users').select('role').eq('id', user.id).single(),
      admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', user.id),
    ])
    const isTenant     = lease.tenant_id === user.id
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!isTenant && !membership && !isAdminStaff) {
      return NextResponse.json({ error: 'Huna ruhusa kuona malipo haya' }, { status: 403 })
    }

    // Fetch banking info for this org
    const { data: banking } = await admin
      .from('organization_banking')
      .select('bank_name, account_name, account_number, branch, mobile_money_number, mobile_money_provider, additional_instructions')
      .eq('org_id', orgId)
      .maybeSingle()

    // Fetch org name
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()

    return NextResponse.json({ payment, lease, banking, org_name: org?.name ?? null, org_id: orgId })
  } catch (err) {
    console.error('[GET /payments/rent/:paymentId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/payments/rent/:paymentId
// Tenant submits proof of payment.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { paymentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    const { data: payment } = await admin
      .from('lease_payments')
      .select('id, lease_id, status')
      .eq('id', paymentId)
      .maybeSingle()

    if (!payment) return NextResponse.json({ error: 'Malipo hayapatikani' }, { status: 404 })

    const { data: lease } = await admin
      .from('leases')
      .select('id, org_id, tenant_id')
      .eq('id', payment.lease_id)
      .maybeSingle()

    if (!lease) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })

    const orgId = lease.org_id as string

    // Auth: tenant, org member, or admin/staff
    const [{ data: profile }, { count: membership }] = await Promise.all([
      admin.from('users').select('role').eq('id', user.id).single(),
      admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', user.id),
    ])
    const isTenant     = lease.tenant_id === user.id
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!isTenant && !membership && !isAdminStaff) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    if (['paid', 'void'].includes(payment.status)) {
      return NextResponse.json({ error: 'Malipo haya hayawezi kubadilishwa tena' }, { status: 409 })
    }

    const body = await req.json()
    const { proof_url, proof_note } = body
    if (!proof_url?.trim()) return NextResponse.json({ error: 'Kiungo cha ushahidi kinahitajika' }, { status: 400 })

    const now = new Date().toISOString()
    const { data: updated, error } = await admin
      .from('lease_payments')
      .update({
        proof_url:         proof_url.trim(),
        proof_note:        proof_note?.trim() || null,
        proof_uploaded_at: now,
        status:            'proof_uploaded',
        updated_at:        now,
      })
      .eq('id', paymentId)
      .select()
      .single()

    if (error) throw error

    // Notify org owner (non-fatal)
    ;(async () => {
      const { data: ownerRow } = await admin
        .from('organization_members')
        .select('user:users(id, phone, full_name)')
        .eq('organization_id', orgId)
        .eq('role', 'owner')
        .maybeSingle()

      const owner = ownerRow?.user as unknown as { id: string; phone: string | null; full_name: string } | null
      if (!owner) return

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

      try {
        await admin.from('notifications').insert({
          user_id: owner.id,
          title:   '📤 Ushahidi wa Malipo Umepakiwa',
          body:    `Mpangaji amepakia ushahidi wa malipo. Thibitisha ili kusasisha rekodi za kodi.`,
          type:    'rent_proof_uploaded',
          is_read: false,
          data:    JSON.stringify({ payment_id: paymentId, lease_id: payment.lease_id, org_id: orgId }),
        })
      } catch { /* non-fatal */ }

      if (owner.phone) {
        const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
        const msg =
          `📤 *NyumbaFasta — Ushahidi wa Malipo*\n\n` +
          `Mpangaji amepakia ushahidi wa malipo ya kodi.\n\n` +
          `Thibitisha hapa:\n${appUrl}/property/wapangaji/${payment.lease_id}`
        sendTextMessage(formatPhoneNumber(owner.phone), msg).catch(() => {})
      }
    })().catch(() => {})

    return NextResponse.json({ payment: updated })
  } catch (err) {
    console.error('[PATCH /payments/rent/:paymentId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
