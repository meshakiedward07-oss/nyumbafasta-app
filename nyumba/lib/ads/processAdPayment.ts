import { SupabaseClient } from '@supabase/supabase-js'
import { isWebhookSuccess, WebhookPayload } from '@/lib/payments/azampay'
import { notifyAdvertiserPaymentSuccess } from './adNotifications'
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

  // Activate the campaign
  const { data: campaign } = await admin
    .from('ad_campaigns')
    .select('id, title, ad_type, status, plan:plan_id (duration_days)')
    .eq('id', payment.campaign_id)
    .single()

  if (!campaign) return true

  const durationDays = (campaign.plan as unknown as { duration_days: number })?.duration_days ?? 30
  const expiresAt    = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
  const newStatus    = campaign.status === 'approved' ? 'active' : campaign.status

  await admin.from('ad_campaigns').update({
    payment_status: 'completed',
    status:         newStatus,
    starts_at:      new Date().toISOString(),
    expires_at:     expiresAt,
  }).eq('id', payment.campaign_id)

  // Load advertiser for notifications
  const { data: advertiser } = await admin
    .from('advertisers')
    .select('business_name, whatsapp_number, user_id')
    .eq('id', payment.advertiser_id)
    .single()

  if (advertiser) {
    // WhatsApp notification (non-blocking)
    if (advertiser.whatsapp_number) {
      notifyAdvertiserPaymentSuccess(
        advertiser.whatsapp_number,
        advertiser.business_name,
        campaign.ad_type,
        expiresAt,
      ).catch(() => {})
    }

    // In-app notification
    if (advertiser.user_id) {
      admin.from('notifications').insert({
        user_id: advertiser.user_id,
        title:   '💳 Malipo Yamekamilika!',
        body:    `Kampeni yako "${campaign.title}" inaonekana sasa kwa wateja. Angalia dashibodi yako.`,
        type:    'ad_payment_success',
        is_read: false,
      }).then(() => {}, () => {})
    }
  }

  // Revenue accounting — fire and forget, never block webhook response
  recordIncomeFromAdCampaign(payment.id).catch(e =>
    console.error('[AdPayment] Accounting error:', e)
  )

  return true
}
