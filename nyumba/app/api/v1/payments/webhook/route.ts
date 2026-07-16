import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  isWebhookSuccess, isAmountValid, getExternalId,
  verifyWebhookSecret, verifyAzamPaySignature,
  type WebhookPayload,
} from '@/lib/payments/azampay'
import { getPricing } from '@/lib/config/pricing'

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[Unlock Webhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }
  try {
    const rawBody = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)

    if (!(await verifyAzamPaySignature(payload))) {
      console.warn('[Unlock Webhook] RSA signature invalid — rejecting')
      return NextResponse.json({ received: true })
    }

    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)

    console.log('[Unlock Webhook] externalId:', externalId, '| succeeded:', succeeded)
    if (!externalId) return NextResponse.json({ received: true })

    const unlockPrice = (await getPricing()).unlock
    if (succeeded && !isAmountValid(payload, unlockPrice)) {
      console.warn('[Unlock Webhook] Amount mismatch — expected', unlockPrice, 'got:', payload.amount)
      return NextResponse.json({ received: true })
    }

    const admin     = createAdminClient()
    const newStatus = succeeded ? 'completed' : 'failed'

    // ── Atomic status transition ──────────────────────────────────────────────
    // PostgreSQL row-lock ensures only ONE concurrent call wins this UPDATE.
    // If two webhooks arrive simultaneously for the same payment_ref, only the
    // first one sees status='pending' and updates it. The second gets 0 rows back
    // and exits early — preventing double-credit and duplicate notifications.
    const { data: updated } = await admin
      .from('contact_unlocks')
      .update({ status: newStatus })
      .eq('payment_ref', externalId)
      .eq('status', 'pending')       // atomic guard — only matches once
      .select('id, client_id, listing_id, dalali_id')

    if (!updated || updated.length === 0) {
      // Already processed (idempotent) or payment_ref not found
      console.log('[Unlock Webhook] No pending unlock found for', externalId, '— skipping (already processed?)')
      return NextResponse.json({ received: true })
    }

    const unlock = updated[0]
    console.log('[Unlock Webhook] Status →', newStatus, 'for unlock:', unlock.id)

    // Update payments audit table (non-blocking — ok to fail)
    admin.from('payments').update({
      status: newStatus, transaction_id: payload.transid, provider: payload.operator ?? null,
    }).eq('external_id', externalId).then(() => {})

    if (!succeeded) return NextResponse.json({ received: true })

    // ── Side effects (only reached by the ONE winning call) ──────────────────

    // Income accounting (non-blocking)
    import('@/lib/accounting/incomeTracker')
      .then(m => m.recordIncomeFromUnlock(unlock.id))
      .catch(e => console.error('[Accounting] recordIncomeFromUnlock failed:', e))

    // Increment lead count (non-blocking)
    admin.rpc('increment_lead_count', { listing_id: unlock.listing_id })
      .maybeSingle()
      .then(() => {})

    const { data: listing } = await admin
      .from('listings')
      .select('type, district, dalali:dalali_id(full_name)')
      .eq('id', unlock.listing_id)
      .single()

    if (listing) {
      const dalaliName   = (listing as typeof listing & { dalali?: { full_name?: string } | null }).dalali?.full_name ?? 'dalali'
      const listingLabel = `${listing.type} – ${listing.district}`

      // WhatsApp notification (non-blocking)
      import('@/lib/listings/rentalReminder')
        .then(m => m.notifyDalaliNewUnlock({ dalaliId: unlock.dalali_id, listingId: unlock.listing_id, listingLabel }))
        .catch(e => console.error('[RentalReminder] notifyDalaliNewUnlock failed:', e))

      await admin.from('notifications').insert([
        {
          user_id: unlock.dalali_id,
          title:   '📲 Lead Mpya!',
          body:    `Mteja amepata nambari yako kupitia listing ya ${listingLabel}.`,
          type:    'new_lead', is_read: false, ref_id: unlock.id,
        },
        {
          user_id: unlock.client_id,
          title:   '⭐ Je, ulifurahi na dalali?',
          body:    `Umezungumza na ${dalaliName} (${listingLabel}). Toa maoni yako — inasaidia wengine kuchagua vizuri.`,
          type:    'review_request', is_read: false, ref_id: unlock.id,
        },
        {
          user_id: unlock.client_id,
          title:   '🏠 Je, umepata nyumba?',
          body:    `Umezungumza na ${dalaliName} wiki iliyopita. Je, umepata nyumba? Toa review yako →`,
          type:    'review_reminder', is_read: false, ref_id: unlock.id,
        },
      ])
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Unlock Webhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
