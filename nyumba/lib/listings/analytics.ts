import { createAdminClient } from '@/lib/supabase/server'

export interface ListingAnalytics {
  totalViews:     number
  totalLeads:     number   // contact_unlocks
  totalShares:    number
  totalSaves:     number
  avgRating:      number
  ratingCount:    number
  performanceScore: number // 0-100
}

export async function getListingAnalytics(listingId: string): Promise<ListingAnalytics> {
  const admin = createAdminClient()

  // Run all queries in parallel — all from existing tables, always available
  const [listingRes, savesRes, reviewsRes] = await Promise.all([
    admin
      .from('listings')
      .select('view_count, lead_count, share_count')
      .eq('id', listingId)
      .maybeSingle(),

    admin
      .from('saved_listings')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId),

    admin
      .from('reviews')
      .select('rating')
      .eq('listing_id', listingId),
  ])

  const totalViews  = listingRes.data?.view_count  ?? 0
  const totalLeads  = listingRes.data?.lead_count  ?? 0
  const totalShares = listingRes.data?.share_count ?? 0
  const totalSaves  = savesRes.count ?? 0

  const ratings    = reviewsRes.data?.map(r => r.rating) ?? []
  const ratingCount = ratings.length
  const avgRating   = ratingCount > 0
    ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratingCount) * 10) / 10
    : 0

  // Performance: views×0.5 + leads×5 + saves×3 + rating×10, capped at 100
  const performanceScore = Math.min(100, Math.round(
    totalViews  * 0.5 +
    totalLeads  * 5   +
    totalSaves  * 3   +
    avgRating   * 10
  ))

  return { totalViews, totalLeads, totalShares, totalSaves, avgRating, ratingCount, performanceScore }
}
