import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/[id]/agreements
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: m } = await admin.from('organization_members').select('id').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
    const { data: u } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!m && !['admin', 'staff'].includes(u?.role ?? '')) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data, error } = await admin
      .from('management_agreements')
      .select(`
        *,
        landlord:users!landlord_id(id, full_name, phone),
        listing:listings(id, title, district, region, images)
      `)
      .eq('managing_org_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ agreements: data ?? [] })
  } catch (err) {
    console.error('[GET /organizations/[id]/agreements]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/[id]/agreements — create agreement
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: m } = await admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
    const { data: u } = await admin.from('users').select('role').eq('id', user.id).single()
    const canCreate = ['owner', 'branch_manager'].includes(m?.role ?? '') || ['admin', 'staff'].includes(u?.role ?? '')
    if (!canCreate) return NextResponse.json({ error: 'Huna ruhusa ya kuunda makubaliano' }, { status: 403 })

    const body = await req.json()
    const { landlord_id, listing_id, scope, commission_type, commission_value, start_date, end_date, notes } = body

    if (!landlord_id || !scope) return NextResponse.json({ error: 'landlord_id na scope zinahitajika' }, { status: 400 })
    if (!['maintenance_only', 'full_management', 'staff_assisted_listing'].includes(scope)) {
      return NextResponse.json({ error: 'Aina ya makubaliano si sahihi' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('management_agreements')
      .insert({ landlord_id, managing_org_id: id, listing_id: listing_id || null, scope, commission_type: commission_type || null, commission_value: commission_value || null, start_date: start_date || null, end_date: end_date || null, notes: notes?.trim() || null })
      .select(`*, landlord:users!landlord_id(id, full_name, phone), listing:listings(id, title, district, region)`)
      .single()

    if (error) throw error

    // If listing provided, link it to this org
    if (listing_id) {
      await admin.from('listings').update({ managing_org_id: id }).eq('id', listing_id)
    }

    return NextResponse.json({ agreement: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/[id]/agreements]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
