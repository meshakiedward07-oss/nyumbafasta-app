import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  isWebhookSuccess, isAmountValid, getExternalId,
  verifyWebhookSecret, verifyAzamPaySignature,
  type WebhookPayload,
} from '@/lib/payments/azampay'

// POST /api/v1/payments/fundi-subscription/webhook?whsec=...
// AzamPay callback for fundi subscription payments.
export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[FundiSubWebhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }

  try {
    const rawBody  = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)

    if (!(await verifyAzamPaySignature(payload))) {
      console.warn('[FundiSubWebhook] RSA signature invalid — rejecting')
      return NextResponse.json({ received: true })
    }

    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)
    console.log('[FundiSubWebhook] externalId:', externalId, '| succeeded:', succeeded)
    if (!externalId) return NextResponse.json({ received: true })

    const admin = createAdminClient()
    const now   = new Date()

    // Find the pending subscription
    const { data: pending } = await admin
      .from('fundi_subscriptions')
      .select('id, fundi_user_id, plan_id, amount_paid, expires_at')
      .eq('payment_ref', externalId)
      .eq('status', 'pending')
      .maybeSingle()

    if (!pending) {
      console.log('[FundiSubWebhook] No pending subscription for', externalId, '— skipping')
      return NextResponse.json({ received: true })
    }

    // ── Failure path ──────────────────────────────────────────────────────
    if (!succeeded) {
      await admin.from('fundi_subscriptions')
        .update({ status: 'failed' })
        .eq('id', pending.id)
        .eq('status', 'pending')
      console.log('[FundiSubWebhook] Payment failed — sub:', pending.id)
      return NextResponse.json({ received: true })
    }

    // ── Amount validation ─────────────────────────────────────────────────
    const expectedAmount = Number(pending.amount_paid)
    if (expectedAmount > 0 && !isAmountValid(payload, expectedAmount)) {
      console.warn('[FundiSubWebhook] Amount mismatch — expected', expectedAmount, 'got:', payload.amount)
      return NextResponse.json({ received: true })
    }

    // ── Atomic activate ───────────────────────────────────────────────────
    const startsAt = now
    const expiresAt = new Date(pending.expires_at ?? now)
    // If expires_at is in the past (edge case), re-calculate from now
    if (expiresAt <= now) {
      const { data: plan } = await admin
        .from('fundi_subscription_plans')
        .select('billing_cycle')
        .eq('id', pending.plan_id)
        .maybeSingle()
      const months = plan?.billing_cycle === 'quarterly' ? 3 : plan?.billing_cycle === 'annual' ? 12 : 1
      expiresAt.setTime(now.getTime())
      expiresAt.setMonth(expiresAt.getMonth() + months)
    }

    const { data: activated, error: activateErr } = await admin
      .from('fundi_subscriptions')
      .update({
        status:    'active',
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', pending.id)
      .eq('status', 'pending')     // atomic guard — only one webhook wins
      .select('id, fundi_user_id, plan_id')
      .single()

    if (activateErr || !activated) {
      console.log('[FundiSubWebhook] Atomic update missed — already processed:', externalId)
      return NextResponse.json({ received: true })
    }

    console.log('[FundiSubWebhook] Activated fundi subscription:', activated.id)

    // Payments audit (non-blocking)
    admin.from('payments').update({
      status: 'completed',
      transaction_id: payload.transid,
      provider: payload.operator ?? null,
    }).eq('external_id', externalId).then(() => {})

    // ── Income accounting (fire-and-forget) ──────────────────────────────
    import('@/lib/accounting/incomeTracker')
      .then(m => m.recordIncomeFromFundiSubscription(activated.id))
      .catch(e => console.error('[FundiSubWebhook] Income record failed (non-fatal):', e))

    // ── In-app notification ───────────────────────────────────────────────
    const expiryStr = expiresAt.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
    ;(async () => {
      const { data: planRow } = await admin
        .from('fundi_subscription_plans')
        .select('name')
        .eq('id', activated.plan_id)
        .maybeSingle()

      const planName = planRow?.name ?? 'Mpango'
      const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

      admin.from('notifications').insert({
        user_id:  activated.fundi_user_id,
        title:    '✅ Usajili wa Fundi Umewashwa!',
        body:     `Mpango wako wa ${planName} umefanikiwa. Unaweza kujibu maombi ya kazi hadi ${expiryStr}.`,
        type:     'subscription_active',
        is_read:  false,
      }).then(() => {})

      // WhatsApp notification (best-effort)
      const { data: userRow } = await admin
        .from('users')
        .select('full_name, phone')
        .eq('id', activated.fundi_user_id)
        .maybeSingle()

      if (userRow?.phone) {
        const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
        const msg =
          `✅ *Usajili wa Fundi Umewashwa!*\n\n` +
          `Habari ${userRow.full_name ?? ''}!\n\n` +
          `Mpango wako wa *${planName}* umewashwa. Sasa unaweza kujibu maombi ya kazi kupitia NyumbaFasta.\n\n` +
          `📅 Inaisha: *${expiryStr}*\n\n` +
          `👉 ${appUrl}/fundi/dashboard`
        sendTextMessage(formatPhoneNumber(userRow.phone), msg).catch(() => {})
      }
    })().catch(() => {})

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[FundiSubWebhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
