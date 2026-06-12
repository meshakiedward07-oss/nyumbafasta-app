import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { mobileCheckout, normalizePhone, detectProvider, buildCallbackUrl, generateExternalId, type MobileProvider } from '@/lib/payments/azampay'

const PRICE_PER_EXTRA = 2_000
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

    const { count, msisdn, provider = 'mpesa' } = await req.json()
    if (!count || count < 1 || count > 20) {
      return NextResponse.json({ error: 'count lazima iwe kati ya 1 na 20' }, { status: 400 })
    }
    if (!msisdn) {
      return NextResponse.json({ error: 'msisdn inahitajika' }, { status: 400 })
    }

    const admin  = createAdminClient()
    const amount = count * PRICE_PER_EXTRA

    // Find active subscription
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, extra_listings, extra_listings_fee')
      .eq('dalali_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .maybeSingle()

    if (!sub) {
      return NextResponse.json({ error: 'Huna subscription inayofanya kazi' }, { status: 400 })
    }

    // Dev mode — activate immediately
    if (IS_MOCK) {
      await admin.from('subscriptions').update({
        extra_listings:     (sub.extra_listings ?? 0) + count,
        extra_listings_fee: (sub.extra_listings_fee ?? 0) + amount,
      }).eq('id', sub.id)

      await admin.from('notifications').insert({
        user_id: user.id,
        title:   '✅ Listings za Ziada Zimeongezwa!',
        body:    `Umefanikiwa kuongeza listings ${count} za ziada. Unaweza sasa kupost listings zaidi.`,
        type:    'subscription_active',
        is_read: false,
        data:    { extra_count: count },
      })

      return NextResponse.json({ success: true, mock: true, added: count, amount })
    }

    // Production — AzamPay mobile checkout
    // Encode sub_id + count into externalId so webhook can decode without schema changes
    // Format: EX-{subscription_uuid}-{count} → 7 dash-separated segments
    const payment_ref   = `EX-${sub.id}-${count}`
    const callbackUrl   = buildCallbackUrl(req.nextUrl.origin, '/api/v1/payments/extra-listings/webhook')
    const accountNumber = normalizePhone(msisdn)
    const azamProvider  = provider ? toAzamProvider(provider) : detectProvider(accountNumber)

    // Insert pending payments row BEFORE calling AzamPay so webhook can update it
    const { data: paymentRow, error: payInsertErr } = await admin
      .from('payments')
      .insert({
        user_id:     user.id,
        amount,
        status:      'pending',
        external_id: payment_ref,
        description: `Extra listings x${count}`,
      })
      .select('id')
      .single()

    if (payInsertErr || !paymentRow) {
      console.error('[ExtraListings] payments insert failed:', payInsertErr)
      return NextResponse.json({ error: 'Imeshindwa kuanzisha malipo' }, { status: 500 })
    }

    const result = await mobileCheckout({
      accountNumber,
      amount,
      externalId:  payment_ref,
      provider:    azamProvider,
      callbackUrl,
    })

    if (!result.ok) {
      await admin.from('payments').delete().eq('id', paymentRow.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    // Webhook will update extra_listings + extra_listings_fee on confirmed payment
    return NextResponse.json({ payment_ref, amount, sub_id: sub.id, extra_count: count })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
