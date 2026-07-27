import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/fundi/jobs
// Returns maintenance_requests assigned to vendors linked to this fundi account
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'fundi') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data: vendorLinks } = await admin.from('vendors').select('id, org_id, name').eq('fundi_user_id', user.id).eq('is_active', true)
    if (!vendorLinks?.length) return NextResponse.json({ jobs: [] })

    const vendorIds = vendorLinks.map(v => v.id)

    const { data: jobs, error } = await admin
      .from('maintenance_requests')
      .select('id, title, description, category, priority, status, created_at, resolved_at, scheduled_at, notes, vendor_id, unit:property_units(id, unit_number), org:organizations(id, name, phone)')
      .in('vendor_id', vendorIds)
      .order('created_at', { ascending: false })
    if (error) throw error

    return NextResponse.json({ jobs: jobs ?? [] })
  } catch (err) {
    console.error('[GET /fundi/jobs]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
