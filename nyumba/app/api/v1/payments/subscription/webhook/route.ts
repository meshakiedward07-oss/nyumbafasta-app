import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isWebhookSuccess, getExternalId, type WebhookPayload } from '@/lib/payments/azampay'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // No signature to verify for AzamPay sandbox.
    // In production, verify by IP allowlist or a shared secret if AzamPay provides one.
    const payload: WebhookPayload = JSON.parse(rawBody)
    const externalId = getExternalId(payload)
    const succeeded = isWebhookSuccess(payload)

    if (!externalId) return NextResponse.json({ received: true })

    const admin = createAdminClient()

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('id, dalali_id, plan, status')
      .eq('payment_ref', externalId)
      .maybeSingle()

    if (!subscription || subscription.status !== 'pending') {
      return NextResponse.json({ received: true })
    }

    await admin
      .from('subscriptions')
      .update({ status: succeeded ? 'active' : 'cancelled' })
      .eq('id', subscription.id)

    if (succeeded) {
      const planName = subscription.plan === 'premium' ? 'Premium ⭐' : 'Basic'
      await admin.from('notifications').insert({
        user_id: subscription.dalali_id,
        title: '✅ Subscription Imewashwa!',
        body: `Plan yako ya ${planName} imefanikiwa. Listings zako zinaonekana kwa wateja.`,
        type: 'subscription_active',
        is_read: false,
        data: { plan: subscription.plan },
      })
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ received: true })
  }
}
