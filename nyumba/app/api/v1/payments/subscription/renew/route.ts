import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  mobileCheckout, normalizePhone, detectProvider,
  buildCallbackUrl, generateExternalId, type MobileProvider,
} from '@/lib/payments/azampay'

const PLAN_PRICES: Record<string, number> = { basic: 10_000, premium: 25_000, enterprise: 50_000 }

function getLoyaltyDiscount(months: number): number {
  if (months >= 12) return 20
  if (months >= 6)  return 15
  if (months >= 3)  return 10
  return 0
}

function applyDiscount(price: number, pct: number): number {
  return Math.round(price * (1 - pct / 100))
}

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

    if (!plan || !['basic', 'premium', 'enterprise'].includes(plan)) {
      return NextResponse.json({ error: 'Plan si sahihi' }, { status: 400 })
    }
    if (!msisdn) {
      return NextResponse.json({ error: 'Namba ya simu inahitajika' }, { status: 400 })
    }

    const accountNumber = normalizePhone(msisdn)
    if (!accountNumber.startsWith('255') || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Namba ya simu si sahihi. Tumia format: 07XXXXXXXX' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Count completed months for loyalty discount
    const { count: completedMonths } = await admin
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('dalali_id', user.id)
      .in('status', ['active', 'expired', 'grace_period'])

    const discount   = getLoyaltyDiscount(completedMonths ?? 0)
    const basePrice  = PLAN_PRICES[plan]
    const finalPrice = applyDiscount(basePrice, discount)

    // Get current subscription to calculate correct start date
    const { data: currentSub } = await admin
      .from('subscriptions')
      .select('id, plan, status, expires_at, grace_period_until')
      .eq('dalali_id', user.id)
      .in('status', ['active', 'grace_period'])
      .order('expires_at', { ascending: false })
      .maybeSingle()

    const now = new Date()
    let startsFrom = now
    if (currentSub?.status === 'active' && currentSub.expires_at) {
      const expiry = new Date(currentSub.expires_at)
      if (expiry > now) startsFrom = expiry
    } else if (currentSub?.status === 'grace_period' && currentSub.grace_period_until) {
      const grace = new Date(currentSub.grace_period_until)
      if (grace > now) startsFrom = grace
    }

    const expiresAt = new Date(startsFrom)
    expiresAt.setDate(expiresAt.getDate() + 30)

    const payment_ref  = generateExternalId('REN')
    const azamProvider = toAzamProvider(provider) ?? detectProvider(accountNumber)

    // Create PENDING subscription — activated only after webhook confirms payment
    const { data: newSub, error: insertError } = await admin
      .from('subscriptions')
      .insert({
        dalali_id:      user.id,
        plan,
        status:         'pending',
        amount_paid:    finalPrice,
        payment_method: provider,
        payment_ref,
        starts_at:      startsFrom.toISOString(),
        expires_at:     expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !newSub) {
      console.error('[Renew] Supabase insert failed:', insertError)
      return NextResponse.json({ error: insertError?.message ?? 'Imeshindwa kuanzisha upya' }, { status: 500 })
    }

    const callbackUrl = buildCallbackUrl(req.nextUrl.origin, '/api/v1/payments/subscription/webhook')

    console.log('[Renew] Calling mobileCheckout — sub:', newSub.id, 'ref:', payment_ref)

    const result = await mobileCheckout({
      accountNumber,
      amount:      finalPrice,
      externalId:  payment_ref,
      provider:    azamProvider,
      callbackUrl,
    })

    if (!result.ok) {
      console.error('[Renew] mobileCheckout failed:', result.message)
      await admin.from('subscriptions').delete().eq('id', newSub.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    console.log('[Renew] Payment initiated ✓ sub:', newSub.id)
    return NextResponse.json({
      success:         true,
      subscription_id: newSub.id,
      payment_ref,
      amount:          finalPrice,
      discount,
      expires_at:      expiresAt.toISOString(),
      message:         'Subiri USSD popup kwenye simu yako',
    })
  } catch (err) {
    console.error('[Renew] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
