import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isWebhookSuccess, getExternalId, verifyWebhookSecret, type WebhookPayload } from '@/lib/payments/azampay'

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[Boost Webhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }
  try {
    const rawBody = await req.text()
    console.log('[Boost Webhook] Received:', rawBody.slice(0, 500))

    const payload: WebhookPayload = JSON.parse(rawBody)
    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)

    console.log('[Boost Webhook] externalId:', externalId, '| succeeded:', succeeded)

    if (!externalId) {
      console.warn('[Boost Webhook] No externalId — ignoring')
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()

    const { data: bp } = await admin
      .from('boost_payments')
      .select('id, listing_id, dalali_id, weeks, boosted_until, status')
      .eq('payment_ref', externalId)
      .eq('status', 'pending')
      .maybeSingle()

    console.log('[Boost Webhook] Found boost_payment:', bp ? `id=${bp.id}` : 'NOT FOUND')

    if (!bp) return NextResponse.json({ received: true })

    const newStatus = succeeded ? 'completed' : 'failed'
    await admin.from('boost_payments').update({ status: newStatus }).eq('id', bp.id)

    if (succeeded) {
      const { data: listing } = await admin
        .from('listings')
        .select('boost_count')
        .eq('id', bp.listing_id)
        .single()

      await admin.from('listings').update({
        is_boosted:    true,
        boosted_until: bp.boosted_until,
        boost_count:   (listing?.boost_count ?? 0) + 1,
      }).eq('id', bp.listing_id)

      await admin.from('notifications').insert({
        user_id:  bp.dalali_id,
        title:    '🚀 Listing Imeboostwa!',
        body:     `Listing yako itaonekana juu ya wote kwa wiki ${bp.weeks}.`,
        type:     'boost_activated',
        is_read:  false,
        data:     { listing_id: bp.listing_id },
      })

      console.log('[Boost Webhook] Listing boosted:', bp.listing_id, 'until:', bp.boosted_until)
    }

    return NextResponse.json({ received: true, success: succeeded })
  } catch (err) {
    console.error('[Boost Webhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
