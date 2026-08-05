import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Listing } from '@/lib/types/database'
import MyListingsClient from '@/components/dalali/MyListingsClient'

export const dynamic = 'force-dynamic'

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: { renew?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Use admin client to bypass RLS — dalali_id filter ensures we only fetch their own listings
  const admin = createAdminClient()
  // Note: do NOT use .neq('status', 'deleted') — 'deleted' is not in the DB enum
  // and throws "invalid input value for enum listing_status". Filter in JS instead.
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
    listings = ((fallback as Listing[]) ?? []).filter(l => l.status !== 'deleted')
  } else {
    listings = ((data as Listing[]) ?? []).filter(l => l.status !== 'deleted')
  }

  return (
    <MyListingsClient
      listings={listings}
      autoRenewId={searchParams.renew}
    />
  )
}
