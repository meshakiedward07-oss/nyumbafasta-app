import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  isWebhookSuccess, isAmountValid, getExternalId,
  verifyWebhookSecret, verifyAzamPaySignature,
  type WebhookPayload,
} from '@/lib/payments/azampay'
import { getPricing } from '@/lib/config/pricing'
import { sendMail } from '@/lib/email/resend'
import { contactUnlockEmail, subscriptionActivatedEmail } from '@/lib/email/templates'
import { tryProcessAdPayment } from '@/lib/ads/processAdPayment'

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[Unlock Webhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }
  try {
    const rawBody = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)

    // Log key fields immediately — helps diagnose field-name mismatches from AzamPay
    console.log('[Unlock Webhook] Received | keys:', Object.keys(payload).join(','),
      '| status:', payload.transactionstatus,
      '| utilityref:', payload.utilityref,
      '| externalreference:', payload.externalreference,
      '| amount:', payload.amount,
    )

    if (!(await verifyAzamPaySignature(payload))) {
      console.warn('[Unlock Webhook] RSA signature invalid — rejecting')
      return NextResponse.json({ received: true })
    }

    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)

    if (!externalId) {
      console.warn('[Unlock Webhook] No externalId — utilityref/externalreference/reference all missing. Raw keys:', Object.keys(payload).join(','))
      return NextResponse.json({ received: true })
    }

    const unlockPrice = (await getPricing()).unlock
    if (succeeded && !isAmountValid(payload, unlockPrice)) {
      console.warn('[Unlock Webhook] Amount mismatch — expected', unlockPrice, 'received:', payload.amount, '— rejecting')
      return NextResponse.json({ received: true })
    }
    if (succeeded && (payload.amount === undefined || payload.amount === '')) {
      console.warn('[Unlock Webhook] Amount field absent from payload — proceeding (whsec+sig already verified)')
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
      // ── UPG- (subscription upgrade) ────────────────────────────────────────
      if (externalId.startsWith('UPG-')) {
        const { data: upgPayment } = await admin
          .from('payments')
          .update({
            status:         newStatus,
            transaction_id: payload.transid,
            provider:       payload.operator ?? null,
          })
          .eq('external_id', externalId)
          .eq('status', 'pending')
          .eq('type', 'upgrade')
          .select('id, dalali_id, amount, metadata')

        if (!upgPayment || upgPayment.length === 0) {
          console.log('[Upgrade Webhook] No pending upgrade payment for', externalId)
          return NextResponse.json({ received: true })
        }

        const pmnt = upgPayment[0]
        console.log('[Upgrade Webhook] Status →', newStatus, 'for upgrade payment:', pmnt.id)

        if (!succeeded) return NextResponse.json({ received: true })

        const meta   = pmnt.metadata as { to_plan?: string; from_plan?: string; subscription_id?: string } | null
        const toPlan = meta?.to_plan
        if (!toPlan) {
          console.error('[Upgrade Webhook] No to_plan in metadata for payment:', pmnt.id)
          return NextResponse.json({ received: true })
        }
        const subId = meta?.subscription_id
        if (!subId) {
          console.error('[Upgrade Webhook] No subscription_id in metadata — cannot safely upgrade without it:', pmnt.id)
          return NextResponse.json({ received: true })
        }

        // Upgrade the subscription — extend expires_at by 30 days from now
        const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: upgraded } = await admin
              .from('subscriptions')
              .update({ plan: toPlan, expires_at: newExpiresAt })
              .eq('id', subId)
              .eq('status', 'active')
              .select('id')

        if (!upgraded || upgraded.length === 0) {
          console.error('[Upgrade Webhook] Failed to upgrade subscription for dalali:', pmnt.dalali_id)
          return NextResponse.json({ received: true })
        }

        // Grant premium badge for premium/enterprise
        if (toPlan === 'premium' || toPlan === 'enterprise') {
          admin.from('dalali_profiles').update({ is_premium_verified: true }).eq('user_id', pmnt.dalali_id).then(() => {})
        }

        // Income accounting (non-blocking)
        import('@/lib/accounting/incomeTracker')
          .then(m => m.recordIncomeFromUpgrade({
            paymentId:  pmnt.id,
            dalaliId:   pmnt.dalali_id,
            amount:     Number(pmnt.amount),
            externalId,
            toPlan,
          }))
          .catch(e => console.error('[Accounting] recordIncomeFromUpgrade failed:', e))

        const planLabel = toPlan.charAt(0).toUpperCase() + toPlan.slice(1)

        // In-app notification
        await admin.from('notifications').insert({
          user_id: pmnt.dalali_id,
          title:   `🚀 Mpango Umepandishwa hadi ${planLabel}!`,
          body:    `Hongera! Umefanikiwa kupanda mpango hadi ${planLabel}. Vipengele vyote vipya vinapatikana sasa.`,
          type:    'subscription_active',
          is_read: false,
        })

        // WhatsApp + email (non-blocking)
        ;(async () => {
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
          const { data: dalali } = await admin
            .from('users')
            .select('full_name, dalali_profiles(whatsapp_number)')
            .eq('id', pmnt.dalali_id)
            .single()
          const wp   = (dalali?.dalali_profiles as { whatsapp_number?: string | null }[] | null)?.[0]?.whatsapp_number
          const name = dalali?.full_name ?? 'Dalali'

          if (wp) {
            const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
            await sendTextMessage(
              formatPhoneNumber(wp),
              `🚀 *Mpango Wako Umepanda hadi ${planLabel}!*\n\n` +
              `Hongera ${name}!\n\n` +
              `Umefanikiwa kupanda mpango wako hadi *${planLabel}*. ` +
              `Vipengele vyote vipya vinapatikana sasa.\n\n` +
              `👉 ${APP_URL}/dashboard/subscription`,
            ).catch(() => {})
          }

          const dalaliEmail = await admin.auth.admin.getUserById(pmnt.dalali_id)
            .then(r => r.data?.user?.email ?? null)
          if (dalaliEmail && process.env.RESEND_API_KEY) {
            const expiryDate = new Date(newExpiresAt).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
            const { subject, html } = subscriptionActivatedEmail(name, planLabel, expiryDate)
            sendMail({ to: dalaliEmail, subject, html }).catch(() => {})
          }
        })().catch(() => {})

        console.log('[Upgrade Webhook] Subscription upgraded to', toPlan, 'for dalali:', pmnt.dalali_id)
        return NextResponse.json({ received: true })
      }

      // Not a contact_unlock or upgrade payment — check if it's an ad payment.
      // AzamPay uses a single merchant callback URL, so all payment types land here.
      const wasAd = await tryProcessAdPayment(admin, externalId, payload)
      if (!wasAd) {
        console.log('[Webhook] No matching payment for', externalId, '— skipping')
      }
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

      // Email notification to dalali (non-blocking)
      if (process.env.RESEND_API_KEY) {
        ;(async () => {
          try {
            // Get dalali's email from auth.admin (public.users.email not populated)
            const dalaliEmail = await admin.auth.admin.getUserById(unlock.dalali_id)
              .then(r => r.data?.user?.email ?? null)
            // Get client's name for the notification
            const clientName = await admin.auth.admin.getUserById(unlock.client_id)
              .then(r => r.data?.user?.user_metadata?.full_name as string ?? 'Mteja')

            if (dalaliEmail) {
              const { subject, html } = contactUnlockEmail(dalaliName, clientName, listingLabel)
              await sendMail({ to: dalaliEmail, subject, html })
            }
          } catch (e) {
            console.error('[Unlock Webhook] Email send error:', e)
          }
        })()
      }

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
