import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; leaseId: string; paymentId: string }> }

// PATCH /api/v1/organizations/:id/leases/:leaseId/payments/:paymentId
// Actions:
//   action='void'       — void/cancel a payment
//   action='mark_paid'  — manually record cash receipt
//   action='remind'     — send WhatsApp + in-app reminder to tenant
export async function PATCH(req: NextRequest, { params }: Params) {
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
    const canWrite = isAdminStaff || ['owner', 'branch_manager', 'accountant'].includes(m?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data: payment } = await admin
      .from('lease_payments')
      .select('id, lease_id, status, amount_due, due_date, invoice_sent_at')
      .eq('id', paymentId)
      .eq('lease_id', leaseId)
      .maybeSingle()

    if (!payment) return NextResponse.json({ error: 'Malipo hayapatikani' }, { status: 404 })

    const body = await req.json()
    const { action, amount_paid, payment_method, reference, notes, paid_date } = body
    const now = new Date().toISOString()

    // ── Void ───────────────────────────────────────────────────────────────────
    if (action === 'void') {
      if (payment.status === 'void') {
        return NextResponse.json({ error: 'Malipo tayari yamebatilishwa' }, { status: 409 })
      }
      const { data: updated, error } = await admin
        .from('lease_payments')
        .update({ status: 'void', notes: notes?.trim() || null, updated_at: now })
        .eq('id', paymentId)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ payment: updated })
    }

    // ── Mark paid manually ─────────────────────────────────────────────────────
    if (action === 'mark_paid') {
      if (payment.status === 'paid') {
        return NextResponse.json({ error: 'Malipo tayari yamelipwa' }, { status: 409 })
      }
      const { data: updated, error } = await admin
        .from('lease_payments')
        .update({
          status:         'paid',
          amount_paid:    amount_paid    ?? payment.amount_due,
          paid_date:      paid_date      ?? now.split('T')[0],
          payment_method: payment_method || null,
          reference:      reference?.trim() || null,
          notes:          notes?.trim()     || null,
          verified_by:    user.id,
          verified_at:    now,
          updated_at:     now,
        })
        .eq('id', paymentId)
        .select()
        .single()
      if (error) throw error

      // Notify tenant (non-fatal)
      ;(async () => {
        const { data: lease } = await admin
          .from('leases')
          .select('tenant_id, unit:property_units(unit_number)')
          .eq('id', leaseId)
          .maybeSingle()
        if (!lease) return
        const unitLabel = (lease.unit as unknown as { unit_number: string } | null)?.unit_number ?? 'kitengo chako'
        const { data: tenant } = await admin.from('users').select('phone, full_name').eq('id', lease.tenant_id as string).maybeSingle()
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
        try {
          await admin.from('notifications').insert({
            user_id: lease.tenant_id,
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
            `Malipo yako ya kodi ya *${unitLabel}* yamethibitishwa.\n\n` +
            `Rekodi yako:\n${appUrl}/rent/proof/${paymentId}`
          sendTextMessage(formatPhoneNumber(tenant.phone), msg).catch(() => {})
        }
      })().catch(() => {})

      return NextResponse.json({ payment: updated })
    }

    // ── Remind tenant ──────────────────────────────────────────────────────────
    if (action === 'remind') {
      const { data: lease } = await admin
        .from('leases')
        .select('tenant_id, unit:property_units(unit_number)')
        .eq('id', leaseId)
        .maybeSingle()
      if (!lease) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })

      const { data: tenant } = await admin
        .from('users')
        .select('id, phone, full_name')
        .eq('id', lease.tenant_id as string)
        .maybeSingle()
      if (!tenant) return NextResponse.json({ error: 'Mpangaji haupatikani' }, { status: 404 })

      const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
      const unitLabel = (lease.unit as unknown as { unit_number: string } | null)?.unit_number ?? 'kitengo chako'
      const amount    = `TZS ${payment.amount_due.toLocaleString()}`
      const dueStr    = new Date(payment.due_date).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })

      try {
        await admin.from('notifications').insert({
          user_id: tenant.id,
          title:   '⏰ Kukumbusha: Malipo ya Kodi',
          body:    `Kodi yako ya ${amount} ya ${unitLabel} inastahili kulipwa tarehe ${dueStr}.`,
          type:    'rent_reminder',
          is_read: false,
          data:    JSON.stringify({ payment_id: paymentId, lease_id: leaseId }),
        })
      } catch { /* non-fatal */ }

      if (tenant.phone) {
        const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
        const msg =
          `⏰ *NyumbaFasta — Kukumbusha Kodi*\n\n` +
          `Habari ${tenant.full_name ?? ''}!\n\n` +
          `Kodi ya *${unitLabel}*:\n` +
          `💰 Kiasi: *${amount}*\n` +
          `📅 Inastahili: *${dueStr}*\n\n` +
          `Lipa na pakia ushahidi hapa:\n${appUrl}/rent/proof/${paymentId}`
        await sendTextMessage(formatPhoneNumber(tenant.phone), msg).catch(() => {})
      }

      return NextResponse.json({ ok: true, message: 'Ukumbusho umetumwa' })
    }

    // ── Send invoice ───────────────────────────────────────────────────────────
    if (action === 'send_invoice') {
      if (['paid', 'void'].includes(payment.status)) {
        return NextResponse.json({ error: 'Malipo haya hayawezi kupata ankara' }, { status: 409 })
      }
      const { data: updated, error } = await admin
        .from('lease_payments')
        .update({ invoice_sent_at: now, updated_at: now })
        .eq('id', paymentId)
        .select()
        .single()
      if (error) throw error

      // Notify tenant (non-fatal)
      ;(async () => {
        const { data: lease } = await admin
          .from('leases')
          .select('tenant_id, unit:property_units(unit_number)')
          .eq('id', leaseId)
          .maybeSingle()
        if (!lease) return
        const { data: tenant } = await admin.from('users').select('id, phone, full_name').eq('id', lease.tenant_id as string).maybeSingle()
        if (!tenant) return
        const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
        const unitLabel = (lease.unit as unknown as { unit_number: string } | null)?.unit_number ?? 'kitengo chako'
        const amount    = `TZS ${payment.amount_due.toLocaleString()}`
        const dueStr    = new Date(payment.due_date).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
        try {
          await admin.from('notifications').insert({
            user_id: tenant.id,
            title:   '🧾 Ankara ya Kodi Imetumwa',
            body:    `Ankara ya kodi ya ${amount} ya ${unitLabel} imetumwa. Inastahili tarehe ${dueStr}.`,
            type:    'rent_invoice',
            is_read: false,
            data:    JSON.stringify({ payment_id: paymentId, lease_id: leaseId }),
          })
        } catch { /* non-fatal */ }
        if (tenant.phone) {
          const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
          const msg =
            `🧾 *NyumbaFasta — Ankara ya Kodi*\n\n` +
            `Habari ${tenant.full_name ?? ''}!\n\n` +
            `Ankara ya kodi ya *${unitLabel}*:\n` +
            `💰 Kiasi: *${amount}*\n` +
            `📅 Inastahili: *${dueStr}*\n\n` +
            `Lipa na pakia ushahidi hapa:\n${appUrl}/rent/proof/${paymentId}`
          sendTextMessage(formatPhoneNumber(tenant.phone), msg).catch(() => {})
        }
      })().catch(() => {})

      return NextResponse.json({ payment: updated })
    }

    return NextResponse.json({ error: 'Tendo halijulikani' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /payments/:paymentId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
