import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isWebhookSuccess, isAmountValid, getExternalId, verifyWebhookSecret, verifyAzamPaySignature, type WebhookPayload } from '@/lib/payments/azampay'
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

    console.log('[Unlock Webhook] externalId:', externalId, '| status:', payload.transactionstatus, '| succeeded:', succeeded)

    if (!externalId) {
      console.warn('[Unlock Webhook] No externalId in payload — ignoring')
      return NextResponse.json({ received: true })
    }

    const unlockPrice = (await getPricing()).unlock
    if (succeeded && !isAmountValid(payload, unlockPrice)) {
      console.warn('[Unlock Webhook] Amount mismatch — expected 2000, got:', payload.amount)
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()

    console.log('[Unlock Webhook] Looking for contact_unlock with payment_ref:', externalId)
    const { data: unlock } = await admin
      .from('contact_unlocks')
      .select('id, client_id, listing_id, dalali_id, status')
      .eq('payment_ref', externalId)
      .maybeSingle()

    console.log('[Unlock Webhook] Found unlock:', unlock ? `id=${unlock.id} status=${unlock.status}` : 'NOT FOUND')

    if (!unlock || unlock.status !== 'pending') {
      return NextResponse.json({ received: true })
    }

    const newStatus = succeeded ? 'completed' : 'failed'
    console.log('[Unlock Webhook] Updating status to:', newStatus)

    await admin.from('contact_unlocks').update({ status: newStatus }).eq('id', unlock.id)

    // Update payments audit table (non-blocking)
    admin.from('payments').update({
      status:         newStatus === 'completed' ? 'completed' : 'failed',
      transaction_id: payload.transid,
    }).eq('external_id', externalId).then(() => {})

    if (succeeded) {
      // Auto-record income (non-blocking)
      import('@/lib/accounting/incomeTracker')
        .then(m => m.recordIncomeFromUnlock(unlock.id))
        .catch(e => console.error('[Accounting] recordIncomeFromUnlock failed (non-fatal):', e))

      await admin.rpc('increment_lead_count', { listing_id: unlock.listing_id }).maybeSingle()

      const { data: listing } = await admin
        .from('listings')
        .select('type, district, dalali:dalali_id(full_name)')
        .eq('id', unlock.listing_id)
        .single()

      if (listing) {
        const dalaliName   = (listing as typeof listing & { dalali?: { full_name?: string } | null }).dalali?.full_name ?? 'dalali'
        const listingLabel = `${listing.type} – ${listing.district}`

        // Notify dalali via WhatsApp immediately (non-blocking)
        import('@/lib/listings/rentalReminder')
          .then(m => m.notifyDalaliNewUnlock({
            dalaliId:     unlock.dalali_id,
            listingId:    unlock.listing_id,
            listingLabel,
          }))
          .catch(e => console.error('[RentalReminder] notifyDalaliNewUnlock failed (non-fatal):', e))

        await admin.from('notifications').insert([
          {
            user_id: unlock.dalali_id,
            title:   '📲 Lead Mpya!',
            body:    `Mteja amepata nambari yako kupitia listing ya ${listingLabel}.`,
            type:    'new_lead',
            is_read: false,
            ref_id:  unlock.id,
          },
          {
            user_id:  unlock.client_id,
            title:    '⭐ Je, ulifurahi na dalali?',
            body:     `Umezungumza na ${dalaliName} (${listingLabel}). Toa maoni yako — inasaidia wengine kuchagua vizuri.`,
            type:     'review_request',
            is_read:  false,
            ref_id:   unlock.id,
          },
          {
            user_id:  unlock.client_id,
            title:    '🏠 Je, umepata nyumba?',
            body:     `Umezungumza na ${dalaliName} wiki iliyopita. Je, umepata nyumba? Toa review yako →`,
            type:     'review_reminder',
            is_read:  false,
            ref_id:   unlock.id,
          },
        ])
        console.log('[Unlock Webhook] Notifications sent for unlock:', unlock.id)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Unlock Webhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
