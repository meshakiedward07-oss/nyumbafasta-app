import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { initiateStkPush, initiateCardPayment } from '@/lib/selcom'

const PLAN_PRICES: Record<string, number> = { basic: 10_000, premium: 25_000, enterprise: 50_000 }
const PLAN_DURATION_DAYS = 30
const IS_DEV = !process.env.SELCOM_API_KEY || process.env.SELCOM_API_KEY.startsWith('test_')

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { plan, msisdn, provider = 'mpesa', payment_type = 'mobile' } = await req.json()

    if (!plan) {
      return NextResponse.json({ error: 'plan inahitajika' }, { status: 400 })
    }
    if (payment_type === 'mobile' && !msisdn) {
      return NextResponse.json({ error: 'msisdn inahitajika kwa mobile money' }, { status: 400 })
    }
    if (!['basic', 'premium', 'enterprise'].includes(plan)) {
      return NextResponse.json({ error: 'Plan si sahihi' }, { status: 400 })
    }

    const amount  = PLAN_PRICES[plan]
    const admin   = createAdminClient()
    const payment_ref = `SUB-${user.id.slice(0, 8)}-${Date.now()}`
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + PLAN_DURATION_DAYS)

    // ── Dev / mock mode: activate immediately ─────────────
    if (IS_DEV) {
      const { data: subscription, error: insertError } = await admin
        .from('subscriptions')
        .insert({
          dalali_id:      user.id,
          plan,
          status:         'active',
          amount_paid:    amount,
          payment_method: provider,
          payment_ref,
          starts_at:      new Date().toISOString(),
          expires_at:     expiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !subscription) {
        return NextResponse.json({ error: insertError?.message ?? 'Imeshindwa kuunda subscription' }, { status: 500 })
      }

      const planName = plan === 'premium' ? 'Premium ⭐' : 'Basic'
      await admin.from('notifications').insert({
        user_id:  user.id,
        title:    '✅ Subscription Imewashwa!',
        body:     `Plan yako ya ${planName} imefanikiwa. Listings zako zinaonekana kwa wateja.`,
        type:     'subscription_active',
        is_read:  false,
        data:     { plan },
      })

      return NextResponse.json({ subscription_id: subscription.id, mock: true, amount })
    }

    // ── Production paths ──────────────────────────────────
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/v1/payments/subscription/webhook`

    // ── Card payment ──────────────────────────────────────
    if (payment_type === 'card') {
      const { data: userData } = await admin
        .from('users')
        .select('email, full_name')
        .eq('id', user.id)
        .single()

      const { data: subscription, error: insertError } = await admin
        .from('subscriptions')
        .insert({
          dalali_id:      user.id,
          plan,
          status:         'pending',
          amount_paid:    amount,
          payment_method: provider,
          payment_ref,
          starts_at:      new Date().toISOString(),
          expires_at:     expiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !subscription) {
        return NextResponse.json({ error: 'Imeshindwa kuanzisha subscription' }, { status: 500 })
      }

      const result = await initiateCardPayment({
        order_id:    payment_ref,
        amount,
        webhook_url: webhookUrl,
        buyer_email: userData?.email ?? '',
        buyer_name:  userData?.full_name ?? 'Dalali',
      })

      if (!result.ok) {
        await admin.from('subscriptions').delete().eq('id', subscription.id)
        return NextResponse.json({ error: result.error }, { status: 502 })
      }

      return NextResponse.json({
        subscription_id: subscription.id,
        payment_url:     result.payment_url,
        amount,
      })
    }

    // ── Mobile money STK push ─────────────────────────────
    const normalizedMsisdn = msisdn.startsWith('+') ? msisdn.slice(1)
      : msisdn.startsWith('0') ? `255${msisdn.slice(1)}`
      : msisdn.startsWith('255') ? msisdn : `255${msisdn}`

    const { data: subscription, error: insertError } = await admin
      .from('subscriptions')
      .insert({
        dalali_id:      user.id,
        plan,
        status:         'pending',
        amount_paid:    amount,
        payment_method: provider,
        payment_ref,
        starts_at:      new Date().toISOString(),
        expires_at:     expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !subscription) {
      return NextResponse.json({ error: 'Imeshindwa kuanzisha subscription' }, { status: 500 })
    }

    const result = await initiateStkPush({
      order_id:    payment_ref,
      msisdn:      normalizedMsisdn,
      amount,
      webhook_url: webhookUrl,
      provider,
    })

    if (!result.ok) {
      await admin.from('subscriptions').delete().eq('id', subscription.id)
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ subscription_id: subscription.id, payment_ref, amount })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
