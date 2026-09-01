import { createAdminClient } from '@/lib/supabase/server'

// Batch upsert impressions for a session.
// Uses ON CONFLICT (session_id, campaign_id) to update shown_at on re-show.
export async function trackImpressions(
  sessionId: string,
  campaignIds: string[],
): Promise<void> {
  if (!sessionId || !campaignIds.length) return
  const admin = createAdminClient()
  const now   = new Date().toISOString()

  // Which of these (session, campaign) pairs already have an impression row?
  // Needed BEFORE the upsert below, which would otherwise make every re-show
  // indistinguishable from a first-time impression once it lands.
  const { data: existingRows } = await admin
    .from('ad_impressions')
    .select('campaign_id')
    .eq('session_id', sessionId)
    .in('campaign_id', campaignIds)

  const alreadySeen = new Set((existingRows ?? []).map(r => r.campaign_id as string))
  const newIds       = campaignIds.filter(id => !alreadySeen.has(id))

  await admin.from('ad_impressions').upsert(
    campaignIds.map(id => ({
      session_id:  sessionId,
      campaign_id: id,
      shown_at:    now,
    })),
    { onConflict: 'session_id,campaign_id' },
  )

  // Increment the aggregate impression counter ONLY for genuinely new
  // impressions (non-atomic; acceptable for analytics). This used to
  // increment for every call regardless of whether the underlying
  // ad_impressions upsert was a fresh insert or just a shown_at refresh on
  // an existing row (e.g. the same session re-seeing the same ad within the
  // 4h frequency-cap window, or rankingEngine's "re-include recently seen"
  // fallback) — so the advertiser-facing impressions count (and therefore
  // CTR%) was inflated well above the true unique-impression total. Found
  // in the 2026-09-01 ads-system audit.
  if (newIds.length > 0) {
    const { data: campaigns } = await admin
      .from('ad_campaigns')
      .select('id, impressions')
      .in('id', newIds)

    if (campaigns?.length) {
      for (const c of campaigns) {
        await admin
          .from('ad_campaigns')
          .update({ impressions: (c.impressions ?? 0) + 1 })
          .eq('id', c.id)
      }
    }
  }
}
