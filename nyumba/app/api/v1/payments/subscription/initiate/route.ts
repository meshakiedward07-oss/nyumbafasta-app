import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { mobileCheckout, normalizePhone, detectProvider, generateExternalId, type MobileProvider } from '@/lib/payments/azampay'

const PLAN_PRICES: Record<string, number> = { basic: 10_000, premium: 25_000, enterprise: 50_000 }
const PLAN_DURATION_DAYS = 30
const IS_MOCK = process.env.AZAMPAY_MOCK === 'true'

function toAzamProvider(p: string): MobileProvider {
  const map: Record<string, MobileProvider> = {
    mpesa: 'Mpesa', airtel: 'AirtelMoney', tigopesa: 'Tigopesa', halopesa: 'Halopesa',
    Mpesa: 'Mpesa', AirtelMoney: 'AirtelMoney', Tigopesa: 'Tigopesa', Halopesa: 'Halopesa',
  }
  return map[p] ?? 'Mpesa'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { plan, msisdn, provider = 'mpesa' } = await req.json()

    if (!plan) {
      return NextResponse.json({ error: 'plan inahitajika' }, { status: 400 })
    }
    if (!msisdn) {
      return NextResponse.json({ error: 'msisdn inahitajika kwa mobile money' }, { status: 400 })
    }
    if (!['basic', 'premium', 'enterprise'].includes(plan)) {
      return NextResponse.json({ error: 'Plan si sahihi' }, { status: 400 })
    }

    const amount  = PLAN_PRICES[plan]
    const admin   = createAdminClient()
    const payment_ref = generateExternalId('SUB')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + PLAN_DURATION_DAYS)

    // ── Dev / mock mode: activate immediately ─────────────
    if (IS_MOCK) {
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

    // ── Production path: AzamPay mobile checkout ──────────
    const callbackUrl   = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/v1/payments/subscription/webhook`
    const accountNumber = normalizePhone(msisdn)
    const azamProvider  = provider ? toAzamProvider(provider) : detectProvider(accountNumber)

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

    const result = await mobileCheckout({
      accountNumber,
      amount,
      externalId:  payment_ref,
      provider:    azamProvider,
      callbackUrl,
    })

    if (!result.ok) {
      await admin.from('subscriptions').delete().eq('id', subscription.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    return NextResponse.json({ subscription_id: subscription.id, payment_ref, amount })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
