import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { cache, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

const OPEN_STATUSES = ['open', 'assigned', 'in_progress', 'awaiting_parts'] as const

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const CACHE_KEY = 'admin:maintenance-summary'
    const hit = cache.get(CACHE_KEY)
    if (hit) return NextResponse.json(hit)

    const admin = createAdminClient()
    const now   = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [allOpenRes, urgentRes, highRes, costRes] = await Promise.all([
      admin.from('maintenance_requests')
        .select('status, priority', { count: 'exact' })
        .in('status', OPEN_STATUSES),
      admin.from('maintenance_requests')
        .select('*', { count: 'exact', head: true })
        .eq('priority', 'urgent')
        .in('status', OPEN_STATUSES),
      admin.from('maintenance_requests')
        .select('*', { count: 'exact', head: true })
        .eq('priority', 'high')
        .in('status', OPEN_STATUSES),
      admin.from('maintenance_requests')
        .select('actual_cost')
        .gte('updated_at', monthStart)
        .not('actual_cost', 'is', null),
    ])

    const openRows = allOpenRes.data ?? []
    const by_status = OPEN_STATUSES.reduce((acc, s) => {
      acc[s] = openRows.filter(r => r.status === s).length
      return acc
    }, {} as Record<string, number>)

    const total_actual_cost_this_month = (costRes.data ?? [])
      .reduce((s, r) => s + Number(r.actual_cost ?? 0), 0)

    const result = {
      open_count:   allOpenRes.count  ?? 0,
      urgent_count: urgentRes.count   ?? 0,
      high_count:   highRes.count     ?? 0,
      by_status,
      total_actual_cost_this_month,
    }

    cache.set(CACHE_KEY, result, TTL.STATS)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /admin/maintenance-summary]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
