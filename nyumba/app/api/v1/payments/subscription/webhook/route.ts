import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/selcom'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const digest = req.headers.get('Digest') ?? ''
    const ts = req.headers.get('Timestamp') ?? ''

    if (!verifyWebhookSignature(rawBody, digest, ts)) {
      return NextResponse.json({ error: 'Signature batili' }, { status: 401 })
    }

    const { order_id, resultcode, result } = JSON.parse(rawBody)
    if (!order_id) return NextResponse.json({ received: true })

    const admin = createAdminClient()

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('id, dalali_id, plan, status')
      .eq('payment_ref', order_id)
      .maybeSingle()

    if (!subscription || subscription.status !== 'pending') {
      return NextResponse.json({ received: true })
    }

    const succeeded = resultcode === '000' || result === 'SUCCESS'

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
