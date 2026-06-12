import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isWebhookSuccess, getExternalId, type WebhookPayload } from '@/lib/payments/azampay'

// externalId format: EX-{subscription_uuid}-{count}
// e.g. EX-be7353b5-5b5b-4a77-9e4e-e76b8bc02cfa-3
// Split: ['EX', '8hex', '4hex', '4hex', '4hex', '12hex', 'count']
function parseExtraListingsId(externalId: string): { subId: string; count: number } | null {
  if (!externalId.startsWith('EX-')) return null
  const parts = externalId.split('-')
  // EX prefix + 5 UUID segments + count = 7 parts minimum
  if (parts.length !== 7) return null
  const count = parseInt(parts[6], 10)
  if (!Number.isInteger(count) || count < 1) return null
  const subId = parts.slice(1, 6).join('-')
  return { subId, count }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)
    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)

    if (!externalId) return NextResponse.json({ received: true })

    const parsed = parseExtraListingsId(externalId)
    if (!parsed) return NextResponse.json({ received: true })

    const { subId, count } = parsed
    const admin = createAdminClient()

    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, dalali_id, extra_listings, extra_listings_fee, status')
      .eq('id', subId)
      .maybeSingle()

    if (!sub) return NextResponse.json({ received: true })

    if (succeeded) {
      const amount = count * 2_000

      await admin
        .from('subscriptions')
        .update({
          extra_listings:     (sub.extra_listings ?? 0) + count,
          extra_listings_fee: (sub.extra_listings_fee ?? 0) + amount,
        })
        .eq('id', subId)

      await admin.from('notifications').insert({
        user_id: sub.dalali_id,
        title:   '✅ Listings za Ziada Zimeongezwa!',
        body:    `Umefanikiwa kuongeza listings ${count} za ziada. Unaweza sasa kupost listings zaidi.`,
        type:    'subscription_active',
        is_read: false,
        data:    { extra_count: count },
      })

      console.log('[ExtraListings webhook] Added', count, 'listings to sub', subId)
    } else {
      console.log('[ExtraListings webhook] Payment failed for sub', subId, 'count', count)
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ received: true })
  }
}
