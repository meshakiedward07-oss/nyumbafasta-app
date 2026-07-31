import { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function verifyAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? user : null
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q       = searchParams.get('q')         ?? ''
  const from_dt = searchParams.get('from')       ?? ''
  const to_dt   = searchParams.get('to')         ?? ''
  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit   = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
  const offset  = (page - 1) * limit

  const db = createAdminClient()

  let query = db
    .from('contact_unlocks')
    .select(`
      id, amount_paid, payment_method, status, created_at,
      client:client_id  ( id, full_name, phone ),
      dalali:dalali_id  ( id, full_name, phone, username ),
      listing:listing_id( id, title, type, district, region )
    `, { count: 'exact' })
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (from_dt) query = query.gte('created_at', from_dt)
  if (to_dt)   query = query.lte('created_at', to_dt)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let unlocks = data ?? []
  if (q) {
    const lq = q.toLowerCase()
    unlocks = unlocks.filter(u => {
      const c = u.client  as { full_name?: string; phone?: string } | null
      const d = u.dalali  as { full_name?: string; username?: string } | null
      const l = u.listing as { title?: string; district?: string } | null
      return (
        c?.full_name?.toLowerCase().includes(lq) ||
        c?.phone?.includes(lq) ||
        d?.full_name?.toLowerCase().includes(lq) ||
        d?.username?.toLowerCase().includes(lq) ||
        l?.title?.toLowerCase().includes(lq) ||
        l?.district?.toLowerCase().includes(lq)
      )
    })
  }

  // Revenue summary (always full range, no filters)
  const { data: revData } = await db
    .from('contact_unlocks')
    .select('amount_paid')
    .eq('status', 'completed')

  const totalRevenue   = (revData ?? []).reduce((s, r) => s + (r.amount_paid ?? 0), 0)
  const totalCount     = revData?.length ?? 0

  // Today's unlocks
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count: todayCount } = await db
    .from('contact_unlocks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('created_at', today.toISOString())

  return Response.json({
    unlocks,
    total:   q ? unlocks.length : (count ?? 0),
    page,
    limit,
    summary: {
      total_revenue: totalRevenue,
      total_count:   totalCount,
      today_count:   todayCount ?? 0,
    },
  })
}
