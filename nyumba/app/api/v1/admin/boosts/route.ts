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
  const status = searchParams.get('status') ?? 'all'
  const q      = searchParams.get('q')      ?? ''
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
  const offset = (page - 1) * limit

  const db = createAdminClient()

  let query = db
    .from('boost_payments')
    .select(`
      id, amount_paid, status, boost_days, created_at, expires_at,
      dalali:dalali_id  ( id, full_name, phone, username ),
      listing:listing_id( id, title, type, district, region, is_boosted )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') query = query.eq('status', status)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let boosts = data ?? []
  if (q) {
    const lq = q.toLowerCase()
    boosts = boosts.filter(b => {
      const d = b.dalali  as { full_name?: string; username?: string } | null
      const l = b.listing as { title?: string; district?: string } | null
      return (
        d?.full_name?.toLowerCase().includes(lq) ||
        d?.username?.toLowerCase().includes(lq)  ||
        l?.title?.toLowerCase().includes(lq)     ||
        l?.district?.toLowerCase().includes(lq)
      )
    })
  }

  const [activeBoosts, totalRevData] = await Promise.all([
    db.from('boost_payments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('boost_payments').select('amount_paid').eq('status', 'completed'),
  ])

  // Also count from listings directly
  const { count: boostedListings } = await db
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('is_boosted', true)

  const totalRevenue = ((totalRevData as unknown as Array<{ amount_paid: number }>) ?? [])
    .reduce((s, r) => s + (r.amount_paid ?? 0), 0)

  return Response.json({
    boosts,
    total:  q ? boosts.length : (count ?? 0),
    page,
    limit,
    summary: {
      active_boosts:    activeBoosts.count  ?? 0,
      boosted_listings: boostedListings      ?? 0,
      total_revenue:    totalRevenue,
    },
  })
}
