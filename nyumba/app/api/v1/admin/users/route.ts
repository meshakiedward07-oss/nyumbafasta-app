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
    const status  = searchParams.get('status') ?? 'all'
    const sort    = searchParams.get('sort') ?? 'newest'
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const perPage = Math.min(100, Math.max(10, parseInt(searchParams.get('per_page') ?? '50', 10)))
    const from    = (page - 1) * perPage
    const to      = from + perPage - 1

    const db = createAdminClient()

    // Base query — select with related data
    // NOTE: email is in auth.users (Supabase Auth), NOT in public.users — fetched separately below
    let query = db
      .from('users')
      .select(`
        id, full_name, phone, role, avatar_url, is_active, created_at,
        username, profile_views_total, profile_views_today, profile_views_month,
        dalali_profiles ( whatsapp_number, verification_status, is_premium_verified, rating_avg ),
        subscriptions ( plan, status, expires_at )
      `, { count: 'exact' })
      .range(from, to)

    // Sort
    if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true })
    } else if (sort === 'name') {
      query = query.order('full_name', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Role filter (exclude admin, dalali_activity is handled by separate endpoint)
    if (role !== 'all' && role !== 'dalali_activity') {
      query = query.eq('role', role)
    }

    // Status filter
    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'suspended') {
      query = query.eq('is_active', false)
    }

    // Fetch auth users early so we can search by email and also merge emails in display
    let emailMap: Map<string, string | null> = new Map()
    let emailMatchIds: string[] = []
    try {
      const allAuthUsers: Array<{ id: string; email?: string | null }> = []
      let authPage = 1
      while (allAuthUsers.length < 10000) {
        const { data: pageData } = await db.auth.admin.listUsers({ page: authPage, perPage: 1000 })
        const batch = pageData?.users ?? []
        allAuthUsers.push(...batch)
        if (batch.length < 1000) break
        authPage++
      }
      emailMap = new Map(allAuthUsers.map(u => [u.id, u.email ?? null]))
      if (q) {
        emailMatchIds = allAuthUsers
          .filter(u => u.email?.toLowerCase().includes(q.toLowerCase()))
          .map(u => u.id)
      }
    } catch { /* non-fatal */ }

    // Search: name, phone, username (all in public.users) + email IDs from auth
    // q is sanitized before interpolation to prevent PostgREST filter injection via comma-separated branches
    if (q) {
      const safeQ = q.replace(/[,()]/g, '').slice(0, 200)
      const orParts = [
        `full_name.ilike.%${safeQ}%`,
        `phone.ilike.%${safeQ}%`,
        `username.ilike.%${safeQ}%`,
      ]
      if (emailMatchIds.length > 0) {
        orParts.push(`id.in.(${emailMatchIds.join(',')})`)
      }
      query = query.or(orParts.join(','))
    }

    const { data, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const enriched = (data ?? []).map(u => ({ ...u, email: emailMap.get(u.id) ?? null }))

    // Counts per role (for tab badges) — always full counts, no search filter
    const [clientCount, dalaliCount, staffCount] = await Promise.all([
      db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'dalali'),
      db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'staff'),
    ])

    return NextResponse.json({
      users:       enriched,
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
