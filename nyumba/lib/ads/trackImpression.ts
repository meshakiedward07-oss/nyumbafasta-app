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
  await admin.from('ad_impressions').upsert(
    campaignIds.map(id => ({
      session_id:  sessionId,
      campaign_id: id,
      shown_at:    now,
    })),
    { onConflict: 'session_id,campaign_id' },
  )
}
