import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { mobileCheckout, normalizePhone, detectProvider, webhookUrl, type MobileProvider } from '@/lib/payments/azampay'
import { getPricing } from '@/lib/config/pricing'
import { rateLimit } from '@/lib/security/rateLimit'

export const maxDuration = 30

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
  let paymentRowId: string | null = null
  const admin = createAdminClient()
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    // Rate limit: 5 per 10 minutes per user
    const rl = await rateLimit(`extra_listings:${user.id}`, 5, 10 * 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi. Jaribu tena baadaye.' }, { status: 429 })
    }

    const { count, msisdn, provider = 'mpesa' } = await req.json()
    const PRICE_PER_EXTRA = (await getPricing()).extraListing
    if (!count || count < 1 || count > 20) {
      return NextResponse.json({ error: 'count lazima iwe kati ya 1 na 20' }, { status: 400 })
    }
    if (!msisdn) {
      return NextResponse.json({ error: 'msisdn inahitajika' }, { status: 400 })
    }

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
      })

      return NextResponse.json({ success: true, mock: true, added: count, amount })
    }

    // Production — AzamPay mobile checkout
    // Include sub.id and count in ref so existing-format webhooks can still decode,
    // plus a timestamp suffix so duplicate purchases get unique refs (no UNIQUE collision).
    // Format: EX-{subscription_uuid}-{count}-{ts36} → 8 dash-separated segments
    const payment_ref   = `EX-${sub.id}-${count}-${Date.now().toString(36)}`
    const accountNumber = normalizePhone(msisdn)
    // Bug #4 fix: validate normalized phone before sending to AzamPay
    if (!accountNumber.startsWith('255') || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Namba ya simu si sahihi. Tumia format ya Tanzania (07XXXXXXXX)' }, { status: 400 })
    }
    const azamProvider  = provider ? toAzamProvider(provider) : detectProvider(accountNumber)

    // Insert pending payments row BEFORE calling AzamPay so webhook can update it.
    // external_id is UNIQUE — duplicate inserts will fail, preventing replay attacks.
    const { data: paymentRow, error: payInsertErr } = await admin
      .from('payments')
      .insert({
        dalali_id:    user.id,
        amount,
        currency:     'TZS',
        status:       'pending',
        type:         'extra_listings',
        external_id:  payment_ref,
        reference_id: sub.id,
      })
      .select('id')
      .single()

    if (payInsertErr || !paymentRow) {
      console.error('[ExtraListings] payments insert failed:', payInsertErr)
      return NextResponse.json({ error: 'Imeshindwa kuanzisha malipo' }, { status: 500 })
    }
    paymentRowId = paymentRow.id

    const result = await mobileCheckout({
      accountNumber,
      amount,
      externalId:  payment_ref,
      provider:    azamProvider,
      description: `Listings za ziada x${count} — NyumbaFasta`,
      callbackUrl: webhookUrl('/api/v1/payments/extra-listings/webhook'),
    })

    if (!result.ok) {
      await admin.from('payments').delete().eq('id', paymentRow.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    // Webhook will update extra_listings + extra_listings_fee on confirmed payment
    return NextResponse.json({ payment_ref, amount, sub_id: sub.id, extra_count: count })
  } catch (err) {
    console.error('[ExtraListings/initiate] Unexpected error:', err)
    if (paymentRowId) {
      admin.from('payments').delete().eq('id', paymentRowId).then(() => {})
    }
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
