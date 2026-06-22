import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET — orodha ya watumiaji yote kwa admin
// Query params: ?role=all|client|dalali|staff  &q=search  &page=1  &per_page=50
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const role    = searchParams.get('role') ?? 'all'
    const q       = searchParams.get('q') ?? ''
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(100, Math.max(10, parseInt(searchParams.get('per_page') ?? '50', 10)))
    const from    = (page - 1) * perPage
    const to      = from + perPage - 1

    const db = createAdminClient()

    // Base query — select with related data
    let query = db
      .from('users')
      .select(`
        id, full_name, email, phone, role, avatar_url, is_active, created_at,
        dalali_profiles ( whatsapp_number, verification_status, is_premium_verified, rating_avg ),
        subscriptions ( plan, status, expires_at )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    // Role filter
    if (role !== 'all') {
      query = query.eq('role', role)
    }

    // Search (name, email, phone)
    if (q) {
      query = query.or(
        `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
      )
    }

    const { data, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Counts per role (for tab badges) — always full counts, no search filter
    const [clientCount, dalaliCount, staffCount] = await Promise.all([
      db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'dalali'),
      db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'staff'),
    ])

    return NextResponse.json({
      users:       data ?? [],
      total:       count ?? 0,
      page,
      per_page:    perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
      counts: {
        all:    (clientCount.count ?? 0) + (dalaliCount.count ?? 0) + (staffCount.count ?? 0),
        client: clientCount.count ?? 0,
        dalali: dalaliCount.count ?? 0,
        staff:  staffCount.count ?? 0,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
