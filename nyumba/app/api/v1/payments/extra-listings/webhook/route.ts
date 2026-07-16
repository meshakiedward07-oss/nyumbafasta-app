import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  isWebhookSuccess, isAmountValid, getExternalId,
  verifyWebhookSecret, verifyAzamPaySignature,
  type WebhookPayload,
} from '@/lib/payments/azampay'
import { getPricing } from '@/lib/config/pricing'

// externalId format: EX-{subscription_uuid}-{count}
// e.g. EX-be7353b5-5b5b-4a77-9e4e-e76b8bc02cfa-3
function parseExtraListingsId(externalId: string): { subId: string; count: number } | null {
  if (!externalId.startsWith('EX-')) return null
  const parts = externalId.split('-')
  // EX + 5 UUID segments + count = 7 parts
  if (parts.length !== 7) return null
  const count = parseInt(parts[6], 10)
  if (!Number.isInteger(count) || count < 1) return null
  const subId = parts.slice(1, 6).join('-')
  return { subId, count }
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[ExtraListings Webhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }
  try {
    const rawBody = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)

    if (!(await verifyAzamPaySignature(payload))) {
      console.warn('[ExtraListings Webhook] RSA signature invalid — rejecting')
      return NextResponse.json({ received: true })
    }

    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)

    console.log('[ExtraListings Webhook] externalId:', externalId, '| succeeded:', succeeded)
    if (!externalId) return NextResponse.json({ received: true })

    const parsed = parseExtraListingsId(externalId)
    if (!parsed) {
      console.warn('[ExtraListings Webhook] Could not parse externalId:', externalId)
      return NextResponse.json({ received: true })
    }

    const { subId, count } = parsed
    const admin = createAdminClient()

    // Amount validation
    if (succeeded) {
      const pricePerExtra  = (await getPricing()).extraListing
      const expectedAmount = count * pricePerExtra
      if (!isAmountValid(payload, expectedAmount)) {
        console.warn('[ExtraListings Webhook] Amount mismatch — expected', expectedAmount, 'got:', payload.amount)
        return NextResponse.json({ received: true })
      }
    }

    // ── Atomic status transition via payments table ───────────────────────────
    // The payments table has external_id UNIQUE — so there's exactly one row per
    // payment_ref. Atomically flipping it from 'pending' to 'completed'/'failed'
    // is the idempotency guard: only ONE concurrent webhook call wins this UPDATE.
    const { data: updatedPayment } = await admin
      .from('payments')
      .update({
        status:         succeeded ? 'completed' : 'failed',
        transaction_id: payload.transid,
        provider:       payload.operator ?? null,
      })
      .eq('external_id', externalId)
      .eq('status', 'pending')          // atomic guard
      .select('id, dalali_id, amount, provider')

    if (!updatedPayment || updatedPayment.length === 0) {
      console.log('[ExtraListings Webhook] Atomic update found no pending row — already processed:', externalId)
      return NextResponse.json({ received: true })
    }

    const payment = updatedPayment[0]
    console.log('[ExtraListings Webhook] Payment status →', succeeded ? 'completed' : 'failed', 'id:', payment.id)

    if (!succeeded) return NextResponse.json({ received: true })

    // ── Side effects (only reached by the ONE winning call) ──────────────────

    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, dalali_id, extra_listings, extra_listings_fee')
      .eq('id', subId)
      .maybeSingle()

    if (!sub) {
      console.error('[ExtraListings Webhook] Subscription not found:', subId)
      return NextResponse.json({ received: true })
    }

    const amount = payment.amount as number

    // Extra listing slots expire 30 days from purchase
    const extraExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await admin.from('subscriptions').update({
      extra_listings:           (sub.extra_listings ?? 0) + count,
      extra_listings_fee:       (sub.extra_listings_fee ?? 0) + amount,
      extra_listings_expires_at: extraExpiresAt,
    }).eq('id', subId)

    // Income accounting (non-blocking)
    import('@/lib/accounting/incomeTracker')
      .then(m => m.recordIncomeFromExtraListings({
        paymentId:     payment.id,
        dalaliId:      sub.dalali_id,
        count,
        amount,
        externalId,
        paymentMethod: (payment as typeof payment & { provider?: string }).provider ?? undefined,
      }))
      .catch(e => console.error('[Accounting] recordIncomeFromExtraListings failed:', e))

    await admin.from('notifications').insert({
      user_id: sub.dalali_id,
      title:   '✅ Listings za Ziada Zimeongezwa!',
      body:    `Umefanikiwa kuongeza listings ${count} za ziada. Unaweza sasa kupost listings zaidi.`,
      type:    'subscription_active',
      is_read: false,
    })

    console.log('[ExtraListings Webhook] Added', count, 'extra listings to sub', subId)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[ExtraListings Webhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
