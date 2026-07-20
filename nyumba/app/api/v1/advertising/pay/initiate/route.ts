import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  mobileCheckout, detectProvider, normalizePhone, generateExternalId,
} from '@/lib/payments/azampay'
import { rateLimit } from '@/lib/security/rateLimit'
import { auditLog } from '@/lib/security/auditLog'

export async function POST(req: NextRequest) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  // Reject suspended / rejected advertisers — they cannot initiate new payments
  if (auth.advertiser.status === 'suspended' || auth.advertiser.status === 'rejected') {
    return NextResponse.json(
      { error: 'Akaunti yako imesimamishwa au imekataliwa. Wasiliana na msaada.' },
      { status: 403 }
    )
  }

  // Rate limit: 10 payment initiations per 10 minutes per user
  const rl = await rateLimit(`adv_pay:${auth.userId}`, 10, 10 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Maombi mengi. Jaribu tena baadaye.' }, { status: 429 })
  }

  const body = await req.json()
  const { campaign_id, phone, provider: bodyProvider } = body

  if (!campaign_id || !phone) {
    return NextResponse.json({ error: 'campaign_id na phone zinahitajika' }, { status: 400 })
  }

  const admin = createAdminClient()

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

  const plan = campaign.plan as { id: string; name: string; price_tzs: number; duration_days: number } | null
  if (!plan) {
    return NextResponse.json({ error: 'Kampeni haina mpango wa malipo. Wasiliana na msaada.' }, { status: 400 })
  }
  const amount     = plan.price_tzs
  const externalId = generateExternalId('AD')

  const { data: payment, error: payErr } = await admin
    .from('ad_payments')
    .insert({
      campaign_id,
      advertiser_id: auth.advertiser.id,
      amount,
      currency:     'TZS',
      phone_number: normalizePhone(phone),
      provider:     bodyProvider ?? detectProvider(phone),
      external_id:  externalId,
      status:       'pending',
    })
    .select('id')
    .single()

  if (payErr || !payment) {
    return NextResponse.json({ error: 'Imeshindwa kuunda rekodi ya malipo' }, { status: 500 })
  }

  // Initiate STK push — callbackUrl is pre-configured on the AzamPay merchant
  // dashboard and not passed per-request. /api/v1/payments/webhook handles both
  // contact_unlock and ad_payment types via tryProcessAdPayment().
  const result = await mobileCheckout({
    accountNumber: normalizePhone(phone),
    amount,
    externalId,
    provider:    bodyProvider ?? detectProvider(phone),
    description: `NyumbaFasta Advert — ${plan.name}`,
  })

  if (!result.ok) {
    await admin.from('ad_payments').update({ status: 'failed' }).eq('id', payment.id)
    return NextResponse.json({ error: result.message }, { status: 502 })
  }

  await admin.from('ad_payments').update({ transaction_id: result.transactionId }).eq('id', payment.id)

  auditLog({
    action:      'payment_initiated',
    user_id:     auth.userId,
    target_id:   payment.id,
    target_type: 'ad_payment',
    metadata:    { campaign_id, amount, plan_name: plan.name, external_id: externalId },
    severity:    'info',
  }).catch(() => {})

  return NextResponse.json({ ok: true, payment_id: payment.id, message: result.message, amount })
}
