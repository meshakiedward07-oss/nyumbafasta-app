import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditListingClient from '@/components/dalali/EditListingClient'

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, type, status, price_monthly, bedrooms, furnished, description, region, district, amenities, images, latitude, longitude, address_full, place_id, commission_type, commission_value, commission_notes')
    .eq('id', params.id)
    .eq('dalali_id', user!.id)
    .single()

  if (!listing) notFound()

  return <EditListingClient listing={listing} />
}
