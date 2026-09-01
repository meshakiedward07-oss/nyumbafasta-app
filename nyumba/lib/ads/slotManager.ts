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
  campaign: { id: string; ad_type: string; target_region: string; target_district?: string | null; target_wards?: string[] | null },
  planSlotLimit: number,
  durationDays: number,
): Promise<{ activated: boolean }> {
  const slot = await checkSlotAvailability({
    ad_type:         campaign.ad_type,
    region:          campaign.target_region,
    plan_slot_limit: planSlotLimit,
    district:        campaign.target_district,
    wards:           campaign.target_wards,
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
 * Called from the daily cron right after expiring campaigns, once per
 * exact geo-targeting tuple that actually freed up (ad_type + region +
 * district + wards — see fetcher.ts's checkSlotAvailability for why the
 * pool identity must be this exact). Activates queued campaigns matching
 * that SAME exact tuple, oldest first (FIFO — first paid, first served),
 * stopping as soon as checkSlotAvailability reports no more room. Returns
 * the promoted rows so the caller can send "your ad is live now"
 * notifications.
 *
 * Deliberate simplification: a queued campaign is only promoted when a
 * campaign with the IDENTICAL targeting tuple expires — e.g. a campaign
 * targeting wards [A,B] queued waiting for that exact pair does NOT get
 * promoted just because a campaign targeting ward [A] alone expired (A's
 * pool freeing doesn't mean B's pool did too). Solving the general
 * "any overlapping ward combination" case would need real per-ward
 * capacity bookkeeping; exact-tuple matching is correct and simple, at the
 * cost of occasionally leaving a multi-ward queued campaign waiting a
 * cycle longer than the tightest theoretical bound.
 */
export async function promoteQueuedCampaigns(
  admin: AnyClient,
  freed: { ad_type: string; region: string; district: string | null; wards: string[] | null },
): Promise<Array<{ id: string; advertiser_id: string }>> {
  let q = admin
    .from('ad_campaigns')
    .select('id, advertiser_id, target_wards, plan:plan_id (slot_limit, duration_days)')
    .eq('ad_type', freed.ad_type)
    .eq('target_region', freed.region)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })

  q = freed.district ? q.eq('target_district', freed.district) : q.is('target_district', null)

  const { data: candidates } = await q

  const freedWardsSorted = freed.wards && freed.wards.length > 0 ? [...freed.wards].sort() : null

  const matching = (candidates ?? []).filter(c => {
    const cWards = c.target_wards as string[] | null
    if (!freedWardsSorted) return !cWards || cWards.length === 0
    if (!cWards || cWards.length === 0) return false
    const sorted = [...cWards].sort()
    return sorted.length === freedWardsSorted.length && sorted.every((w, i) => w === freedWardsSorted[i])
  })

  const promoted: Array<{ id: string; advertiser_id: string }> = []

  for (const c of matching) {
    const plan = c.plan as unknown as { slot_limit: number; duration_days: number } | null
    const slot = await checkSlotAvailability({
      ad_type:         freed.ad_type,
      region:          freed.region,
      plan_slot_limit: plan?.slot_limit ?? 1,
      district:        freed.district,
      wards:           freed.wards,
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
