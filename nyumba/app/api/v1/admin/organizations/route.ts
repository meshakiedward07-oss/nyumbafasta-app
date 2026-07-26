import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/organizations — list all organizations (admin/staff)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin  = createAdminClient()
    const search = req.nextUrl.searchParams.get('q') ?? ''
    const type   = req.nextUrl.searchParams.get('type') ?? ''
    const status = req.nextUrl.searchParams.get('status') ?? ''
    const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0')

    let query = admin
      .from('organizations')
      .select(`
        *,
        creator:users!created_by(id, full_name, phone),
        member_count:organization_members(count),
        agreement_count:management_agreements(count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) query = query.ilike('name', `%${search}%`)
    if (type)   query = query.eq('org_type', type)
    if (status) query = query.eq('status', status)

    const { data, count, error } = await query
    if (error) throw error

    // Stats summary
    const { data: stats } = await admin
      .from('organizations')
      .select('org_type, status')

    const summary = {
      total:            count ?? 0,
      landlords:        stats?.filter(o => o.org_type === 'landlord').length ?? 0,
      property_managers: stats?.filter(o => o.org_type === 'property_manager').length ?? 0,
      firms:            stats?.filter(o => o.org_type === 'firm').length ?? 0,
      active:           stats?.filter(o => o.status === 'active').length ?? 0,
      pending:          stats?.filter(o => o.status === 'pending').length ?? 0,
    }

    return NextResponse.json({ organizations: data ?? [], count, summary })
  } catch (err) {
    console.error('[GET /admin/organizations]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/admin/organizations — bulk status update
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { id, status } = await req.json()
    if (!id || !['active', 'suspended', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'id na status zinahitajika' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('organizations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ organization: data })
  } catch (err) {
    console.error('[PATCH /admin/organizations]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
