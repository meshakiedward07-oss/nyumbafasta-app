import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string; vendorId: string } }

// PATCH /api/v1/organizations/:id/vendors/:vendorId
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId, vendorId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: membership }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager', 'agent'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data: existing } = await admin.from('vendors').select('org_id').eq('id', vendorId).maybeSingle()
    if (!existing || existing.org_id !== orgId) return NextResponse.json({ error: 'Mchezaji hapatikani' }, { status: 404 })

    const body = await req.json()
    const { name, category, phone, email, specialty, location, notes, is_active, rating_avg } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name      !== undefined) updates.name      = name?.trim() || existing
    if (category  !== undefined) updates.category  = category
    if (phone     !== undefined) updates.phone     = phone?.trim()    || null
    if (email     !== undefined) updates.email     = email?.trim()    || null
    if (specialty !== undefined) updates.specialty = specialty?.trim()|| null
    if (location  !== undefined) updates.location  = location?.trim() || null
    if (notes     !== undefined) updates.notes     = notes?.trim()    || null
    if (is_active !== undefined) updates.is_active = is_active
    if (rating_avg !== undefined) updates.rating_avg = rating_avg

    const { data: vendor, error } = await admin.from('vendors').update(updates).eq('id', vendorId).select().single()
    if (error) throw error
    return NextResponse.json({ vendor })
  } catch (err) {
    console.error('[PATCH /organizations/:id/vendors/:vendorId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/organizations/:id/vendors/:vendorId  (soft delete)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: orgId, vendorId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: membership }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data: existing } = await admin.from('vendors').select('org_id').eq('id', vendorId).maybeSingle()
    if (!existing || existing.org_id !== orgId) return NextResponse.json({ error: 'Mchezaji hapatikani' }, { status: 404 })

    await admin.from('vendors').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', vendorId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /organizations/:id/vendors/:vendorId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
