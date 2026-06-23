import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/security/rateLimit'
import { validateListing } from '@/lib/security/validate'

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
    const rl = rateLimit(`create-listing:${user.id}`, 20, 60 * 60 * 1000)
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
