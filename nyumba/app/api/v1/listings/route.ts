import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rateLimit'
import { validateListing } from '@/lib/security/validate'
import { cached, TTL } from '@/lib/cache/memoryCache'

// Public listing fields — NEVER include whatsapp_number here
const PUBLIC_LISTING_FIELDS = `
  id, title, type, status, price_monthly,
  district, region, ward, furnished, amenities,
  images, is_boosted, boosted_until,
  view_count, lead_count, share_count, latitude, longitude,
  created_at,
  dalali:dalali_id (
    id, full_name, avatar_url,
    dalali_profiles ( rating_avg, is_premium_verified, is_favourite_dalali )
  )
`

// GET /api/v1/listings — public search with server-side caching
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const region   = searchParams.get('region')    ?? ''
  const type     = searchParams.get('type')      ?? ''
  const furnished = searchParams.get('furnished') ?? ''
  const minPrice = searchParams.get('min_price') ?? ''
  const maxPrice = searchParams.get('max_price') ?? ''
  const search   = searchParams.get('search')    ?? ''
  const page     = Math.max(0, parseInt(searchParams.get('page') ?? '0'))
  const limit    = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '10')), 50)
  const from     = page * limit

  // Rate limit: 120 requests per minute per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
  const rl = await rateLimit(`listings-get:${ip}`, 120, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // Cache key — unique per filter combination
  const cacheKey = `listings:${region}:${type}:${furnished}:${minPrice}:${maxPrice}:${search}:${page}:${limit}`

  const data = await cached(cacheKey, TTL.LISTINGS_PAGE, async () => {
    const admin = createAdminClient()
    let query = admin
      .from('listings')
      .select(PUBLIC_LISTING_FIELDS, { count: 'exact' })
      .eq('status', 'active')
      .order('is_boosted', { ascending: false })
      .order('boosted_until', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    if (region)    query = query.eq('region', region)
    if (type)      query = query.eq('type', type)
    if (furnished) query = query.eq('furnished', furnished === 'true')
    if (minPrice)  query = query.gte('price_monthly', parseInt(minPrice))
    if (maxPrice)  query = query.lte('price_monthly', parseInt(maxPrice))
    if (search) {
      const term = search.replace(/[%_]/g, '\\$&')
      query = query.or(`title.ilike.%${term}%,district.ilike.%${term}%,ward.ilike.%${term}%,mtaa.ilike.%${term}%`)
    }

    const { data: listings, count, error } = await query
    if (error) throw error
    return { listings: listings ?? [], total: count ?? 0, page, limit }
  })

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  })
}

const PLAN_LIMITS: Record<string, number> = {
  free:       2,
  basic:      5,
  premium:   20,
  enterprise: 50,
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    // Verify dalali role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'dalali' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Dalali tu wanaweza kuongeza listings' }, { status: 403 })
    }

    // 20 listings per hour per user
    const rl = await rateLimit(`create-listing:${user.id}`, 20, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Umefika kikomo cha kuunda listings.' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Check active subscription
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('plan, extra_listings')
      .eq('dalali_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .maybeSingle()

    // 0 when no active subscription; add purchased extra slots on top of plan base
    const baseLimit  = subscription ? (PLAN_LIMITS[subscription.plan] ?? 0) : 0
    const extraSlots = subscription?.extra_listings ?? 0
    const limit      = baseLimit + extraSlots

    const { count } = await admin
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('dalali_id', user.id)
      .in('status', ['active', 'pending'])

    if ((count ?? 0) >= limit) {
      const planName = subscription?.plan ?? 'free'
      return NextResponse.json(
        {
          error: `Umefika kikomo cha listings (${limit}) kwa plan ya ${planName}. Upgrade ili kuongeza zaidi.`,
          limit_reached: true,
        },
        { status: 403 }
      )
    }

    // Parse and validate body
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Taarifa si sahihi' }, { status: 400 })

    const parsed = validateListing(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Taarifa si sahihi', details: parsed.errors }, { status: 400 })
    }
    const data = parsed.data

    const typeLabels: Record<string, string> = {
      chumba: 'Chumba', apartment: 'Apartment',
      nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
    }
    // Explicit allowlist insert — no spread of raw body (mass-assignment safe)
    const insertPayload: Record<string, unknown> = {
      dalali_id: user.id,
      type: data.type,
      title: `${typeLabels[data.type] ?? data.type} – ${data.district}`,
      status: 'pending',
      price_monthly: data.price_monthly,
      furnished: data.furnished,
      description: data.description,
      region: data.region,
      district: data.district,
      ward: data.ward,
      mtaa: data.mtaa,
      amenities: data.amenities,
      images: data.images,
      video_url: data.video_url,
      street: '',
      directions: '',
      is_boosted: false,
      view_count: 0,
      lead_count: 0,
      latitude: data.latitude,
      longitude: data.longitude,
      address_full: data.address_full,
      place_id: data.place_id,
      listing_unit_type: data.listing_unit_type,
      total_capacity: data.total_capacity,
      current_occupancy: 0,
      auto_deactivate_on_full: data.auto_deactivate_on_full,
    }
    if (data.bedrooms !== null) insertPayload.bedrooms = data.bedrooms
    if (data.shop_size_sqm !== null) insertPayload.shop_size_sqm = data.shop_size_sqm
    if (data.floor_level !== null) insertPayload.floor_level = data.floor_level
    if (data.commercial_use !== null) insertPayload.commercial_use = data.commercial_use

    const { data: listing, error: insertError } = await admin
      .from('listings')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insertError || !listing) {
      return NextResponse.json({ error: insertError?.message ?? 'Imeshindwa kuunda listing' }, { status: 500 })
    }

    return NextResponse.json({ id: listing.id, status: 'pending' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
