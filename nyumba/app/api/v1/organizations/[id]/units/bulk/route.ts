import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgFeatures, checkLimit } from '@/lib/subscription/featureGate'

type Params = { params: Promise<{ id: string }> }

type UnitRow = {
  listing_id:     string
  unit_number:    string
  floor_number?:  number | null
  unit_type?:     string
  bedrooms?:      number | null
  bathrooms?:     number | null
  monthly_rent:   number
  deposit_months?: number
  amenities?:     string[]
}

// POST /api/v1/organizations/:id/units/bulk — bulk-create units from building setup wizard
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [memberRes, profileRes] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])

    const isAdminStaff = ['admin', 'staff'].includes(profileRes.data?.role ?? '')
    const canWrite     = isAdminStaff || ['owner', 'branch_manager'].includes(memberRes.data?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body  = await req.json()
    const units = body.units as UnitRow[]

    if (!Array.isArray(units) || units.length === 0)
      return NextResponse.json({ error: 'Orodha ya vitengo inahitajika' }, { status: 400 })
    if (units.length > 200)
      return NextResponse.json({ error: 'Hauwezi kuunda zaidi ya vitengo 200 kwa wakati mmoja' }, { status: 400 })

    // Feature gate: check total against plan limit
    if (!isAdminStaff) {
      const [features, { count: existing }] = await Promise.all([
        getOrgFeatures(orgId),
        admin.from('property_units').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      ])
      const gate = checkLimit((existing ?? 0) + units.length, features.max_units, 'vitengo')
      if (!gate.ok) return NextResponse.json({ error: gate.error, upgrade_required: true }, { status: gate.status })
    }

    // Verify all listing_ids belong to this org
    const listingIds = [...new Set(units.map(u => u.listing_id))]
    for (const lid of listingIds) {
      const { data: listing } = await admin.from('listings').select('managing_org_id').eq('id', lid).single()
      if (!listing) return NextResponse.json({ error: `Mali ${lid} haipatikani` }, { status: 404 })
      if (!isAdminStaff && listing.managing_org_id !== orgId)
        return NextResponse.json({ error: 'Mali hii si ya shirika lako' }, { status: 403 })
    }

    const rows = units.map(u => ({
      listing_id:     u.listing_id,
      org_id:         orgId,
      unit_number:    u.unit_number.trim(),
      floor_number:   u.floor_number ?? null,
      unit_type:      u.unit_type   ?? 'apartment',
      bedrooms:       u.bedrooms    ?? null,
      bathrooms:      u.bathrooms   ?? null,
      monthly_rent:   u.monthly_rent,
      deposit_months: u.deposit_months ?? 1,
      amenities:      u.amenities   ?? [],
      status:         'vacant',
    }))

    const { data: inserted, error } = await admin
      .from('property_units')
      .insert(rows)
      .select()

    if (error) throw error
    return NextResponse.json({ units: inserted ?? [], count: inserted?.length ?? 0 }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/:id/units/bulk]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
