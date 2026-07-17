import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  verifyWebhookSecret, verifyAzamPaySignature,
  isWebhookSuccess, getExternalId, WebhookPayload,
} from '@/lib/payments/azampay'
import {
  notifyAdvertiserPaymentSuccess,
} from '@/lib/ads/adNotifications'

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json() as WebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const valid = await verifyAzamPaySignature(payload)
  if (!valid) {
    console.error('[AdWebhook] Invalid AzamPay signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const externalId = getExternalId(payload)
  if (!externalId) {
    return NextResponse.json({ error: 'Missing external ID' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: payment } = await admin
    .from('ad_payments')
    .select('id, campaign_id, advertiser_id, amount, status')
    .eq('external_id', externalId)
    .maybeSingle()

  if (!payment) {
    console.warn('[AdWebhook] Payment not found for externalId:', externalId)
    return NextResponse.json({ ok: true })  // Acknowledge to avoid retries
  }

  if (payment.status === 'completed') {
    return NextResponse.json({ ok: true })  // Idempotent
  }

  const success = isWebhookSuccess(payload)

  await admin.from('ad_payments').update({
    status:             success ? 'completed' : 'failed',
    gateway_reference:  payload.externalreference ?? null,
    paid_at:            success ? new Date().toISOString() : null,
  }).eq('id', payment.id)

  if (success) {
    // Activate campaign and set expiry based on plan
    const { data: campaign } = await admin
      .from('ad_campaigns')
      .select('id, status, plan:plan_id (duration_days)')
      .eq('id', payment.campaign_id)
      .single()

    if (campaign) {
      const durationDays = (campaign.plan as unknown as { duration_days: number })?.duration_days ?? 30
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      const newStatus = campaign.status === 'approved' ? 'active' : campaign.status

      await admin.from('ad_campaigns').update({
        payment_status: 'completed',
        status:         newStatus,
        starts_at:      new Date().toISOString(),
        expires_at:     expiresAt,
      }).eq('id', payment.campaign_id)

      // Notify advertiser via WhatsApp
      const { data: advertiser } = await admin
        .from('advertisers')
        .select('business_name, whatsapp_number')
        .eq('id', payment.advertiser_id)
        .single()

      const { data: fullCampaign } = await admin
        .from('ad_campaigns')
        .select('ad_type')
        .eq('id', payment.campaign_id)
        .single()

      if (advertiser?.whatsapp_number && fullCampaign) {
        await notifyAdvertiserPaymentSuccess(
          advertiser.whatsapp_number,
          advertiser.business_name,
          fullCampaign.ad_type,
          expiresAt,
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
