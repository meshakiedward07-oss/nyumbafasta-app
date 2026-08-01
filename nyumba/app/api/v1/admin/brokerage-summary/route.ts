import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { cache, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const CACHE_KEY = 'admin:brokerage-summary'
    const hit = cache.get(CACHE_KEY)
    if (hit) return NextResponse.json(hit)

    const admin = createAdminClient()
    const now   = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [allRes, closedThisMonthRes, pendingCommRes] = await Promise.all([
      admin.from('brokerage_requests')
        .select('status, commission_status, commission_amount')
        .neq('status', 'cancelled'),
      admin.from('brokerage_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'deal_closed')
        .gte('deal_closed_at', monthStart),
      admin.from('brokerage_requests')
        .select('commission_amount')
        .eq('commission_status', 'pending')
        .neq('status', 'cancelled'),
    ])

    const rows = allRes.data ?? []
    const pipeline_by_status = {
      pending:    rows.filter(r => r.status === 'pending').length,
      approved:   rows.filter(r => r.status === 'approved').length,
      listed:     rows.filter(r => r.status === 'listed').length,
      deal_closed:rows.filter(r => r.status === 'deal_closed').length,
      rejected:   rows.filter(r => r.status === 'rejected').length,
    }

    const pending_commissions = (pendingCommRes.data ?? [])
      .reduce((s, r) => s + Number(r.commission_amount ?? 0), 0)

    const commission_by_status = {
      pending:  rows.filter(r => r.commission_status === 'pending').length,
      invoiced: rows.filter(r => r.commission_status === 'invoiced').length,
      received: rows.filter(r => r.commission_status === 'received').length,
      waived:   rows.filter(r => r.commission_status === 'waived').length,
    }

    const result = {
      total_pipeline:         rows.length,
      deals_closed_this_month: closedThisMonthRes.count ?? 0,
      pending_commissions,
      pipeline_by_status,
      commission_by_status,
    }

    cache.set(CACHE_KEY, result, TTL.STATS)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /admin/brokerage-summary]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
