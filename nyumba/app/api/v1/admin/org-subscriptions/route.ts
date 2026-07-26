import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/org-subscriptions
// Query params: q (org name search), status, plan_id, limit, offset
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const sp     = req.nextUrl.searchParams
    const search = sp.get('q')     ?? ''
    const status = sp.get('status') ?? ''
    const planId = sp.get('plan_id') ?? ''
    const limit  = Math.min(parseInt(sp.get('limit')  ?? '50'), 100)
    const offset = parseInt(sp.get('offset') ?? '0')

    const admin = createAdminClient()

    let query = admin
      .from('organization_subscriptions')
      .select(`
        *,
        org:organizations(id, name, org_type, status),
        plan:subscription_plans(id, name, price_tzs, billing_cycle)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status)  query = query.eq('status', status)
    if (planId)  query = query.eq('plan_id', planId)

    const { data, count, error } = await query
    if (error) throw error

    // Filter by org name if search present (PostgREST can't filter joined table columns directly)
    let results = data ?? []
    if (search) {
      const lower = search.toLowerCase()
      results = results.filter((r) => {
        const org = r.org as { name: string } | null
        return org?.name?.toLowerCase().includes(lower)
      })
    }

    // Summary stats
    const { data: allStatuses } = await admin
      .from('organization_subscriptions')
      .select('status')

    const summary = {
      total:        count ?? 0,
      trial:        allStatuses?.filter(s => s.status === 'trial').length        ?? 0,
      active:       allStatuses?.filter(s => s.status === 'active').length       ?? 0,
      past_due:     allStatuses?.filter(s => s.status === 'past_due').length     ?? 0,
      grace_period: allStatuses?.filter(s => s.status === 'grace_period').length ?? 0,
      cancelled:    allStatuses?.filter(s => s.status === 'cancelled').length    ?? 0,
      expired:      allStatuses?.filter(s => s.status === 'expired').length      ?? 0,
    }

    return NextResponse.json({ subscriptions: results, count, summary })
  } catch (err) {
    console.error('[GET /admin/org-subscriptions]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
