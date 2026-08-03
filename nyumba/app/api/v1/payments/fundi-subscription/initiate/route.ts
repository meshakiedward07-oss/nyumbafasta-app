import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  mobileCheckout, normalizePhone, detectProvider, generateExternalId, webhookUrl,
  type MobileProvider,
} from '@/lib/payments/azampay'
import { rateLimit } from '@/lib/security/rateLimit'

export const maxDuration = 30

const IS_MOCK = process.env.AZAMPAY_MOCK === 'true'

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

// POST /api/v1/payments/fundi-subscription/initiate
// Body: { plan_id, msisdn, provider? }
// Initiates AzamPay STK push for a fundi subscription plan.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    // Rate limit: max 5 attempts per 10 minutes per fundi
    const rl = await rateLimit(`fundi-sub-initiate:${user.id}`, 5, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi sana — subiri dakika 10' }, { status: 429 })
    }

    const { plan_id, msisdn, provider = 'mpesa' } = await req.json()

    if (!plan_id) return NextResponse.json({ error: 'plan_id inahitajika' }, { status: 400 })
    if (!msisdn)  return NextResponse.json({ error: 'msisdn inahitajika kwa mobile money' }, { status: 400 })

    const admin = createAdminClient()

    // Verify caller is a fundi
    const { data: userRow } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userRow || userRow.role !== 'fundi') {
      return NextResponse.json({ error: 'Akaunti ya fundi inahitajika' }, { status: 403 })
    }

    // Fetch plan
    const { data: plan } = await admin
      .from('fundi_subscription_plans')
      .select('id, name, price_tzs, billing_cycle, max_job_forms')
      .eq('id', plan_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!plan) return NextResponse.json({ error: 'Mpango haukupatikana au haujawashwa' }, { status: 404 })

    const amount      = plan.price_tzs
    const payment_ref = generateExternalId('FNSUB')

    // Duration from billing_cycle
    const durationMonths = plan.billing_cycle === 'monthly' ? 1 : plan.billing_cycle === 'quarterly' ? 3 : 12
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths)

    // ── Dev / mock mode ───────────────────────────────────────────────────
    if (IS_MOCK) {
      const { data: sub, error: insertErr } = await admin
        .from('fundi_subscriptions')
        .insert({
          fundi_user_id: user.id,
          plan_id:       plan.id,
          status:        'active',
          payment_ref,
          amount_paid:   amount,
          payment_method: provider,
          starts_at:     new Date().toISOString(),
          expires_at:    expiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      await admin.from('notifications').insert({
        user_id:  user.id,
        title:    '✅ Usajili wa Fundi Umewashwa!',
        body:     `Mpango wako wa ${plan.name} umefanikiwa. Sasa unaweza kujibu maombi ya kazi.`,
        type:     'subscription_active',
        is_read:  false,
      })

      return NextResponse.json({ subscription_id: sub?.id, mock: true, amount })
    }

    // ── Production: AzamPay mobile checkout ──────────────────────────────
    const accountNumber = normalizePhone(msisdn)
    if (!accountNumber.startsWith('255') || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
      return NextResponse.json({
        error: 'Namba ya simu si sahihi. Tumia format ya Tanzania (07XXXXXXXX)',
      }, { status: 400 })
    }

    const azamProvider = toAzamProvider(provider) ?? detectProvider(accountNumber)

    const { data: sub, error: insertErr } = await admin
      .from('fundi_subscriptions')
      .insert({
        fundi_user_id: user.id,
        plan_id:       plan.id,
        status:        'pending',
        payment_ref,
        amount_paid:   amount,
        payment_method: provider,
        starts_at:     new Date().toISOString(),
        expires_at:    expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (insertErr || !sub) throw insertErr ?? new Error('Insert returned null')

    const result = await mobileCheckout({
      accountNumber,
      amount,
      externalId:  payment_ref,
      provider:    azamProvider,
      description: `Usajili wa Fundi — ${plan.name} — NyumbaFasta`,
      callbackUrl: webhookUrl('/api/v1/payments/fundi-subscription/webhook'),
    })

    if (!result.ok) {
      console.error('[FundiSub/initiate] mobileCheckout failed:', result.message)
      await admin.from('fundi_subscriptions').delete().eq('id', sub.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    // Payments audit (non-blocking)
    admin.from('payments').insert({
      external_id:    payment_ref,
      amount,
      currency:       'TZS',
      status:         'pending',
      type:           'fundi_subscription',
      provider:       azamProvider,
      customer_phone: accountNumber,
      dalali_id:      user.id,
      reference_id:   sub.id,
    }).then(({ error: pe }) => {
      if (pe) console.warn('[FundiSub/initiate] payments audit insert failed (non-fatal):', pe.message)
    })

    return NextResponse.json({
      success:         true,
      subscription_id: sub.id,
      payment_ref,
      amount,
      message:         'Subiri USSD popup kwenye simu yako',
    })
  } catch (err: unknown) {
    console.error('[FundiSub/initiate] Unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
