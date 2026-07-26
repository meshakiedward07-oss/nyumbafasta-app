import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string; leaseId: string; paymentId: string } }

// POST /api/v1/organizations/:id/leases/:leaseId/payments/:paymentId/verify
// Org owner / manager verifies that the uploaded proof is genuine and marks payment as paid.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId, leaseId, paymentId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: m }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canVerify    = isAdminStaff || ['owner', 'branch_manager', 'accountant'].includes(m?.role ?? '')
    if (!canVerify) return NextResponse.json({ error: 'Huna ruhusa ya kuthibitisha malipo' }, { status: 403 })

    const { data: payment } = await admin
      .from('lease_payments')
      .select('id, lease_id, status, amount_due, due_date')
      .eq('id', paymentId)
      .eq('lease_id', leaseId)
      .maybeSingle()

    if (!payment) return NextResponse.json({ error: 'Malipo hayapatikani' }, { status: 404 })
    if (payment.status === 'paid') {
      return NextResponse.json({ error: 'Malipo haya tayari yamethibitishwa' }, { status: 409 })
    }
    if (!['proof_uploaded', 'partial', 'pending'].includes(payment.status)) {
      return NextResponse.json({ error: 'Malipo haya hayawezi kuthibitishwa' }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))
    const { notes } = body
    const now = new Date().toISOString()

    const { data: updated, error: updateErr } = await admin
      .from('lease_payments')
      .update({
        status:       'paid',
        paid_date:    now.split('T')[0],
        amount_paid:  payment.amount_due,
        verified_by:  user.id,
        verified_at:  now,
        notes:        notes?.trim() || null,
        updated_at:   now,
      })
      .eq('id', paymentId)
      .select()
      .single()

    if (updateErr) throw updateErr

    // Notify tenant that payment is confirmed (non-fatal)
    ;(async () => {
      const { data: leaseRow } = await admin
        .from('leases')
        .select('tenant_id, monthly_rent, unit:property_units(unit_number)')
        .eq('id', leaseId)
        .maybeSingle()

      if (!leaseRow) return
      const tenantId  = leaseRow.tenant_id as string
      const unitLabel = (leaseRow.unit as unknown as { unit_number: string } | null)?.unit_number ?? 'kitengo chako'
      const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

      const { data: tenant } = await admin.from('users').select('phone, full_name').eq('id', tenantId).maybeSingle()

      try {
        await admin.from('notifications').insert({
          user_id: tenantId,
          title:   '✅ Malipo ya Kodi Yamethibitishwa',
          body:    `Malipo yako ya kodi ya ${unitLabel} yamethibitishwa. Asante!`,
          type:    'rent_payment_verified',
          is_read: false,
          data:    JSON.stringify({ payment_id: paymentId, lease_id: leaseId }),
        })
      } catch { /* non-fatal */ }

      if (tenant?.phone) {
        const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
        const msg =
          `✅ *NyumbaFasta — Malipo Yamethibitishwa*\n\n` +
          `Habari ${tenant.full_name ?? ''}!\n\n` +
          `Malipo yako ya kodi ya *${unitLabel}* yamethibitishwa na mmiliki.\n\n` +
          `📅 Tarehe: *${new Date(now).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })}*\n\n` +
          `Unaweza kuona rekodi zako za malipo hapa:\n${appUrl}/rent/proof/${paymentId}`
        sendTextMessage(formatPhoneNumber(tenant.phone), msg).catch(() => {})
      }
    })().catch(() => {})

    return NextResponse.json({ payment: updated })
  } catch (err) {
    console.error('[POST /payments/:paymentId/verify]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
