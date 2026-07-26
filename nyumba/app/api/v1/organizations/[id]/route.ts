import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Verify membership or admin
    const { data: userRow } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(userRow?.role ?? '')

    if (!isAdminStaff) {
      const { data: membership } = await admin.from('organization_members').select('id').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
      if (!membership) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const { data: org, error } = await admin
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !org) return NextResponse.json({ error: 'Shirika halijapatikana' }, { status: 404 })

    const { data: members } = await admin
      .from('organization_members')
      .select('id, role, joined_at, user:users(id, full_name, email, phone, avatar_url)')
      .eq('organization_id', id)
      .order('joined_at', { ascending: true })

    const { data: agreements } = await admin
      .from('management_agreements')
      .select('id, scope, status, start_date, end_date, listing:listings(id, title, district, region), landlord:users!landlord_id(id, full_name, phone)')
      .eq('managing_org_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ organization: org, members: members ?? [], agreements: agreements ?? [] })
  } catch (err) {
    console.error('[GET /organizations/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/organizations/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: userRow } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(userRow?.role ?? '')

    if (!isAdminStaff) {
      const { data: m } = await admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
      if (!m || !['owner', 'branch_manager'].includes(m.role)) return NextResponse.json({ error: 'Huna ruhusa ya kubadilisha' }, { status: 403 })
    }

    const body = await req.json()
    const allowed = ['name', 'description', 'phone', 'email', 'region', 'district', 'logo_url', 'status']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data, error } = await admin.from('organizations').update(updates).eq('id', id).select().single()
    if (error) throw error

    return NextResponse.json({ organization: data })
  } catch (err) {
    console.error('[PATCH /organizations/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/organizations/[id]  — owner or admin only
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: userRow } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdmin = userRow?.role === 'admin'

    if (!isAdmin) {
      const { data: m } = await admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
      if (m?.role !== 'owner') return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kufuta' }, { status: 403 })
    }

    const { error } = await admin.from('organizations').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /organizations/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
