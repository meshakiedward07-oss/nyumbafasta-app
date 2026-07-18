import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  isWebhookSuccess, isAmountValid, getExternalId,
  verifyWebhookSecret, verifyAzamPaySignature,
  type WebhookPayload,
} from '@/lib/payments/azampay'

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[Boost Webhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }
  try {
    const rawBody = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)

    if (!(await verifyAzamPaySignature(payload))) {
      console.warn('[Boost Webhook] RSA signature invalid — rejecting')
      return NextResponse.json({ received: true })
    }

    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)

    console.log('[Boost Webhook] externalId:', externalId, '| succeeded:', succeeded)
    if (!externalId) return NextResponse.json({ received: true })

    const admin = createAdminClient()

    // ── Single-query atomic transition ────────────────────────────────────────
    // Include `amount` in RETURNING so we can validate it WITHOUT a prior SELECT.
    // Only ONE concurrent call wins when status is 'pending' — PostgreSQL row-lock
    // ensures the second call gets 0 rows and exits immediately.
    const { data: updated } = await admin
      .from('boost_payments')
      .update({ status: succeeded ? 'completed' : 'failed' })
      .eq('payment_ref', externalId)
      .eq('status', 'pending')         // atomic guard
      .select('id, listing_id, dalali_id, weeks, boosted_until, amount')

    if (!updated || updated.length === 0) {
      console.log('[Boost Webhook] No pending boost_payment for', externalId, '— already processed or not found')
      return NextResponse.json({ received: true })
    }

    const bp = updated[0]
    console.log('[Boost Webhook] Status → completed for boost_payment:', bp.id)

    // Post-update amount validation — catches tampered amounts without a pre-SELECT
    if (succeeded && bp.amount && !isAmountValid(payload, bp.amount as number)) {
      console.warn('[Boost Webhook] Amount mismatch — marking failed. expected:', bp.amount, 'got:', payload.amount)
      await admin.from('boost_payments').update({ status: 'failed' }).eq('id', bp.id)
      return NextResponse.json({ received: true })
    }

    if (!succeeded) return NextResponse.json({ received: true })

    // ── Side effects (only reached by the ONE winning call) ──────────────────

    // Income accounting (non-blocking)
    import('@/lib/accounting/incomeTracker')
      .then(m => m.recordIncomeFromBoost(bp.id))
      .catch(e => console.error('[Accounting] recordIncomeFromBoost failed:', e))

    const { data: listing } = await admin
      .from('listings')
      .select('boost_count')
      .eq('id', bp.listing_id)
      .maybeSingle()

    await admin.from('listings').update({
      is_boosted:    true,
      boosted_until: bp.boosted_until,
      boost_count:   (listing?.boost_count ?? 0) + 1,
    }).eq('id', bp.listing_id)

    await admin.from('notifications').insert({
      user_id:  bp.dalali_id,
      title:    '⚡ Listing Imeboostwa!',
      body:     `Listing yako itaonekana juu ya wote kwa wiki ${bp.weeks}.`,
      type:     'boost_activated',
      is_read:  false,
    })

    // WhatsApp + email (non-blocking)
    ;(async () => {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
      const { data: dalali } = await admin
        .from('users')
        .select('full_name, dalali_profiles(whatsapp_number)')
        .eq('id', bp.dalali_id)
        .single()
      const wp    = (dalali?.dalali_profiles as { whatsapp_number?: string | null }[] | null)?.[0]?.whatsapp_number
      const name  = dalali?.full_name ?? 'Dalali'
      const until = bp.boosted_until
        ? new Date(bp.boosted_until).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—'

      if (wp) {
        const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
        const msg =
          `⚡ *Listing Yako Imeboostwa!*\n\nHabari ${name}!\n\n` +
          `Listing yako imewashwa boost kwa wiki *${bp.weeks}*. Itaonekana juu ya wote!\n\n` +
          `📅 Boosted hadi: *${until}*\n\n👉 ${APP_URL}/dashboard/listings`
        await sendTextMessage(formatPhoneNumber(wp), msg).catch(() => {})
      }

      if (process.env.RESEND_API_KEY) {
        const dalaliEmail = await admin.auth.admin.getUserById(bp.dalali_id)
          .then(r => r.data?.user?.email ?? null)
        if (dalaliEmail) {
          const { boostActivatedEmail } = await import('@/lib/email/templates')
          const { Resend } = await import('resend')
          const { subject, html } = boostActivatedEmail(name, bp.weeks as number, until)
          await new Resend(process.env.RESEND_API_KEY).emails.send({
            from: 'NyumbaFasta <noreply@nyumbafasta.co>',
            to:   dalaliEmail,
            subject, html,
          }).catch(() => {})
        }
      }
    })().catch(() => {})

    console.log('[Boost Webhook] Listing boosted:', bp.listing_id, 'until:', bp.boosted_until)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Boost Webhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
