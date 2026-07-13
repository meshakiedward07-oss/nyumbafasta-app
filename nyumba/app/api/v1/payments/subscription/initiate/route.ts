import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { mobileCheckout, normalizePhone, detectProvider, generateExternalId, type MobileProvider } from '@/lib/payments/azampay'
import { rateLimit } from '@/lib/security/rateLimit'
import { getPricing } from '@/lib/config/pricing'

export const maxDuration = 30

const PLAN_DURATION_DAYS = 30
const IS_MOCK = process.env.AZAMPAY_MOCK === 'true'

function toAzamProvider(p: string): MobileProvider {
  const map: Record<string, MobileProvider> = {
    mpesa: 'Mpesa', airtel: 'Airtel', tigo: 'Tigo', tigopesa: 'Tigo', halopesa: 'Halopesa', azampesa: 'Azampesa',
    Mpesa: 'Mpesa', Airtel: 'Airtel', Tigo: 'Tigo', Halopesa: 'Halopesa', Azampesa: 'Azampesa',
    AirtelMoney: 'Airtel', Tigopesa: 'Tigo',
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

    const rl = await rateLimit(`sub-initiate:${user.id}`, 5, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi sana — subiri dakika 10' }, { status: 429 })
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

    const planPrices = (await getPricing()).subscription
    const amount     = (planPrices as Record<string, number>)[plan]
    if (!amount) return NextResponse.json({ error: 'Plan haijulikani' }, { status: 400 })
    const admin   = createAdminClient()
    const payment_ref = generateExternalId('SUB')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + PLAN_DURATION_DAYS)

    // ── Dev / mock mode: activate immediately ─────────────
    // (amount already resolved from live pricing above)
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
      })

      return NextResponse.json({ subscription_id: subscription.id, mock: true, amount })
    }

    // ── Production path: AzamPay mobile checkout ──────────
    const accountNumber = normalizePhone(msisdn)
    if (!accountNumber.startsWith('255') || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Namba ya simu si sahihi. Tumia format ya Tanzania (07XXXXXXXX)' }, { status: 400 })
    }

    const azamProvider = provider ? toAzamProvider(provider) : detectProvider(accountNumber)

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
      const errDetail = insertError
        ? { message: insertError.message, code: insertError.code, details: insertError.details, hint: insertError.hint }
        : { message: 'subscription is null after insert (no error)', code: 'NULL_RESULT' }
      console.error('[Sub/initiate] Supabase insert FAILED:', JSON.stringify(errDetail))
      return NextResponse.json({
        error: insertError?.message ?? 'Imeshindwa kuanzisha subscription',
        debug: errDetail,
      }, { status: 500 })
    }

    const result = await mobileCheckout({
      accountNumber,
      amount,
      externalId:  payment_ref,
      provider:    azamProvider,
      description: `Subscription ${plan} — NyumbaFasta`,
    })

    if (!result.ok) {
      console.error('[Sub/initiate] mobileCheckout failed:', result.message)
      await admin.from('subscriptions').delete().eq('id', subscription.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    // Save to payments audit table (non-blocking — if table missing, don't fail)
    admin.from('payments').insert({
      external_id:    payment_ref,
      amount,
      currency:       'TZS',
      status:         'pending',
      type:           'subscription',
      provider:       azamProvider,
      customer_phone: accountNumber,
      dalali_id:      user.id,
      reference_id:   subscription.id,
    }).then(({ error }) => {
      if (error) console.warn('[Sub/initiate] payments table insert failed (non-fatal):', error.message)
    })

    return NextResponse.json({
      success:         true,
      subscription_id: subscription.id,
      payment_ref,
      amount,
      message:         'Subiri USSD popup kwenye simu yako',
    })
  } catch (err: unknown) {
    console.error('[Sub/initiate] Unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
