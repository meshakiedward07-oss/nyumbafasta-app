import { SupabaseClient } from '@supabase/supabase-js'
import { isWebhookSuccess, WebhookPayload } from '@/lib/payments/azampay'
import { notifyAdvertiserPaymentSuccess, notifyAdvertiserQueued } from './adNotifications'
import { activateOrQueueCampaign } from './slotManager'
import { recordIncomeFromAdCampaign } from '@/lib/accounting/incomeTracker'
import { auditLog } from '@/lib/security/auditLog'

/**
 * Processes an ad payment webhook payload.
 * Called by both the unified /api/v1/payments/webhook and the
 * dedicated /api/v1/advertising/pay/webhook endpoints.
 *
 * Returns true if an ad_payment row was found (and processed or already
 * processed), false if no matching row exists (so the caller can continue
 * checking other payment types).
 */
export async function tryProcessAdPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  externalId: string,
  payload: WebhookPayload,
): Promise<boolean> {
  const { data: payment } = await admin
    .from('ad_payments')
    .select('id, campaign_id, advertiser_id, amount, status')
    .eq('external_id', externalId)
    .maybeSingle()

  if (!payment) return false

  const success = isWebhookSuccess(payload)

  // Atomic guard — only one concurrent webhook delivery wins
  const { data: updated } = await admin
    .from('ad_payments')
    .update({
      status:            success ? 'completed' : 'failed',
      gateway_reference: (payload as unknown as Record<string, unknown>).externalreference ?? null,
      paid_at:           success ? new Date().toISOString() : null,
    })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (!updated) return true // Already processed — idempotent

  // Audit log payment outcome
  auditLog({
    action:      success ? 'payment_completed' : 'payment_failed',
    target_id:   payment.id,
    target_type: 'ad_payment',
    metadata:    { external_id: externalId, campaign_id: payment.campaign_id, amount: payment.amount },
    severity:    success ? 'info' : 'warning',
  }).catch(() => {})

  if (!success) return true

  // Mark paid. Content-review status is left as-is here if the advertiser
  // paid before admin ever reviewed the creative (still 'pending_review') —
  // the admin approve routes' own alreadyPaid branch handles going live in
  // that case. Only an already-'approved' campaign (content vetted, just
  // waiting on payment) transitions here.
  const { data: campaign } = await admin
    .from('ad_campaigns')
    .select('id, title, ad_type, status, target_region, target_district, target_wards, plan:plan_id (duration_days, slot_limit)')
    .eq('id', payment.campaign_id)
    .single()

  if (!campaign) return true

  const plan = campaign.plan as unknown as { duration_days: number; slot_limit: number } | null
  const durationDays = plan?.duration_days ?? 30

  await admin.from('ad_campaigns').update({ payment_status: 'completed' }).eq('id', payment.campaign_id)

  let activated = false
  if (campaign.status === 'approved') {
    const result = await activateOrQueueCampaign(
      admin,
      {
        id: campaign.id, ad_type: campaign.ad_type, target_region: campaign.target_region,
        target_district: campaign.target_district, target_wards: campaign.target_wards,
      },
      plan?.slot_limit ?? 1,
      durationDays,
    )
    activated = result.activated
  }

  // Load advertiser for notifications
  const { data: advertiser } = await admin
    .from('advertisers')
    .select('business_name, whatsapp_number, user_id')
    .eq('id', payment.advertiser_id)
    .single()

  if (advertiser && campaign.status === 'approved') {
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()

    // WhatsApp notification (non-blocking)
    if (advertiser.whatsapp_number) {
      if (activated) {
        notifyAdvertiserPaymentSuccess(
          advertiser.whatsapp_number, advertiser.business_name, campaign.ad_type, expiresAt,
        ).catch(() => {})
      } else {
        notifyAdvertiserQueued(
          advertiser.whatsapp_number, advertiser.business_name, campaign.ad_type, campaign.target_region,
        ).catch(() => {})
      }
    }

    // In-app notification
    if (advertiser.user_id) {
      admin.from('notifications').insert({
        user_id: advertiser.user_id,
        title:   activated ? '💳 Malipo Yamekamilika!' : '⏳ Malipo Yamepokelewa — Foleni',
        body:    activated
          ? `Kampeni yako "${campaign.title}" inaonekana sasa kwa wateja. Angalia dashibodi yako.`
          : `Kampeni yako "${campaign.title}" imelipwa lakini nafasi zimejaa. Itaanza kiotomatiki mara nafasi itakapopatikana.`,
        type:    activated ? 'ad_payment_success' : 'ad_campaign_queued',
        is_read: false,
      }).then(() => {}, () => {})
    }
  } else if (advertiser?.user_id && campaign.status !== 'approved') {
    // Advertiser paid before admin ever reviewed the content (still
    // 'pending_review') — this used to send the "your campaign is showing
    // to customers now" WhatsApp message unconditionally here, which was
    // simply false in this case (nothing goes live until admin approves
    // the content). Send an honest "payment received, awaiting review"
    // notice instead; the admin approve routes' alreadyPaid branch is what
    // actually activates/queues it once content is approved.
    admin.from('notifications').insert({
      user_id: advertiser.user_id,
      title:   '💳 Malipo Yamepokelewa',
      body:    `Malipo ya kampeni yako "${campaign.title}" yamepokelewa. Inasubiri ukaguzi wa admin kabla ya kuonekana.`,
      type:    'ad_payment_pending_review',
      is_read: false,
    }).then(() => {}, () => {})
  }

  // Revenue accounting — fire and forget, never block webhook response
  recordIncomeFromAdCampaign(payment.id).catch(e =>
    console.error('[AdPayment] Accounting error:', e)
  )

  return true
}
