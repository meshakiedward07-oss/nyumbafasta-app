import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  mobileCheckout, normalizePhone, detectProvider,
  generateExternalId, type MobileProvider,
} from '@/lib/payments/azampay'
import { rateLimit } from '@/lib/security/rateLimit'
import { getPricing } from '@/lib/config/pricing'

// POST /api/v1/payments/subscription/upgrade
// Body: { to_plan: 'premium'|'enterprise', msisdn: string, provider?: string }
//
// Calculates a prorated upgrade amount (credit for unused days on current plan)
// then initiates an AzamPay mobile-money checkout.
//
// NOTE — Webhook handling:
//   When the AzamPay webhook receives a callback for a ref starting with 'UPG-',
//   the existing /api/v1/payments/webhook/route.ts should upgrade the dalali's
//   plan in the subscriptions table to `to_plan` and update the payments row
//   to status='completed'. The webhook currently handles SUB-, REN-, BST-, and
//   NYU- prefixes; an 'UPG-' branch should be added there to finalise upgrades.

const PLAN_ORDER: Record<string, number> = { basic: 1, premium: 2, enterprise: 3 }

function toAzamProvider(p: string): MobileProvider {
  const map: Record<string, MobileProvider> = {
    mpesa: 'Mpesa', airtel: 'Airtel', tigo: 'Tigo', tigopesa: 'Tigo',
    halopesa: 'Halopesa', azampesa: 'Azampesa',
    Mpesa: 'Mpesa', Airtel: 'Airtel', Tigo: 'Tigo',
    Halopesa: 'Halopesa', Azampesa: 'Azampesa',
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

    // Rate limit: 3 requests per 10 minutes per user
    const rl = await rateLimit(`sub-upgrade:${user.id}`, 3, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi sana — subiri dakika 10' }, { status: 429 })
    }

    const { to_plan, msisdn, provider = 'mpesa' } = await req.json()

    if (!to_plan || !['premium', 'enterprise'].includes(to_plan)) {
      return NextResponse.json({ error: 'to_plan lazima iwe premium au enterprise' }, { status: 400 })
    }
    if (!msisdn) {
      return NextResponse.json({ error: 'msisdn inahitajika kwa mobile money' }, { status: 400 })
    }

    const accountNumber = normalizePhone(msisdn)
    if (!accountNumber.startsWith('255') || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Namba ya simu si sahihi. Tumia format ya Tanzania (07XXXXXXXX)' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Fetch active subscription
    const { data: currentSub, error: subError } = await admin
      .from('subscriptions')
      .select('id, plan, status, expires_at, amount_paid')
      .eq('dalali_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) {
      console.error('[Sub/upgrade] subscription fetch error:', subError)
      return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
    }

    if (!currentSub) {
      return NextResponse.json({ error: 'Hakuna usajili wa kuboresha. Jiandikishe kwanza.' }, { status: 404 })
    }

    if (currentSub.plan === to_plan) {
      return NextResponse.json({ error: `Uko tayari kwenye mpango wa ${to_plan}` }, { status: 400 })
    }

    if ((PLAN_ORDER[to_plan] ?? 0) <= (PLAN_ORDER[currentSub.plan] ?? 0)) {
      return NextResponse.json({ error: 'Unaweza tu kupanda mpango — si kushuka' }, { status: 400 })
    }

    // ── Prorate calculation ────────────────────────────────────────────────────
    const now         = Date.now()
    const expiresAt   = currentSub.expires_at ? new Date(currentSub.expires_at).getTime() : now
    const daysRemaining = Math.max(0, (expiresAt - now) / (1000 * 60 * 60 * 24))
    const totalDays     = 30

    const pricing           = await getPricing()
    const currentPlanPrice  = (pricing.subscription as Record<string, number>)[currentSub.plan] ?? 0
    const newPlanPrice      = (pricing.subscription as Record<string, number>)[to_plan] ?? 0

    if (!newPlanPrice) {
      return NextResponse.json({ error: 'Mpango wa bei haupatikani' }, { status: 400 })
    }

    const creditRemaining = (daysRemaining / totalDays) * currentPlanPrice
    const upgradeAmount   = Math.max(1000, Math.round(newPlanPrice - creditRemaining))

    // ── Generate ref and create pending payments record ────────────────────────
    const payment_ref   = generateExternalId('UPG')
    const azamProvider  = toAzamProvider(provider) ?? detectProvider(accountNumber)

    const { data: paymentRow, error: insertError } = await admin
      .from('payments')
      .insert({
        type:        'upgrade',
        dalali_id:   user.id,
        amount:      upgradeAmount,
        currency:    'TZS',
        external_id: payment_ref,
        status:      'pending',
        provider:    azamProvider,
        created_at:  new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !paymentRow) {
      console.error('[Sub/upgrade] payments insert failed:', insertError)
      return NextResponse.json({
        error: insertError?.message ?? 'Imeshindwa kuanzisha malipo ya kuboresha',
      }, { status: 500 })
    }

    // ── AzamPay checkout ───────────────────────────────────────────────────────
    const result = await mobileCheckout({
      accountNumber,
      amount:      upgradeAmount,
      externalId:  payment_ref,
      provider:    azamProvider,
      description: `Panda mpango wa NyumbaFasta hadi ${to_plan}`,
    })

    if (!result.ok) {
      console.error('[Sub/upgrade] mobileCheckout failed:', result.message)
      await admin.from('payments').update({ status: 'failed' }).eq('id', paymentRow.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    return NextResponse.json({
      payment_ref,
      amount:         upgradeAmount,
      credit_applied: Math.round(creditRemaining),
      to_plan,
      message:        'Angalia simu yako kwa idhini ya malipo',
    })

  } catch (err) {
    console.error('[Sub/upgrade] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
