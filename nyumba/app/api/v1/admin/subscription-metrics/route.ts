import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/subscription-metrics
// Returns MRR, status distribution, plan distribution, revenue trend, upcoming renewals
export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 86_400_000).toISOString()

    // ── Core subscription stats ────────────────────────────────────────────────
    const { data: allSubs } = await admin
      .from('organization_subscriptions')
      .select('status, plan:subscription_plans(price_tzs, billing_cycle, name)')

    const statusCounts: Record<string, number> = {}
    for (const sub of allSubs ?? []) {
      statusCounts[sub.status] = (statusCounts[sub.status] ?? 0) + 1
    }

    // MRR: sum of monthly-equivalent prices for active + trial subs
    const ACTIVE = new Set(['trial', 'active', 'past_due', 'grace_period'])
    let mrr = 0
    const planRevMap: Record<string, { name: string; count: number; mrr: number }> = {}

    for (const sub of allSubs ?? []) {
      const plan = sub.plan as unknown as { price_tzs: number; billing_cycle: string; name: string } | null
      if (!plan || !ACTIVE.has(sub.status)) continue

      const monthlyEquiv =
        plan.billing_cycle === 'annual'    ? plan.price_tzs / 12 :
        plan.billing_cycle === 'quarterly' ? plan.price_tzs / 3  :
        plan.price_tzs

      mrr += monthlyEquiv

      const planName = plan.name
      if (!planRevMap[planName]) planRevMap[planName] = { name: planName, count: 0, mrr: 0 }
      planRevMap[planName].count++
      planRevMap[planName].mrr += monthlyEquiv
    }

    const arr = mrr * 12

    // ── Invoice revenue (confirmed invoices) ───────────────────────────────────
    const { data: confirmedInvoices } = await admin
      .from('subscription_invoices')
      .select('amount_tzs, confirmed_at')
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: true })

    // 6-month revenue trend
    const monthlyRevenue: Array<{ month: string; revenue: number; count: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d      = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mStart = d.toISOString().slice(0, 7)          // "YYYY-MM"
      const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0)

      const monthInvoices = (confirmedInvoices ?? []).filter(inv => {
        if (!inv.confirmed_at) return false
        const dt = new Date(inv.confirmed_at)
        return dt >= d && dt <= mEnd
      })

      monthlyRevenue.push({
        month:   mStart,
        revenue: monthInvoices.reduce((s, inv) => s + (inv.amount_tzs ?? 0), 0),
        count:   monthInvoices.length,
      })
    }

    const totalRevenue = (confirmedInvoices ?? []).reduce((s, inv) => s + (inv.amount_tzs ?? 0), 0)

    // ── Pending invoices ───────────────────────────────────────────────────────
    const { count: pendingInvoices } = await admin
      .from('subscription_invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'proof_uploaded'])

    // ── Upcoming renewals (next 30 days) ───────────────────────────────────────
    const { data: upcomingRenewals } = await admin
      .from('organization_subscriptions')
      .select(`
        org_id, current_period_end, status,
        org:organizations(name),
        plan:subscription_plans(name, price_tzs)
      `)
      .eq('status', 'active')
      .lte('current_period_end', in30Days)
      .gte('current_period_end', now.toISOString())
      .order('current_period_end', { ascending: true })
      .limit(20)

    // ── Churn: orgs that moved to expired/cancelled in last 30 days ───────────
    const last30 = new Date(now.getTime() - 30 * 86_400_000).toISOString()
    const { count: churnedCount } = await admin
      .from('organization_subscriptions')
      .select('org_id', { count: 'exact', head: true })
      .in('status', ['expired', 'cancelled'])
      .gte('updated_at', last30)

    return NextResponse.json({
      mrr:              Math.round(mrr),
      arr:              Math.round(arr),
      total_revenue:    totalRevenue,
      status_counts:    statusCounts,
      plan_distribution: Object.values(planRevMap).sort((a, b) => b.mrr - a.mrr),
      monthly_revenue:  monthlyRevenue,
      pending_invoices: pendingInvoices ?? 0,
      upcoming_renewals: upcomingRenewals ?? [],
      churned_last_30d: churnedCount ?? 0,
    })
  } catch (err) {
    console.error('[GET /admin/subscription-metrics]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
