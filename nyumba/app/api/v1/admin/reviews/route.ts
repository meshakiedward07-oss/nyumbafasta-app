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
  const filter  = searchParams.get('filter') ?? 'all'   // all | flagged | low_rating
  const q       = searchParams.get('q')      ?? ''
  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit   = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
  const offset  = (page - 1) * limit

  const db = createAdminClient()

  let query = db
    .from('reviews')
    .select(`
      id, rating, comment, is_flagged, created_at,
      reviewer:reviewer_id ( id, full_name, phone ),
      dalali:dalali_id     ( id, full_name, username ),
      listing:listing_id   ( id, title, type, district )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filter === 'flagged')    query = query.eq('is_flagged', true)
  if (filter === 'low_rating') query = query.lte('rating', 2)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let reviews = data ?? []
  if (q) {
    const lq = q.toLowerCase()
    reviews = reviews.filter(r => {
      const rev = r.reviewer as { full_name?: string } | null
      const d   = r.dalali   as { full_name?: string; username?: string } | null
      return (
        rev?.full_name?.toLowerCase().includes(lq) ||
        d?.full_name?.toLowerCase().includes(lq)   ||
        r.comment?.toLowerCase().includes(lq)
      )
    })
  }

  const [totalCount, flaggedCount, lowCount] = await Promise.all([
    db.from('reviews').select('*', { count: 'exact', head: true }),
    db.from('reviews').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
    db.from('reviews').select('*', { count: 'exact', head: true }).lte('rating', 2),
  ])

  return Response.json({
    reviews,
    total:  q ? reviews.length : (count ?? 0),
    page,
    limit,
    summary: {
      total:    totalCount.count   ?? 0,
      flagged:  flaggedCount.count ?? 0,
      low_rating: lowCount.count   ?? 0,
    },
  })
}
