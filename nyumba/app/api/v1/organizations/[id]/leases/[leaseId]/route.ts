import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; leaseId: string }> }

// GET /api/v1/organizations/:id/leases/:leaseId
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: orgId, leaseId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ count: membership }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', user.id),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    // Tenants can also view their own lease
    const { data: leaseCheck } = await admin.from('leases').select('tenant_id').eq('id', leaseId).maybeSingle()
    const isTenant = leaseCheck?.tenant_id === user.id
    if (!membership && !isAdminStaff && !isTenant) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const [leaseRes, paymentsRes, bankingRes] = await Promise.all([
      admin.from('leases').select(`
        *,
        tenant:users!tenant_id(id, full_name, phone, email, avatar_url),
        unit:property_units(id, unit_number, unit_type, monthly_rent),
        listing:listings(id, title, district, region)
      `).eq('id', leaseId).eq('org_id', orgId).single(),
      admin.from('lease_payments').select('*').eq('lease_id', leaseId).order('due_date', { ascending: false }),
      admin.from('organization_banking').select('bank_name, account_name, account_number, branch, mobile_money_number, mobile_money_provider, additional_instructions').eq('org_id', orgId).maybeSingle(),
    ])

    if (leaseRes.error) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })
    return NextResponse.json({ lease: leaseRes.data, payments: paymentsRes.data ?? [], banking: bankingRes.data ?? null })
  } catch (err) {
    console.error('[GET /organizations/:id/leases/:leaseId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/organizations/:id/leases/:leaseId
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId, leaseId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: membership }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const { action } = body

    const { data: current } = await admin.from('leases').select('*').eq('id', leaseId).single()
    if (!current) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })
    if (current.org_id !== orgId && !isAdminStaff) return NextResponse.json({ error: 'Mkataba huu si wa shirika lako' }, { status: 403 })

    const now = new Date().toISOString()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

    function notifyTenant(
      notifTitle: string, notifBody: string, type: string, waMsg: string,
    ) {
      const tenantId = current.tenant_id as string
      ;(async () => {
        try {
          await admin.from('notifications').insert({
            user_id: tenantId, title: notifTitle, body: notifBody,
            type, is_read: false, data: JSON.stringify({ lease_id: leaseId }),
          })
        } catch { /* non-fatal */ }
        const { data: tenant } = await admin.from('users').select('phone').eq('id', tenantId).maybeSingle()
        if (tenant?.phone) {
          const { sendTextMessage, formatPhoneNumber } = await import('@/lib/whatsapp/client')
          sendTextMessage(formatPhoneNumber(tenant.phone), waMsg).catch(() => {})
        }
      })().catch(() => {})
    }

    async function getUnitLabel() {
      const { data: u } = await admin.from('property_units').select('unit_number').eq('id', current.unit_id as string).maybeSingle()
      return (u as { unit_number?: string } | null)?.unit_number ?? 'kitengo chako'
    }

    // ── Renew ──────────────────────────────────────────────────────────────────
    if (action === 'renew') {
      const { new_end_date, new_monthly_rent, notes: renewNotes } = body
      if (!new_end_date) return NextResponse.json({ error: 'Tarehe mpya ya kumalizika inahitajika' }, { status: 400 })
      if (current.status === 'terminated') return NextResponse.json({ error: 'Mkataba uliosimamishwa hauwezi kufanywa upya' }, { status: 409 })

      const currentCount = typeof (current as Record<string, unknown>).renewal_count === 'number'
        ? (current as Record<string, unknown>).renewal_count as number
        : 0
      const updates: Record<string, unknown> = {
        end_date: new_end_date, renewed_at: now,
        renewal_count: currentCount + 1, status: 'active', updated_at: now,
      }
      if (new_monthly_rent && Number(new_monthly_rent) > 0) updates.monthly_rent = Number(new_monthly_rent)
      if (renewNotes !== undefined) updates.notes = renewNotes

      const { data: lease, error } = await admin.from('leases').update(updates).eq('id', leaseId).select().single()
      if (error) throw error

      const unitLabel = await getUnitLabel()
      const endStr = new Date(new_end_date).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
      const rentAmt = updates.monthly_rent ?? current.monthly_rent
      const rentStr = `TZS ${Number(rentAmt).toLocaleString()}`
      notifyTenant(
        '🔄 Mkataba Umefanywa Upya',
        `Mkataba wako wa ${unitLabel} umefanywa upya hadi tarehe ${endStr}. Kodi: ${rentStr}/mwezi.`,
        'lease_renewed',
        `🔄 *NyumbaFasta — Mkataba Umefanywa Upya*\n\nHabari!\n\nMkataba wako wa *${unitLabel}* umefanywa upya:\n📅 Mpaka: *${endStr}*\n💰 Kodi: *${rentStr}/mwezi*\n\n${appUrl}/tenant`,
      )
      return NextResponse.json({ lease })
    }

    // ── Terminate ──────────────────────────────────────────────────────────────
    if (action === 'terminate') {
      const { termination_reason, deposit_refund_amount, deposit_refund_notes: refundNotes } = body
      if (!termination_reason) return NextResponse.json({ error: 'Sababu ya kusimamisha inahitajika' }, { status: 400 })
      if (current.status === 'terminated') return NextResponse.json({ error: 'Mkataba huu tayari umesimamishwa' }, { status: 409 })

      const updates: Record<string, unknown> = {
        status: 'terminated', terminated_at: now, termination_reason, updated_at: now,
      }
      if (deposit_refund_amount !== undefined && deposit_refund_amount !== null && deposit_refund_amount !== '') {
        updates.deposit_refund_amount = Number(deposit_refund_amount)
        updates.deposit_refunded_at = now
        if (refundNotes) updates.deposit_refund_notes = refundNotes
      }

      const { data: lease, error } = await admin.from('leases').update(updates).eq('id', leaseId).select().single()
      if (error) throw error

      await Promise.all([
        admin.from('lease_payments')
          .update({ status: 'void', updated_at: now })
          .eq('lease_id', leaseId)
          .in('status', ['pending', 'partial', 'late', 'proof_uploaded']),
        admin.from('property_units').update({ status: 'vacant', updated_at: now }).eq('id', current.unit_id as string),
      ])

      const unitLabel = await getUnitLabel()
      const reasonMap: Record<string, string> = {
        tenant_request: 'Ombi la mpangaji', landlord_request: 'Ombi la mmiliki',
        non_payment: 'Kutolipa kodi', lease_ended: 'Mkataba umekwisha',
        property_sold: 'Mali iliuzwa', other: 'Nyingine',
      }
      const reasonLabel = reasonMap[termination_reason as string] ?? (termination_reason as string)
      notifyTenant(
        '⚠️ Mkataba Umesimamishwa',
        `Mkataba wako wa ${unitLabel} umesimamishwa. Sababu: ${reasonLabel}.`,
        'lease_terminated',
        `⚠️ *NyumbaFasta — Mkataba Umesimamishwa*\n\nHabari!\n\nMkataba wako wa *${unitLabel}* umesimamishwa.\n📋 Sababu: ${reasonLabel}\n\nWasiliana na mmiliki kwa maswali zaidi.\n${appUrl}/tenant`,
      )
      return NextResponse.json({ lease })
    }

    // ── Deposit received ───────────────────────────────────────────────────────
    if (action === 'deposit_received') {
      if (current.deposit_paid) return NextResponse.json({ error: 'Amana tayari imerekodiwa' }, { status: 409 })

      const { data: lease, error } = await admin
        .from('leases')
        .update({ deposit_paid: true, deposit_paid_at: now, updated_at: now })
        .eq('id', leaseId).select().single()
      if (error) throw error

      const unitLabel = await getUnitLabel()
      const amountStr = current.deposit_amount ? `TZS ${Number(current.deposit_amount).toLocaleString()}` : 'amana'
      notifyTenant(
        '✅ Amana Imerekodiwa',
        `Amana yako ya ${amountStr} ya ${unitLabel} imerekodiwa kwenye mfumo.`,
        'deposit_received',
        `✅ *NyumbaFasta — Amana Imerekodiwa*\n\nHabari!\n\nAmana yako ya *${amountStr}* ya *${unitLabel}* imerekodiwa kwenye mfumo. Asante!`,
      )
      return NextResponse.json({ lease })
    }

    // ── Deposit refund ─────────────────────────────────────────────────────────
    if (action === 'deposit_refund') {
      const { deposit_refund_amount, deposit_refund_notes: refundNotes } = body
      if (!current.deposit_paid) return NextResponse.json({ error: 'Amana haijawahi kulipwa' }, { status: 409 })
      const alreadyRefunded = (current as Record<string, unknown>).deposit_refunded_at
      if (alreadyRefunded) return NextResponse.json({ error: 'Amana tayari imerudishwa' }, { status: 409 })

      const refundAmt = (deposit_refund_amount !== undefined && deposit_refund_amount !== '')
        ? Number(deposit_refund_amount)
        : (current.deposit_amount ?? null)
      const updates: Record<string, unknown> = { deposit_refunded_at: now, updated_at: now }
      if (refundAmt !== null) updates.deposit_refund_amount = refundAmt
      if (refundNotes) updates.deposit_refund_notes = refundNotes

      const { data: lease, error } = await admin.from('leases').update(updates).eq('id', leaseId).select().single()
      if (error) throw error

      const unitLabel = await getUnitLabel()
      const refundStr = refundAmt ? `TZS ${Number(refundAmt).toLocaleString()}` : 'amana'
      notifyTenant(
        '💰 Amana Imerudishwa',
        `Amana ya ${refundStr} ya ${unitLabel} imerudishwa kwako.${refundNotes ? ` Maelezo: ${refundNotes}` : ''}`,
        'deposit_refunded',
        `💰 *NyumbaFasta — Amana Imerudishwa*\n\nHabari!\n\nAmana ya *${refundStr}* ya *${unitLabel}* imerudishwa kwako.${refundNotes ? `\n📋 Maelezo: ${refundNotes}` : ''}\n\nAsante kwa upangaji wako! ${appUrl}/tenant`,
      )
      return NextResponse.json({ lease })
    }

    // ── Generic update (fallback) ──────────────────────────────────────────────
    const { status, termination_reason, end_date, notes, deposit_paid, document_url } = body
    const updates: Record<string, unknown> = { updated_at: now }
    if (status) updates.status = status
    if (termination_reason) updates.termination_reason = termination_reason
    if (end_date) updates.end_date = end_date
    if (notes !== undefined) updates.notes = notes
    if (document_url !== undefined) updates.document_url = document_url || null
    if (deposit_paid !== undefined) {
      updates.deposit_paid = deposit_paid
      updates.deposit_paid_at = deposit_paid ? now : null
    }

    const { data: lease, error } = await admin.from('leases').update(updates).eq('id', leaseId).select().single()
    if (error) throw error

    if (['terminated', 'expired'].includes(status ?? '')) {
      await admin.from('property_units').update({ status: 'vacant', updated_at: now }).eq('id', current.unit_id as string)
    }

    return NextResponse.json({ lease })
  } catch (err) {
    console.error('[PATCH /leases/:leaseId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
