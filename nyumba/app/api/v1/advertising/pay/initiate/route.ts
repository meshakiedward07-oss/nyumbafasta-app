import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  mobileCheckout, detectProvider, normalizePhone,
  generateExternalId, buildCallbackUrl,
} from '@/lib/payments/azampay'

export async function POST(req: NextRequest) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { campaign_id, phone } = body

  if (!campaign_id || !phone) {
    return NextResponse.json({ error: 'campaign_id na phone zinahitajika' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load campaign + plan
  const { data: campaign, error: campErr } = await admin
    .from('ad_campaigns')
    .select('*, plan:plan_id (id, name, price_tzs, duration_days)')
    .eq('id', campaign_id)
    .eq('advertiser_id', auth.advertiser.id)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
  }
  if (campaign.status !== 'approved' && campaign.status !== 'pending_review') {
    return NextResponse.json({ error: 'Kampeni haiko tayari kulipwa' }, { status: 400 })
  }
  if (campaign.payment_status === 'completed') {
    return NextResponse.json({ error: 'Kampeni hii imelipwa tayari' }, { status: 409 })
  }

  const plan = campaign.plan as { id: string; name: string; price_tzs: number; duration_days: number }
  const amount = plan.price_tzs
  const externalId = generateExternalId('AD')

  // Record payment
  const { data: payment, error: payErr } = await admin
    .from('ad_payments')
    .insert({
      campaign_id,
      advertiser_id: auth.advertiser.id,
      amount,
      currency:     'TZS',
      phone_number: normalizePhone(phone),
      provider:     detectProvider(phone),
      external_id:  externalId,
      status:       'pending',
    })
    .select('id')
    .single()

  if (payErr || !payment) {
    return NextResponse.json({ error: 'Imeshindwa kuunda rekodi ya malipo' }, { status: 500 })
  }

  // Initiate STK push
  const callbackUrl = buildCallbackUrl(
    req.nextUrl.origin,
    '/api/v1/advertising/pay/webhook'
  )

  const result = await mobileCheckout({
    accountNumber: normalizePhone(phone),
    amount,
    externalId,
    provider:    detectProvider(phone),
    description: `NyumbaFasta Advert — ${plan.name}`,
  })

  if (!result.ok) {
    await admin.from('ad_payments').update({ status: 'failed' }).eq('id', payment.id)
    return NextResponse.json({ error: result.message }, { status: 502 })
  }

  // Update with gateway transaction id
  await admin.from('ad_payments').update({
    transaction_id: result.transactionId,
    callback_url:   callbackUrl,
  }).eq('id', payment.id)

  return NextResponse.json({
    ok:         true,
    payment_id: payment.id,
    message:    result.message,
    amount,
  })
}
