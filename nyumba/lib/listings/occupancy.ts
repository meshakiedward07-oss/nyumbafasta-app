import { createAdminClient } from '@/lib/supabase/server'

interface OccupancyUpdate {
  listingId: string
  newOccupancy: number
  changedBy: string
  reason?: string
}

export async function updateOccupancy(params: OccupancyUpdate): Promise<{
  success: boolean
  autoDeactivated: boolean
  error?: string
}> {
  const admin = createAdminClient()

  const { data: listing } = await admin
    .from('listings')
    .select('current_occupancy, total_capacity, status, auto_deactivate_on_full, dalali_id')
    .eq('id', params.listingId)
    .single()

  if (!listing) return { success: false, autoDeactivated: false, error: 'Listing haikupatikana' }

  if (params.newOccupancy < 0)
    return { success: false, autoDeactivated: false, error: 'Idadi haiwezi kuwa hasi' }

  if (params.newOccupancy > listing.total_capacity)
    return { success: false, autoDeactivated: false, error: `Idadi haiwezi kuzidi capacity ya ${listing.total_capacity}` }

  const wasActive = listing.status === 'active'
  const willBeFull = params.newOccupancy >= listing.total_capacity

  const { error } = await admin
    .from('listings')
    .update({ current_occupancy: params.newOccupancy })
    .eq('id', params.listingId)

  if (error) return { success: false, autoDeactivated: false, error: error.message }

  await admin.from('listing_occupancy_log').insert({
    listing_id: params.listingId,
    previous_occupancy: listing.current_occupancy,
    new_occupancy: params.newOccupancy,
    changed_by: params.changedBy,
    change_reason: params.reason ?? 'manual_update',
  })

  const autoDeactivated = wasActive && willBeFull && listing.auto_deactivate_on_full

  if (autoDeactivated) {
    // Mark listing as taken and record when it was auto-closed
    await admin
      .from('listings')
      .update({ status: 'taken', auto_deactivated_at: new Date().toISOString() })
      .eq('id', params.listingId)

    // Notify dalali (non-blocking)
    if (listing.dalali_id) {
      void admin.from('notifications').insert({
        user_id: listing.dalali_id,
        title: '🏠 Listing Imejaa!',
        body: 'Wapangaji wote wanaohitajika wamepata — listing yako imefungwa otomatiki. Unaweza kuifungua tena ukihitaji.',
        type: 'listing_full',
        is_read: false,
        ref_id: params.listingId,
      })
    }

    // Facebook Marketplace sync (non-blocking)
    void (async () => {
      try {
        const { markMarketplaceItemTaken } = await import('@/lib/social/facebookMarketplace')
        const { data: mlisting } = await admin
          .from('marketplace_listings')
          .select('retailer_id')
          .eq('listing_id', params.listingId)
          .single()
        if (mlisting?.retailer_id) {
          await markMarketplaceItemTaken(mlisting.retailer_id)
        }
      } catch (err) {
        console.error('[Occupancy] Marketplace sync failed:', err)
      }
    })()
  }

  return { success: true, autoDeactivated }
}

export async function incrementOccupancy(listingId: string, changedBy: string) {
  const admin = createAdminClient()
  const { data: listing } = await admin
    .from('listings')
    .select('current_occupancy')
    .eq('id', listingId)
    .single()
  if (!listing) return { success: false, autoDeactivated: false }
  return updateOccupancy({
    listingId,
    newOccupancy: (listing.current_occupancy ?? 0) + 1,
    changedBy,
    reason: 'tenant_added',
  })
}

export async function resetOccupancy(listingId: string, changedBy: string, reactivate = true) {
  const admin = createAdminClient()
  await updateOccupancy({ listingId, newOccupancy: 0, changedBy, reason: 'reset' })
  if (reactivate) {
    await admin
      .from('listings')
      .update({ status: 'active', auto_deactivated_at: null })
      .eq('id', listingId)
  }
}
