import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgFeatures, checkLimit } from '@/lib/subscription/featureGate'

type Params = { params: { id: string } }

// GET /api/v1/organizations/:id/units
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

    if (!membership && !isAdminStaff) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const { data, error } = await admin
      .from('property_units')
      .select(`
        *,
        listing:listings(id, title, district, region, images),
        active_lease:leases(
          id, tenant_id, start_date, end_date, monthly_rent, status,
          tenant:users!tenant_id(id, full_name, phone)
        )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Flatten: active_lease is an array from supabase, grab the first active one
    const units = (data ?? []).map((u: Record<string, unknown>) => {
      const leases = (u.active_lease as Array<{ status: string }>) ?? []
      return { ...u, active_lease: leases.find((l) => l.status === 'active') ?? null }
    })

    return NextResponse.json({ units })
  } catch (err) {
    console.error('[GET /organizations/:id/units]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/:id/units
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
    const canWrite = isAdminStaff || ['owner', 'branch_manager', 'agent'].includes(membership?.role ?? '')

    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa ya kuongeza kitengo' }, { status: 403 })

    // Feature gate: check max_units limit
    if (!isAdminStaff) {
      const [features, { count: unitCount }] = await Promise.all([
        getOrgFeatures(orgId),
        admin.from('property_units').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      ])
      const gate = checkLimit(unitCount ?? 0, features.max_units, 'vitengo')
      if (!gate.ok) return NextResponse.json({ error: gate.error, upgrade_required: true }, { status: gate.status })
    }

    const body = await req.json()
    const { listing_id, unit_number, unit_type = 'whole', bedrooms, bathrooms,
            floor_number, monthly_rent, deposit_months = 1, description } = body

    if (!listing_id) return NextResponse.json({ error: 'listing_id inahitajika' }, { status: 400 })
    if (!unit_number?.trim()) return NextResponse.json({ error: 'Nambari ya kitengo inahitajika' }, { status: 400 })
    if (!monthly_rent || monthly_rent <= 0) return NextResponse.json({ error: 'Kodi ya kila mwezi inahitajika' }, { status: 400 })

    // Verify listing belongs to this org
    const { data: listing } = await admin
      .from('listings')
      .select('id, managing_org_id')
      .eq('id', listing_id)
      .single()

    if (!listing) return NextResponse.json({ error: 'Mali haipatikani' }, { status: 404 })
    if (listing.managing_org_id !== orgId && !isAdminStaff) {
      return NextResponse.json({ error: 'Mali hii si ya shirika lako' }, { status: 403 })
    }

    const { data: unit, error } = await admin
      .from('property_units')
      .insert({
        listing_id,
        org_id: orgId,
        unit_number: unit_number.trim(),
        unit_type,
        bedrooms: bedrooms || null,
        bathrooms: bathrooms || null,
        floor_number: floor_number || null,
        monthly_rent,
        deposit_months,
        description: description?.trim() || null,
        status: 'vacant',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ unit }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/:id/units]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
