import { createAdminClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/whatsapp/client'

export async function checkStaleListings(): Promise<{ checked: number }> {
  const admin = createAdminClient()
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: stale } = await admin
    .from('listings')
    .select('id, title, type, district, current_occupancy, total_capacity, dalali_id, users!dalali_id(full_name, phone)')
    .eq('status', 'active')
    .eq('listing_unit_type', 'multi')
    .or(`occupancy_last_updated.is.null,occupancy_last_updated.lt.${twoWeeksAgo}`)

  for (const listing of stale ?? []) {
    const dalali = (listing as unknown as { users?: { full_name?: string; phone?: string } }).users
    if (!dalali?.phone) continue

    const title = listing.title || `${listing.type} — ${listing.district}`
    await sendTextMessage(
      dalali.phone,
      `⏰ Ukumbusho — NyumbaFasta\n\nListing yako "${title}" haijasasishwa kwa wiki 2.\n\nHali ya sasa: ${listing.current_occupancy ?? 0}/${listing.total_capacity} wamejaa.\n\nTafadhali sasisha idadi ya wapangaji ili listing iendelee kuwa sahihi:\nnyumbafasta.co/dashboard/listings`,
    ).catch(() => {})
  }

  return { checked: stale?.length ?? 0 }
}
