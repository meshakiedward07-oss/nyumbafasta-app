import { SupabaseClient } from '@supabase/supabase-js'
import { checkSlotAvailability } from './fetcher'
import { auditLog } from '@/lib/security/auditLog'

/**
 * Centralizes the "go live" transition for a paid + content-approved
 * campaign. Every call site used to set status='active' unconditionally
 * with no slot re-check — checkSlotAvailability() is only consulted once,
 * at campaign-creation time, before payment/approval — so two advertisers
 * could each pass that check for the same (ad_type, region) while both sat
 * in 'pending_review'+paid limbo, then both get approved and both go
 * active, overselling a slot_limit as tight as 1 (e.g. Banner ads).
 * Found in the 2026-09-01 ads-system audit; user chose "auto-queue" as the
 * fix (see project_ads_system_audit_2026_09_01 memory) — a campaign that
 * can't fit right now is queued instead of activated, and
 * promoteQueuedCampaigns() below activates it automatically, FIFO, the
 * moment a slot actually frees up (called from the daily cron after
 * expiring campaigns).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export async function activateOrQueueCampaign(
  admin: AnyClient,
  campaign: { id: string; ad_type: string; target_region: string },
  planSlotLimit: number,
  durationDays: number,
): Promise<{ activated: boolean }> {
  const slot = await checkSlotAvailability({
    ad_type:         campaign.ad_type,
    region:          campaign.target_region,
    plan_slot_limit: planSlotLimit,
  })

  if (slot.available) {
    const now = new Date()
    await admin.from('ad_campaigns').update({
      status:     'active',
      starts_at:  now.toISOString(),
      expires_at: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', campaign.id)
    return { activated: true }
  }

  // Paid + approved, but the slot is full right now — queue it. Deliberately
  // leaves starts_at/expires_at unset: the paid duration should start when
  // the ad actually goes live, not be silently eaten away while queued.
  await admin.from('ad_campaigns').update({ status: 'queued' }).eq('id', campaign.id)

  auditLog({
    action:      'ad_campaign_queued',
    target_id:   campaign.id,
    target_type: 'ad_campaign',
    metadata:    { ad_type: campaign.ad_type, region: campaign.target_region, active: slot.active, limit: slot.limit },
    severity:    'info',
  }).catch(() => {})

  return { activated: false }
}

/**
 * Called from the daily cron right after expiring campaigns for a given
 * (ad_type, region) pair. Activates queued campaigns for that pair, oldest
 * first (FIFO — first paid, first served), stopping as soon as
 * checkSlotAvailability reports no more room (handles the case where more
 * than one slot freed up, or an ad_slot_config override changed the limit
 * since these were queued). Returns the promoted rows so the caller can
 * send "your ad is live now" notifications.
 */
export async function promoteQueuedCampaigns(
  admin: AnyClient,
  adType: string,
  region: string,
): Promise<Array<{ id: string; advertiser_id: string }>> {
  const { data: queued } = await admin
    .from('ad_campaigns')
    .select('id, advertiser_id, plan:plan_id (slot_limit, duration_days)')
    .eq('ad_type', adType)
    .eq('target_region', region)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })

  const promoted: Array<{ id: string; advertiser_id: string }> = []

  for (const c of queued ?? []) {
    const plan = c.plan as unknown as { slot_limit: number; duration_days: number } | null
    const slot = await checkSlotAvailability({
      ad_type:         adType,
      region,
      plan_slot_limit: plan?.slot_limit ?? 1,
    })
    if (!slot.available) break // full again — remaining queue waits for next opening

    const now = new Date()
    await admin.from('ad_campaigns').update({
      status:     'active',
      starts_at:  now.toISOString(),
      expires_at: new Date(now.getTime() + (plan?.duration_days ?? 30) * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', c.id)

    promoted.push({ id: c.id, advertiser_id: c.advertiser_id })
  }

  return promoted
}
