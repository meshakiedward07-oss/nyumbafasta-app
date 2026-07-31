import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()

  // Fetch the source listing, ensuring it belongs to this dalali
  const { data: src, error: fetchErr } = await admin
    .from('listings')
    .select(`
      type, price_monthly, bedrooms, furnished, description,
      region, district, ward, mtaa, amenities, images, video_url,
      street, directions, latitude, longitude, address_full, place_id,
      listing_unit_type, total_capacity, auto_deactivate_on_full,
      shop_size_sqm, floor_level, commercial_use,
      commission_type, commission_value, commission_notes
    `)
    .eq('id', id)
    .eq('dalali_id', user.id)
    .single()

  if (fetchErr || !src) return Response.json({ error: 'Listing haipatikani' }, { status: 404 })

  // Check listing slot availability
  const { data: canPost } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('dalali_id', user.id)
    .in('status', ['active', 'grace_period', 'trial'])
    .maybeSingle()

  const PLAN_LIMITS: Record<string, number> = { free: 2, basic: 5, premium: 20, enterprise: 50 }
  const limit = PLAN_LIMITS[canPost?.plan ?? 'free'] ?? 2
  const { count } = await admin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('dalali_id', user.id)
    .not('status', 'in', '("expired","rejected")')

  if ((count ?? 0) >= limit) {
    return Response.json({ error: `Umefika kikomo cha listings (${limit}) kwa mpango wako` }, { status: 403 })
  }

  const TYPE_LABELS: Record<string, string> = {
    chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
  }
  const typeLabel = TYPE_LABELS[src.type] ?? src.type

  const insert: Record<string, unknown> = {
    dalali_id:            user.id,
    type:                 src.type,
    title:                `${typeLabel} – ${src.district} (Nakili)`,
    status:               'pending',
    price_monthly:        src.price_monthly,
    furnished:            src.furnished,
    description:          src.description,
    region:               src.region,
    district:             src.district,
    ward:                 src.ward,
    mtaa:                 src.mtaa,
    amenities:            src.amenities,
    images:               src.images,
    video_url:            src.video_url,
    street:               src.street ?? '',
    directions:           src.directions ?? '',
    latitude:             src.latitude,
    longitude:            src.longitude,
    address_full:         src.address_full,
    place_id:             src.place_id,
    listing_unit_type:    src.listing_unit_type,
    total_capacity:       src.total_capacity,
    current_occupancy:    0,
    auto_deactivate_on_full: src.auto_deactivate_on_full,
    is_boosted:           false,
    view_count:           0,
    lead_count:           0,
    share_count:          0,
    commission_type:      src.commission_type,
    commission_value:     src.commission_value,
    commission_notes:     src.commission_notes,
  }
  if (src.bedrooms)      insert.bedrooms      = src.bedrooms
  if (src.shop_size_sqm) insert.shop_size_sqm = src.shop_size_sqm
  if (src.floor_level)   insert.floor_level   = src.floor_level
  if (src.commercial_use !== undefined) insert.commercial_use = src.commercial_use

  const { data: newListing, error: insertErr } = await admin
    .from('listings')
    .insert(insert)
    .select('id, title, status')
    .single()

  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

  return Response.json({ listing: newListing }, { status: 201 })
}
