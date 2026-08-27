import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgFeatures, checkLimit } from '@/lib/subscription/featureGate'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/:id/mali — list listings managed by this org
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { count: membership } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', user.id)

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!membership && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data: listings, error, count } = await admin
      .from('listings')
      .select(`
        id, title, type, district, region, price_monthly, images,
        status, lifecycle_status, listing_source, created_at,
        bedrooms, amenities,
        unit_count:property_units(count),
        occupied_count:property_units(count)
      `, { count: 'exact' })
      .eq('managing_org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // compute occupancy from property_units directly
    const { data: unitStats } = await admin
      .from('property_units')
      .select('listing_id, status')
      .eq('org_id', orgId)

    const statsMap: Record<string, { total: number; occupied: number }> = {}
    for (const u of unitStats ?? []) {
      if (!statsMap[u.listing_id]) statsMap[u.listing_id] = { total: 0, occupied: 0 }
      statsMap[u.listing_id].total++
      if (u.status === 'occupied') statsMap[u.listing_id].occupied++
    }

    const enriched = (listings ?? []).map(l => ({
      ...l,
      unit_count:    statsMap[l.id]?.total    ?? 0,
      occupied_count: statsMap[l.id]?.occupied ?? 0,
    }))

    return NextResponse.json({ listings: enriched, total: count ?? 0 })
  } catch (err) {
    console.error('[GET /organizations/:id/mali]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/:id/mali — create a new managed listing
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    // Feature gate: check max_properties limit
    if (!isAdminStaff) {
      const [features, { count: propCount }] = await Promise.all([
        getOrgFeatures(orgId),
        admin.from('listings').select('id', { count: 'exact', head: true }).eq('managing_org_id', orgId),
      ])
      const gate = checkLimit(propCount ?? 0, features.max_properties, 'mali')
      if (!gate.ok) return NextResponse.json({ error: gate.error, upgrade_required: true }, { status: gate.status })
    }

    const body = await req.json()
    const { title, type = 'nyumba', district, region, price_monthly,
            furnished = 'empty', bedrooms, description, amenities = [] } = body

    if (!title?.trim()) return NextResponse.json({ error: 'Jina la mali linahitajika' }, { status: 400 })
    if (!district?.trim()) return NextResponse.json({ error: 'Wilaya inahitajika' }, { status: 400 })
    if (!region?.trim()) return NextResponse.json({ error: 'Mkoa unahitajika' }, { status: 400 })
    if (!price_monthly || price_monthly <= 0) return NextResponse.json({ error: 'Bei ya kodi inahitajika' }, { status: 400 })

    // Defensive: guarantee a public.users row exists for this caller before
    // the listings insert below depends on it via its NOT NULL dalali_id FK.
    // Same fix applied to unlock/initiate — this project's handle_new_user
    // trigger has had multiple inconsistent versions over time, and a gap
    // here throws an FK violation that used to be indistinguishable from any
    // other error behind the generic "Hitilafu ya seva" catch-all below.
    const { data: existingUserRow } = await admin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (!existingUserRow) {
      const { error: userUpsertError } = await admin.from('users').upsert({
        id:        user.id,
        email:     user.email ?? null,
        phone:     user.phone ?? null,
        full_name: (user.user_metadata?.full_name as string | undefined) ?? 'Mtumiaji',
        role:      'client',
      }, { onConflict: 'id' })
      if (userUpsertError) {
        console.error('[POST /organizations/:id/mali] users upsert fallback failed:', userUpsertError.message)
      }
    }

    const { data: listing, error } = await admin
      .from('listings')
      .insert({
        dalali_id:       user.id,
        title:           title.trim(),
        type,
        district:        district.trim(),
        region:          region.trim(),
        price_monthly,
        furnished,
        bedrooms:        bedrooms || null,
        description:     description?.trim() || null,
        amenities,
        images:          [],
        status:          'active',
        listing_source:  'nyumbafasta_managed',
        lifecycle_status: 'listed',
        managing_org_id: orgId,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ listing }, { status: 201 })
  } catch (err) {
    const pgErr = err as { message?: string; code?: string; details?: string; hint?: string }
    console.error('[POST /organizations/:id/mali]', JSON.stringify({
      message: pgErr?.message, code: pgErr?.code, details: pgErr?.details, hint: pgErr?.hint,
    }))
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
