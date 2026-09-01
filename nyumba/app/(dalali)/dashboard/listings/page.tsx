import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Listing } from '@/lib/types/database'
import MyListingsClient from '@/components/dalali/MyListingsClient'
import { isSoftDeletedListing } from '@/lib/listings/isSoftDeleted'

export const dynamic = 'force-dynamic'

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ renew?: string }>
}) {
  const { renew } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Use admin client to bypass RLS — dalali_id filter ensures we only fetch their own listings
  const admin = createAdminClient()
  // Soft-deleted listings (status='expired' + an epoch expires_at sentinel
  // — see lib/listings/isSoftDeleted.ts) must not reappear here. Found
  // 2026-09-01: the filter below used to check `l.status !== 'deleted'`,
  // but 'deleted' is not a real status value — DELETE /api/v1/listings/[id]
  // uses 'expired' instead ('deleted' isn't in the DB enum) — so that
  // check never matched anything and deleted listings kept showing up.
  const { data, error } = await admin
    .from('listings')
    .select('id, title, type, status, price_monthly, district, region, images, view_count, lead_count, share_count, created_at, is_boosted, boosted_until, expires_at')
    .eq('dalali_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(100)

  let listings: Listing[] = []
  if (error) {
    const { data: fallback } = await admin
      .from('listings')
      .select('id, title, type, status, price_monthly, district, region, images, view_count, lead_count, created_at, is_boosted')
      .eq('dalali_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(100)
    listings = ((fallback as Listing[]) ?? []).filter(l => !isSoftDeletedListing(l.status, null))
  } else {
    listings = ((data as Listing[]) ?? []).filter(l => !isSoftDeletedListing(l.status, l.expires_at))
  }

  return (
    <MyListingsClient
      listings={listings}
      autoRenewId={renew}
    />
  )
}
