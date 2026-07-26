import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/vendors — list vendors across all orgs (admin/staff only)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'staff'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const url    = req.nextUrl
    const status = url.searchParams.get('status') // pending | verified | rejected | (all if omitted)
    const search = url.searchParams.get('search')
    const orgId  = url.searchParams.get('org_id')

    let query = admin
      .from('vendors')
      .select('*, organization:organizations(id, name)')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('verification_status', status)
    if (orgId)  query = query.eq('org_id', orgId)
    if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ vendors: data ?? [] })
  } catch (err) {
    console.error('[GET /admin/vendors]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
