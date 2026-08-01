export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/accounting/source-summary
// Returns per-source totals: all-time + this month
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const db = createAdminClient()

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const SOURCES = [
      'subscription', 'contact_unlock', 'boost_listing',
      'org_subscription', 'fundi_subscription', 'ad_campaign', 'extra_listing',
      'brokerage_commission',
    ]

    // All-time totals per source
    const { data: allTime } = await db
      .from('income_records')
      .select('source, amount_tzs, net_amount_tzs')
      .eq('status', 'confirmed')
      .in('source', SOURCES)

    // This month totals per source
    const { data: thisMonth } = await db
      .from('income_records')
      .select('source, amount_tzs')
      .eq('status', 'confirmed')
      .in('source', SOURCES)
      .gte('transaction_date', monthStart)
      .lte('transaction_date', monthEnd)

    const summary: Record<string, { total: number; net: number; count: number; this_month: number }> = {}

    for (const src of SOURCES) {
      summary[src] = { total: 0, net: 0, count: 0, this_month: 0 }
    }

    for (const r of allTime ?? []) {
      const s = summary[r.source]
      if (!s) continue
      s.total += Number(r.amount_tzs)
      s.net   += Number(r.net_amount_tzs)
      s.count += 1
    }

    for (const r of thisMonth ?? []) {
      const s = summary[r.source]
      if (!s) continue
      s.this_month += Number(r.amount_tzs)
    }

    return NextResponse.json({ summary, month: monthStart.slice(0, 7) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /accounting/source-summary]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
