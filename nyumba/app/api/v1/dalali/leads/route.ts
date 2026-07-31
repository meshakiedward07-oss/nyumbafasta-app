import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit      = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const q          = searchParams.get('q')?.trim() ?? ''
  const listingId  = searchParams.get('listing_id') ?? ''
  const offset     = (page - 1) * limit

  const admin = getAdmin()

  let query = admin
    .from('contact_unlocks')
    .select(`
      id, created_at, amount_paid, payment_method,
      listing:listing_id ( id, title, type, district, region, price_monthly ),
      client:client_id  ( id, full_name, phone )
    `, { count: 'exact' })
    .eq('dalali_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (listingId) query = query.eq('listing_id', listingId)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Apply client name search filter client-side (Supabase doesn't support
  // filtering on joined table columns directly without full-text indexes)
  let leads = data ?? []
  if (q) {
    const lq = q.toLowerCase()
    leads = leads.filter(l => {
      const client = l.client as { full_name?: string; phone?: string } | null
      return (
        client?.full_name?.toLowerCase().includes(lq) ||
        client?.phone?.includes(lq)
      )
    })
  }

  // Fetch my listings for the filter dropdown (active + taken)
  const { data: myListings } = await admin
    .from('listings')
    .select('id, title, type, district')
    .eq('dalali_id', user.id)
    .in('status', ['active', 'taken', 'expired'])
    .order('created_at', { ascending: false })
    .limit(100)

  return Response.json({
    leads,
    total:    q ? leads.length : (count ?? 0),
    page,
    limit,
    listings: myListings ?? [],
  })
}
