import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  verifyWebhookSecret, verifyAzamPaySignature,
  getExternalId, WebhookPayload,
} from '@/lib/payments/azampay'
import { tryProcessAdPayment } from '@/lib/ads/processAdPayment'

// Secondary webhook endpoint — kept for explicit AzamPay sub-account routing.
// The primary dispatch path is /api/v1/payments/webhook which handles both
// contact_unlock and ad_payment types via tryProcessAdPayment().
export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[AdWebhook] Invalid webhook secret')
    return NextResponse.json({ ok: true })
  }

  let payload: WebhookPayload
  try {
    const rawBody = await req.text()
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const valid = await verifyAzamPaySignature(payload)
  if (!valid) {
    console.error('[AdWebhook] Invalid AzamPay signature')
    return NextResponse.json({ ok: true })
  }

  const externalId = getExternalId(payload)
  if (!externalId) {
    return NextResponse.json({ error: 'Missing external ID' }, { status: 400 })
  }

  const admin = createAdminClient()
  const handled = await tryProcessAdPayment(admin, externalId, payload)

  if (!handled) {
    console.warn('[AdWebhook] No ad_payment found for externalId:', externalId)
  }

  return NextResponse.json({ ok: true })
}
