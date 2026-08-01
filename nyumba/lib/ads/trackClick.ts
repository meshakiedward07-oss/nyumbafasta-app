import { createAdminClient } from '@/lib/supabase/server'

export async function trackClick(campaignId: string): Promise<void> {
  if (!campaignId) return
  const admin = createAdminClient()
  const { data: c } = await admin
    .from('ad_campaigns')
    .select('clicks')
    .eq('id', campaignId)
    .single()
  if (c) {
    await admin
      .from('ad_campaigns')
      .update({ clicks: (c.clicks ?? 0) + 1 })
      .eq('id', campaignId)
  }
}
