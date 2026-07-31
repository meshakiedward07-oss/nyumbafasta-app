import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgFeatures, checkFeature } from '@/lib/subscription/featureGate'

type Params = { params: { id: string } }

// GET /api/v1/organizations/:id/reports?month=YYYY-MM
export async function GET(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { count: membership } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', user.id)

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!membership && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    // Feature gate: has_reports
    if (!isAdminStaff) {
      const features = await getOrgFeatures(orgId)
      const gate = checkFeature(features, 'has_reports', 'Ripoti na Takwimu')
      if (!gate.ok) return NextResponse.json({ error: gate.error, upgrade_required: true }, { status: gate.status })
    }

    // Optional listing filter
    const listingId = req.nextUrl.searchParams.get('listing_id') || null
    let listingUnitIds: string[] | null = null
    if (listingId) {
      const { data: lu } = await admin.from('property_units').select('id').eq('listing_id', listingId).eq('org_id', orgId)
      listingUnitIds = (lu ?? []).map(u => u.id)
    }

    // Determine month range
    const monthParam  = req.nextUrl.searchParams.get('month') // e.g. "2026-07"
    const now         = new Date()
    const targetYear  = monthParam ? parseInt(monthParam.split('-')[0]) : now.getFullYear()
    const targetMonth = monthParam ? parseInt(monthParam.split('-')[1]) - 1 : now.getMonth()
    const monthStart  = new Date(targetYear, targetMonth, 1).toISOString().split('T')[0]
    const monthEnd    = new Date(targetYear, targetMonth + 1, 0).toISOString().split('T')[0]
    const today       = now.toISOString().split('T')[0]
    const in60Days    = new Date(now.getTime() + 60 * 86400000).toISOString().split('T')[0]

    // Fetch all org lease IDs first (needed to filter payments)
    let orgLeasesQuery = admin.from('leases').select('id').eq('org_id', orgId)
    if (listingUnitIds) orgLeasesQuery = orgLeasesQuery.in('unit_id', listingUnitIds.length > 0 ? listingUnitIds : ['__none__'])
    const { data: orgLeases } = await orgLeasesQuery

    const allLeaseIds    = (orgLeases ?? []).map(l => l.id)

    let activeLeasesQuery = admin.from('leases').select('id, monthly_rent').eq('org_id', orgId).eq('status', 'active')
    if (listingUnitIds) activeLeasesQuery = activeLeasesQuery.in('unit_id', listingUnitIds.length > 0 ? listingUnitIds : ['__none__'])
    const { data: activeLeases } = await activeLeasesQuery

    const activeLeaseIds = (activeLeases ?? []).map(l => l.id)

    // Run remaining queries in parallel
    const [
      unitsRes,
      activeLeaseDetailRes,
      monthPaymentsRes,
      overduePaymentsRes,
      leasesEndingSoonRes,
      maintRes,
      maintCostRes,
      orgExpensesRes,
    ] = await Promise.all([
      listingUnitIds
        ? admin.from('property_units').select('id, status').in('id', listingUnitIds.length > 0 ? listingUnitIds : ['__none__'])
        : admin.from('property_units').select('id, status').eq('org_id', orgId),

      admin
        .from('leases')
        .select('id, monthly_rent, end_date, tenant:users!tenant_id(full_name, phone), unit:property_units(unit_number)')
        .eq('org_id', orgId)
        .eq('status', 'active'),

      allLeaseIds.length > 0
        ? admin
            .from('lease_payments')
            .select('amount_due, amount_paid, status')
            .gte('due_date', monthStart)
            .lte('due_date', monthEnd)
            .in('lease_id', allLeaseIds)
        : Promise.resolve({ data: [] }),

      activeLeaseIds.length > 0
        ? admin
            .from('lease_payments')
            .select(`
              id, amount_due, due_date,
              lease:leases!lease_id(
                id, monthly_rent,
                tenant:users!tenant_id(full_name, phone),
                unit:property_units(unit_number)
              )
            `)
            .lt('due_date', today)
            .in('status', ['pending', 'late'])
            .in('lease_id', activeLeaseIds)
            .order('due_date', { ascending: true })
            .limit(10)
        : Promise.resolve({ data: [] }),

      admin
        .from('leases')
        .select('id, end_date, monthly_rent, tenant:users!tenant_id(full_name, phone), unit:property_units(unit_number)')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .not('end_date', 'is', null)
        .lte('end_date', in60Days)
        .gte('end_date', today)
        .order('end_date', { ascending: true }),

      admin.from('maintenance_requests').select('status').eq('org_id', orgId),

      admin
        .from('maintenance_requests')
        .select('actual_cost')
        .eq('org_id', orgId)
        .not('actual_cost', 'is', null)
        .gte('updated_at', monthStart)
        .lte('updated_at', monthEnd + 'T23:59:59'),

      // org_expenses for this month
      admin
        .from('org_expenses')
        .select('amount_tzs, category')
        .eq('organization_id', orgId)
        .gte('expense_date', monthStart)
        .lte('expense_date', monthEnd),
    ])

    // ── Income summary ───────────────────────────────────────────────────────
    const payments       = monthPaymentsRes.data ?? []
    const totalDue       = payments.reduce((s, p) => s + (p.amount_due ?? 0), 0)
    const totalCollected = payments
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + (p.amount_paid ?? p.amount_due ?? 0), 0)
    const totalPending   = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount_due ?? 0), 0)
    const totalOverdue   = payments.filter(p => p.status === 'late').reduce((s, p) => s + (p.amount_due ?? 0), 0)
    const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0

    // ── Occupancy ────────────────────────────────────────────────────────────
    const units         = unitsRes.data ?? []
    const occupied      = units.filter(u => u.status === 'occupied').length
    const vacant        = units.filter(u => u.status === 'vacant').length
    const maintenance   = units.filter(u => u.status === 'maintenance').length
    const occupancyRate = units.length > 0 ? Math.round((occupied / units.length) * 100) : 0
    const monthlyIncomeLive = (activeLeases ?? []).reduce((s, l) => s + (l.monthly_rent ?? 0), 0)

    // ── Maintenance summary ──────────────────────────────────────────────────
    const maintItems     = maintRes.data ?? []
    const maintCostItems = maintCostRes.data ?? []
    const totalMaintCost = maintCostItems.reduce((s, m) => s + (m.actual_cost ?? 0), 0)

    // ── Expenses summary ─────────────────────────────────────────────────────
    const expenseRows      = orgExpensesRes.data ?? []
    const totalExpenses    = expenseRows.reduce((s, e) => s + Number(e.amount_tzs ?? 0), 0)
    const expenseByCategory: Record<string, number> = {}
    for (const e of expenseRows) {
      expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + Number(e.amount_tzs)
    }

    // ── Monthly income + expense trend (last 6 months) — run in parallel ──────
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d  = new Date(targetYear, targetMonth - (5 - i), 1)
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        start: d.toISOString().split('T')[0],
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0],
      }
    })

    const trendResults = await Promise.all(
      last6.map(async ({ key, start, end }) => {
        const [payRes, expRes] = await Promise.all([
          allLeaseIds.length > 0
            ? admin.from('lease_payments').select('amount_due, amount_paid, status')
                .gte('due_date', start).lte('due_date', end).in('lease_id', allLeaseIds)
            : Promise.resolve({ data: [] as { amount_due: number; amount_paid: number; status: string }[] }),
          admin.from('org_expenses').select('amount_tzs')
            .eq('organization_id', orgId).gte('expense_date', start).lte('expense_date', end),
        ])
        const pays      = payRes.data ?? []
        const due       = pays.reduce((s, p) => s + (p.amount_due ?? 0), 0)
        const collected = pays.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount_paid ?? p.amount_due ?? 0), 0)
        const expenses  = (expRes.data ?? []).reduce((s, e) => s + Number(e.amount_tzs ?? 0), 0)
        return { month: key, due, collected, expenses }
      })
    )

    return NextResponse.json({
      month:  `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
      income: {
        total_due:       totalDue,
        total_collected: totalCollected,
        total_pending:   totalPending,
        total_overdue:   totalOverdue,
        collection_rate: collectionRate,
      },
      occupancy: {
        total_units:    units.length,
        occupied,
        vacant,
        maintenance,
        rate:           occupancyRate,
        active_leases:  activeLeaseDetailRes.data?.length ?? 0,
        monthly_income: monthlyIncomeLive,
      },
      maintenance_summary: {
        open:                maintItems.filter(m => m.status === 'open').length,
        in_progress:         maintItems.filter(m => ['assigned','in_progress','awaiting_parts'].includes(m.status)).length,
        resolved_this_month: maintItems.filter(m => ['resolved','closed'].includes(m.status)).length,
        total_actual_cost:   totalMaintCost,
      },
      expenses: {
        total:       totalExpenses,
        by_category: expenseByCategory,
      },
      profit_loss: {
        income:   totalCollected,
        expenses: totalExpenses,
        net:      totalCollected - totalExpenses,
      },
      monthly_income:     trendResults,
      leases_ending_soon: leasesEndingSoonRes.data ?? [],
      overdue_payments:   overduePaymentsRes.data ?? [],
    })
  } catch (err) {
    console.error('[GET /organizations/:id/reports]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
