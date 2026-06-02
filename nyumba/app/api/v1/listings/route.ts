import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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

    const admin = createAdminClient()

    // Check active subscription
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('plan')
      .eq('dalali_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .maybeSingle()

    // Check listing limit (free plan has 2, paid plans have more)
    const limit = subscription ? (PLAN_LIMITS[subscription.plan] ?? 2) : 2
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
    const body = await req.json()
    const { type, price_monthly, bedrooms, furnished, description, region, district, amenities, images, video_url, latitude, longitude } = body

    if (!type || !price_monthly || !region || !district) {
      return NextResponse.json({ error: 'Thamani zinazohitajika hazijajazwa' }, { status: 400 })
    }

    if (!['chumba', 'apartment', 'nyumba', 'studio'].includes(type)) {
      return NextResponse.json({ error: 'Aina ya listing si sahihi' }, { status: 400 })
    }

    const insertPayload: Record<string, unknown> = {
      dalali_id: user.id,
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} – ${district}`,
      status: 'pending',
      price_monthly: Number(price_monthly),
      furnished: furnished ?? 'empty',
      description: description ?? null,
      region,
      district,
      amenities: amenities ?? [],
      images: images ?? [],
      video_url: video_url ?? null,
      street: '',
      directions: '',
      is_boosted: false,
      view_count: 0,
      lead_count: 0,
      latitude:  typeof latitude  === 'number' ? latitude  : null,
      longitude: typeof longitude === 'number' ? longitude : null,
    }
    if (bedrooms !== undefined) insertPayload.bedrooms = bedrooms ?? null

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
