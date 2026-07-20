import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { cache, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const region   = searchParams.get('region')
  const type     = searchParams.get('type')
  const search   = searchParams.get('search')
  const page     = parseInt(searchParams.get('page') ?? '0')
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const from     = page * limit
  const to       = from + limit - 1

  // Cache filter-based queries (skip search — too many unique combinations)
  const cacheKey = !search
    ? `admin:listings:${status ?? 'all'}:${region ?? ''}:${type ?? ''}:${page}:${limit}`
    : null

  if (cacheKey) {
    const hit = cache.get(cacheKey)
    if (hit) return NextResponse.json(hit, { headers: { 'Cache-Control': 'no-store' } })
  }

  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = createAdminClient()

  let query = admin
    .from('listings')
    .select(`
      id, title, type, status, price_monthly, furnished,
      region, district, ward, mtaa, images, video_url,
      amenities, description, bedrooms, is_boosted,
      view_count, lead_count, share_count,
      created_at, expires_at,
      dalali:dalali_id (
        id, full_name, phone,
        dalali_profiles ( whatsapp_number, is_premium_verified )
      )
    `, { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false })

  if (status)  query = query.eq('status', status)
  else         query = query.neq('status', 'deleted')
  if (region)  query = query.eq('region', region)
  if (type)    query = query.eq('type', type)
  if (search) {
    query = query.or(`title.ilike.%${search}%,district.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const payload = {
    listings: data ?? [],
    total: count ?? 0,
    page,
    limit,
  }

  if (cacheKey) cache.set(cacheKey, payload, TTL.LISTINGS_PAGE)

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}
