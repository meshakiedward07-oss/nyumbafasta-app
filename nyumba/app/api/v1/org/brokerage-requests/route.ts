import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ── GET /api/v1/org/brokerage-requests ──────────────────────────────────────
// Returns this org's brokerage requests.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Find the user's org
    const { data: membership } = await admin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'branch_manager', 'agent', 'accountant'])
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!membership) return NextResponse.json({ error: 'Huna shirika' }, { status: 403 })

    const status = req.nextUrl.searchParams.get('status') ?? ''

    let query = admin
      .from('brokerage_requests')
      .select(`
        id, title, listing_type, price_monthly, region, district,
        status, commission_status, commission_amount,
        agreed_at, created_at, updated_at,
        images, org_contact_phone,
        listing_id,
        rejection_reason,
        deal_closed_at,
        listing:listings!listing_id(id, title, status, images)
      `)
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ requests: data ?? [] })
  } catch (err) {
    console.error('[GET /org/brokerage-requests]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// ── POST /api/v1/org/brokerage-requests ─────────────────────────────────────
// Org submits a new brokerage request (request NF to find a tenant).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Verify org membership with management role
    const { data: membership } = await admin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'branch_manager', 'agent'])
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Huna ruhusa ya kuwasilisha ombi hili' }, { status: 403 })
    }

    const body = await req.json()
    const {
      unit_id,
      title, listing_type, description,
      price_monthly, deposit_months, bedrooms, furnished,
      region, district, ward, mtaa,
      amenities, images,
      org_contact_name, org_contact_phone,
      agreed_broker_terms, agreed_commission,
    } = body

    // Validate required fields
    if (!title?.trim())         return NextResponse.json({ error: 'Jina la tangazo linahitajika' }, { status: 400 })
    if (!price_monthly || price_monthly <= 0)
                                return NextResponse.json({ error: 'Bei ya mwezi inahitajika' }, { status: 400 })
    if (!region?.trim())        return NextResponse.json({ error: 'Mkoa unahitajika' }, { status: 400 })
    if (!district?.trim())      return NextResponse.json({ error: 'Wilaya inahitajika' }, { status: 400 })
    if (!org_contact_phone?.trim())
                                return NextResponse.json({ error: 'Nambari ya mawasiliano inahitajika' }, { status: 400 })
    if (!agreed_broker_terms)   return NextResponse.json({ error: 'Lazima ukubali masharti ya wakili' }, { status: 400 })
    if (!agreed_commission)     return NextResponse.json({ error: 'Lazima ukubali masharti ya kamisheni' }, { status: 400 })

    // Check unit belongs to this org (if provided)
    if (unit_id) {
      const { data: unit } = await admin
        .from('property_units')
        .select('id, status')
        .eq('id', unit_id)
        .single()
      if (!unit) return NextResponse.json({ error: 'Kitengo hakipatikani' }, { status: 404 })
    }

    // Block duplicate pending/approved requests for same unit
    if (unit_id) {
      const { data: existing } = await admin
        .from('brokerage_requests')
        .select('id')
        .eq('unit_id', unit_id)
        .in('status', ['pending', 'approved', 'listed'])
        .limit(1)
        .single()
      if (existing) {
        return NextResponse.json({ error: 'Kitengo hiki tayari kina ombi la brokerage linaloendelea' }, { status: 409 })
      }
    }

    const commission_amount = Number(price_monthly) // 1 month rent

    const { data, error } = await admin
      .from('brokerage_requests')
      .insert({
        org_id:             membership.org_id,
        unit_id:            unit_id || null,
        submitted_by:       user.id,
        title:              title.trim(),
        listing_type:       listing_type || 'apartment',
        description:        description?.trim() || null,
        price_monthly:      Number(price_monthly),
        deposit_months:     Number(deposit_months) || 1,
        bedrooms:           bedrooms ? Number(bedrooms) : null,
        furnished:          furnished || 'empty',
        region:             region.trim(),
        district:           district.trim(),
        ward:               ward?.trim() || null,
        mtaa:               mtaa?.trim() || null,
        amenities:          amenities || [],
        images:             images || [],
        org_contact_name:   org_contact_name?.trim() || null,
        org_contact_phone:  org_contact_phone.trim(),
        agreed_broker_terms: true,
        agreed_commission:   true,
        commission_amount,
        agreed_at:          new Date().toISOString(),
        status:             'pending',
        commission_status:  'pending',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ request: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /org/brokerage-requests]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
