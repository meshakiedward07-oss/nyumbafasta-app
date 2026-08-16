import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; unitId: string }> }

// PATCH /api/v1/organizations/:id/units/:unitId
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId, unitId } = await params
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
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const allowed = ['unit_number', 'unit_type', 'bedrooms', 'bathrooms', 'floor_number',
                     'monthly_rent', 'deposit_months', 'status', 'description']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }
    updates.updated_at = new Date().toISOString()

    const { data: unit, error } = await admin
      .from('property_units')
      .update(updates)
      .eq('id', unitId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error
    if (!unit) return NextResponse.json({ error: 'Kitengo hakipatikani' }, { status: 404 })
    return NextResponse.json({ unit })
  } catch (err) {
    console.error('[PATCH /units/:unitId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/organizations/:id/units/:unitId
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: orgId, unitId } = await params
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
    const isOwner = isAdminStaff || membership?.role === 'owner'
    if (!isOwner) return NextResponse.json({ error: 'Mmiliki tu anaweza kufuta kitengo' }, { status: 403 })

    // Block if occupied
    const { count } = await admin
      .from('leases')
      .select('*', { count: 'exact', head: true })
      .eq('unit_id', unitId)
      .eq('status', 'active')

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Haiwezekani kufuta kitengo chenye mpangaji' }, { status: 409 })
    }

    const { error } = await admin
      .from('property_units')
      .delete()
      .eq('id', unitId)
      .eq('org_id', orgId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /units/:unitId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
