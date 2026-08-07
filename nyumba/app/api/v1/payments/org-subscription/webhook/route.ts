import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  isWebhookSuccess, isAmountValid, getExternalId,
  verifyWebhookSecret, verifyAzamPaySignature,
  type WebhookPayload,
} from '@/lib/payments/azampay'
import { formatPhoneNumber, sendTextMessage } from '@/lib/whatsapp/client'
import { recordIncomeFromOrgSubscription } from '@/lib/accounting/incomeTracker'

// POST /api/v1/payments/org-subscription/webhook?whsec=...
// AzamPay callback for organization subscription payments.
export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[OrgSubWebhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }

  try {
    const rawBody  = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)

    if (!(await verifyAzamPaySignature(payload))) {
      console.warn('[OrgSubWebhook] RSA signature invalid — rejecting')
      return NextResponse.json({ received: true })
    }

    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)
    console.log('[OrgSubWebhook] externalId:', externalId, '| succeeded:', succeeded)
    if (!externalId) return NextResponse.json({ received: true })

    const admin = createAdminClient()
    const now   = new Date()

    // Find the pending invoice
    const { data: invoice } = await admin
      .from('subscription_invoices')
      .select('id, org_id, plan_id, amount_tzs, billing_cycle, status')
      .eq('payment_reference', externalId)
      .eq('status', 'pending')
      .maybeSingle()

    if (!invoice) {
      console.log('[OrgSubWebhook] No pending invoice for', externalId, '— skipping')
      return NextResponse.json({ received: true })
    }

    // ── Failure path ──────────────────────────────────────────────────────────
    if (!succeeded) {
      await admin.from('subscription_invoices')
        .update({ status: 'void', voided_at: now.toISOString(), void_reason: 'Malipo yalikataliwa na mtoaji' })
        .eq('id', invoice.id)
        .eq('status', 'pending')  // atomic guard
      console.log('[OrgSubWebhook] Payment failed for invoice:', invoice.id)
      return NextResponse.json({ received: true })
    }

    // ── Success path ──────────────────────────────────────────────────────────

    if (!isAmountValid(payload, invoice.amount_tzs)) {
      console.warn('[OrgSubWebhook] Amount mismatch — voiding invoice. expected:', invoice.amount_tzs, 'got:', payload.amount)
      await admin.from('subscription_invoices')
        .update({ status: 'void', voided_at: now.toISOString(), void_reason: 'Kiasi cha malipo hakikuendana na invoice' })
        .eq('id', invoice.id)
        .eq('status', 'pending')
      return NextResponse.json({ received: true })
    }

    // Compute the new subscription period end date from billing_cycle
    const cycleMonths = invoice.billing_cycle === 'monthly' ? 1 : invoice.billing_cycle === 'quarterly' ? 3 : 12
    const periodEnd   = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + cycleMonths)

    // Confirm the invoice atomically
    const { data: confirmedInv, error: invConfirmErr } = await admin
      .from('subscription_invoices')
      .update({
        status:       'confirmed',
        confirmed_at: now.toISOString(),
        updated_at:   now.toISOString(),
      })
      .eq('id', invoice.id)
      .eq('status', 'pending')  // atomic guard — only one webhook wins
      .select('id')
      .single()

    if (invConfirmErr || !confirmedInv) {
      console.log('[OrgSubWebhook] Atomic confirm found no pending invoice — already processed:', externalId)
      return NextResponse.json({ received: true })
    }

    // Upsert organization_subscriptions: activate the new plan + extend period
    const { data: existingSub } = await admin
      .from('organization_subscriptions')
      .select('id, status, current_period_end')
      .eq('org_id', invoice.org_id)
      .maybeSingle()

    if (existingSub) {
      // Extend from the later of now or the current period end (renewal stacking)
      const currentEnd = existingSub.current_period_end ? new Date(existingSub.current_period_end) : now
      const stackFrom  = currentEnd > now ? currentEnd : now
      const newEnd     = new Date(stackFrom)
      newEnd.setMonth(newEnd.getMonth() + cycleMonths)

      await admin.from('organization_subscriptions').update({
        plan_id:              invoice.plan_id,
        status:               'active',
        current_period_start: now.toISOString(),
        current_period_end:   newEnd.toISOString(),
        cancelled_at:         null,
        cancellation_reason:  null,
        pending_plan_id:      null,
        pending_plan_starts_at: null,
        updated_at:           now.toISOString(),
      }).eq('id', existingSub.id)
    } else {
      await admin.from('organization_subscriptions').insert({
        org_id:               invoice.org_id,
        plan_id:              invoice.plan_id,
        status:               'active',
        current_period_start: now.toISOString(),
        current_period_end:   periodEnd.toISOString(),
      })
    }

    console.log('[OrgSubWebhook] Activated org subscription. org:', invoice.org_id, 'period_end:', periodEnd.toISOString())

    // ── Record in central income_records (fire-and-forget) ───────────────────
    recordIncomeFromOrgSubscription(confirmedInv.id)
      .catch(err => console.error('[OrgSubWebhook] Income record error (non-fatal):', err))

    // ── Notify org owner (best-effort) ────────────────────────────────────────
    ;(async () => {
      const { data: ownerRow } = await admin
        .from('organization_members')
        .select('user:users(id, phone, full_name)')
        .eq('organization_id', invoice.org_id)
        .eq('role', 'owner')
        .maybeSingle()

      const owner = ownerRow?.user as unknown as { id: string; phone: string | null; full_name: string } | null
      if (!owner) return

      const { data: planRow } = await admin
        .from('subscription_plans')
        .select('name')
        .eq('id', invoice.plan_id ?? '')
        .maybeSingle()

      const planName   = planRow?.name ?? 'Mpango'
      const periodStr  = periodEnd.toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
      const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

      // In-app notification
      try {
        await admin.from('notifications').insert({
          user_id: owner.id,
          title:   '✅ Usajili Umewashwa!',
          body:    `Mpango wako wa ${planName} umefanikiwa. Huduma zote zinapatikana hadi ${periodStr}.`,
          type:    'subscription_active',
          is_read: false,
        })
      } catch { /* non-fatal */ }

      // WhatsApp
      if (owner.phone) {
        const msg =
          `✅ *NyumbaFasta — Usajili Umewashwa!*\n\n` +
          `Habari ${owner.full_name ?? ''}!\n\n` +
          `Malipo ya *${planName}* yamepokelewa. Huduma zako zote zinapatikana.\n\n` +
          `📅 Usajili unaisha: *${periodStr}*\n\n` +
          `👉 ${appUrl}/property/usajili`
        sendTextMessage(formatPhoneNumber(owner.phone), msg).catch(() => {})
      }
    })().catch(() => {})

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[OrgSubWebhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
