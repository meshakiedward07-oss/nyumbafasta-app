import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditListingClient from '@/components/dalali/EditListingClient'

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, type, status, price_monthly, bedrooms, furnished, description, region, district, amenities, images, video_url, latitude, longitude, address_full, place_id, commission_type, commission_value, commission_notes, listing_unit_type, total_capacity, auto_deactivate_on_full')
    .eq('id', id)
    .eq('dalali_id', user!.id)
    .single()

  if (!listing) notFound()

  return <EditListingClient listing={listing} />
}
