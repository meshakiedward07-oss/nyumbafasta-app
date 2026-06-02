import { createClient } from '@/lib/supabase/server'
import type { Listing } from '@/lib/types/database'
import MyListingsClient from '@/components/dalali/MyListingsClient'

export default async function MyListingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('listings')
    .select('id, title, type, status, price_monthly, district, region, images, view_count, lead_count, share_count, created_at, is_boosted, boosted_until, expires_at, renewed_at, renewal_count')
    .eq('dalali_id', user!.id)
    .order('created_at', { ascending: false })

  return <MyListingsClient listings={(data as Listing[]) ?? []} />
}
