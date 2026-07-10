import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isWebhookSuccess, isAmountValid, getExternalId, verifyWebhookSecret, verifyAzamPaySignature, type WebhookPayload } from '@/lib/payments/azampay'
import { getPricing } from '@/lib/config/pricing'

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[Sub Webhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })  // always 200 so AzamPay doesn't retry
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

    console.log('[Sub Webhook] externalId:', externalId, '| status:', payload.transactionstatus, '| succeeded:', succeeded)

    if (!externalId) {
      console.warn('[Sub Webhook] No externalId in payload — ignoring')
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()

    console.log('[Sub Webhook] Looking for subscription with payment_ref:', externalId)
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('id, dalali_id, plan, status')
      .eq('payment_ref', externalId)
      .maybeSingle()

    console.log('[Sub Webhook] Found subscription:', subscription ? `id=${subscription.id} status=${subscription.status}` : 'NOT FOUND')

    if (!subscription || subscription.status !== 'pending') {
      return NextResponse.json({ received: true })
    }

    const subPrices      = (await getPricing()).subscription
    const PLAN_AMOUNTS   = subPrices as Record<string, number>
    const expectedAmount = PLAN_AMOUNTS[subscription.plan] ?? 0
    if (succeeded && expectedAmount > 0 && !isAmountValid(payload, expectedAmount)) {
      console.warn('[Sub Webhook] Amount mismatch — expected', expectedAmount, 'got:', payload.amount)
      return NextResponse.json({ received: true })
    }

    const newStatus = succeeded ? 'active' : 'failed'
    console.log('[Sub Webhook] Updating subscription status to:', newStatus)

    await admin
      .from('subscriptions')
      .update({ status: newStatus })
      .eq('id', subscription.id)

    // Update payments audit table (non-blocking)
    admin.from('payments').update({
      status:         succeeded ? 'completed' : 'failed',
      transaction_id: payload.transid,
    }).eq('external_id', externalId).then(() => {})

    if (succeeded) {
      // Mark is_premium_verified for premium/enterprise plans
      if (subscription.plan === 'premium' || subscription.plan === 'enterprise') {
        await admin
          .from('dalali_profiles')
          .update({ is_premium_verified: true })
          .eq('id', subscription.dalali_id)
      }

      // Auto-record income (non-blocking)
      import('@/lib/accounting/incomeTracker')
        .then(m => m.recordIncomeFromSubscription(subscription.id))
        .catch(e => console.error('[Accounting] recordIncomeFromSubscription failed (non-fatal):', e))

      const planName = subscription.plan === 'premium' ? 'Premium ⭐' : subscription.plan === 'enterprise' ? 'Enterprise 🏆' : 'Basic'
      await admin.from('notifications').insert({
        user_id: subscription.dalali_id,
        title:   '✅ Subscription Imewashwa!',
        body:    `Plan yako ya ${planName} imefanikiwa. Listings zako zinaonekana kwa wateja.`,
        type:    'subscription_active',
        is_read: false,
        data:    { plan: subscription.plan },
      })
      console.log('[Sub Webhook] Subscription activated + notification sent:', subscription.id)
    }

    // Downgrade is_premium_verified if subscription failed
    if (!succeeded) {
      const { count: otherActiveCount } = await admin
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', subscription.dalali_id)
        .in('plan', ['premium', 'enterprise'])
        .eq('status', 'active')

      if (otherActiveCount === 0) {
        await admin
          .from('dalali_profiles')
          .update({ is_premium_verified: false })
          .eq('id', subscription.dalali_id)
      }
    }

    return NextResponse.json({ received: true, success: succeeded })
  } catch (err) {
    console.error('[Sub Webhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
