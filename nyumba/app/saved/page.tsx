import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SavedClient from '@/components/client/SavedClient'
import type { ListingWithDalali } from '@/lib/types/database'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/saved')

  const { data, error } = await supabase
    .from('saved_listings')
    .select(`
      id, listing_id,
      listings (
        id, title, type, status, price_monthly,
        district, region, furnished, amenities,
        images, is_boosted, view_count, lead_count,
        dalali:dalali_id (
          id, full_name, avatar_url,
          dalali_profiles ( rating_avg, is_premium_verified, is_favourite_dalali )
        )
      )
    `)
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const saved = (data ?? []).map(s => ({
    savedId: s.id,
    listing: s.listings as unknown as ListingWithDalali,
  })).filter(s => s.listing)

  return <SavedClient saved={saved} role={userRow?.role ?? 'client'} />
}
