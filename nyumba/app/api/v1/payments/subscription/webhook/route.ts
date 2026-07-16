import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  isWebhookSuccess, isAmountValid, getExternalId,
  verifyWebhookSecret, verifyAzamPaySignature,
  type WebhookPayload,
} from '@/lib/payments/azampay'
import { getPricing } from '@/lib/config/pricing'

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[Sub Webhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }
  try {
    const rawBody = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)

    if (!(await verifyAzamPaySignature(payload))) {
      console.warn('[Sub Webhook] RSA signature invalid — rejecting')
      return NextResponse.json({ received: true })
    }

    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)

    console.log('[Sub Webhook] externalId:', externalId, '| succeeded:', succeeded)
    if (!externalId) return NextResponse.json({ received: true })

    const admin       = createAdminClient()
    const confirmedAt = new Date()

    // Peek at the subscription to validate amount before atomic update
    const { data: peek } = await admin
      .from('subscriptions')
      .select('id, plan, starts_at')
      .eq('payment_ref', externalId)
      .eq('status', 'pending')
      .maybeSingle()

    if (!peek) {
      console.log('[Sub Webhook] No pending subscription for', externalId, '— skipping')
      return NextResponse.json({ received: true })
    }

    if (succeeded) {
      const subPrices      = (await getPricing()).subscription
      const expectedAmount = (subPrices as Record<string, number>)[peek.plan] ?? 0
      if (expectedAmount > 0 && !isAmountValid(payload, expectedAmount)) {
        console.warn('[Sub Webhook] Amount mismatch — expected', expectedAmount, 'got:', payload.amount)
        return NextResponse.json({ received: true })
      }
    }

    // ── Atomic status transition ──────────────────────────────────────────────
    // Recalculate billing window on new subscriptions (starts_at in the past).
    // Renewals (starts_at in the future) keep their pre-calculated dates.
    const startsAtInDB = new Date(peek.starts_at ?? confirmedAt)
    const isNewSub     = startsAtInDB <= confirmedAt
    const updateFields: Record<string, unknown> = { status: succeeded ? 'active' : 'failed' }
    if (succeeded && isNewSub) {
      const expiresAt = new Date(confirmedAt)
      expiresAt.setDate(expiresAt.getDate() + 30)
      updateFields.starts_at  = confirmedAt.toISOString()
      updateFields.expires_at = expiresAt.toISOString()
    }

    const { data: updated } = await admin
      .from('subscriptions')
      .update(updateFields)
      .eq('id', peek.id)
      .eq('status', 'pending')        // atomic guard
      .select('id, dalali_id, plan')

    if (!updated || updated.length === 0) {
      console.log('[Sub Webhook] Atomic update found no pending row — already processed:', externalId)
      return NextResponse.json({ received: true })
    }

    const subscription = updated[0]
    console.log('[Sub Webhook] Status →', updateFields.status, 'for subscription:', subscription.id)

    // Payments audit (non-blocking)
    admin.from('payments').update({
      status: succeeded ? 'completed' : 'failed', transaction_id: payload.transid, provider: payload.operator ?? null,
    }).eq('external_id', externalId).then(() => {})

    if (!succeeded) {
      // Revoke premium badge if no other premium/enterprise sub is active
      const { count } = await admin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', subscription.dalali_id)
        .in('plan', ['premium', 'enterprise'])
        .eq('status', 'active')
      if (count === 0) {
        await admin.from('dalali_profiles')
          .update({ is_premium_verified: false })
          .eq('id', subscription.dalali_id)
      }
      return NextResponse.json({ received: true })
    }

    // ── Side effects (only reached by the ONE winning call) ──────────────────

    // Restore all listings that were suspended when previous subscription expired.
    // is_sub_suspended=true listings: just un-suspend them.
    // status='expired' listings with no natural expiry (expires_at IS NULL or future):
    //   these were suspended by the old cron flow — restore them to active.
    await admin.from('listings')
      .update({ is_sub_suspended: false })
      .eq('dalali_id', subscription.dalali_id)
      .eq('is_sub_suspended', true)

    await admin.from('listings')
      .update({ status: 'active' })
      .eq('dalali_id', subscription.dalali_id)
      .eq('status', 'expired')
      .or(`expires_at.is.null,expires_at.gt.${confirmedAt.toISOString()}`)

    // Premium badge for premium/enterprise plans
    if (subscription.plan === 'premium' || subscription.plan === 'enterprise') {
      await admin.from('dalali_profiles')
        .update({ is_premium_verified: true })
        .eq('id', subscription.dalali_id)
    }

    // Income accounting (non-blocking)
    import('@/lib/accounting/incomeTracker')
      .then(m => m.recordIncomeFromSubscription(subscription.id))
      .catch(e => console.error('[Accounting] recordIncomeFromSubscription failed:', e))

    const planName = subscription.plan === 'premium' ? 'Premium ⭐'
      : subscription.plan === 'enterprise' ? 'Enterprise 🏆' : 'Basic'

    await admin.from('notifications').insert({
      user_id: subscription.dalali_id,
      title:   '✅ Subscription Imewashwa!',
      body:    `Plan yako ya ${planName} imefanikiwa. Listings zako zinaonekana kwa wateja.`,
      type:    'subscription_active',
      is_read: false,
    })

    console.log('[Sub Webhook] Activated subscription:', subscription.id, 'plan:', subscription.plan)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Sub Webhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
