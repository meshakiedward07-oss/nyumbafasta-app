import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
    const { data: orgLeases } = await admin
      .from('leases')
      .select('id')
      .eq('org_id', orgId)

    const allLeaseIds    = (orgLeases ?? []).map(l => l.id)

    const { data: activeLeases } = await admin
      .from('leases')
      .select('id, monthly_rent')
      .eq('org_id', orgId)
      .eq('status', 'active')

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
    ] = await Promise.all([
      admin.from('property_units').select('id, status').eq('org_id', orgId),

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

    // ── Monthly income trend (last 6 months) ─────────────────────────────────
    const monthlyIncome: Array<{ month: string; due: number; collected: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(targetYear, targetMonth - i, 1)
      const mS = d.toISOString().split('T')[0]
      const mE = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      let mDue = 0, mCollected = 0
      if (allLeaseIds.length > 0) {
        const { data: mPay } = await admin
          .from('lease_payments')
          .select('amount_due, amount_paid, status')
          .gte('due_date', mS)
          .lte('due_date', mE)
          .in('lease_id', allLeaseIds)

        mDue       = (mPay ?? []).reduce((s, p) => s + (p.amount_due ?? 0), 0)
        mCollected = (mPay ?? []).filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount_paid ?? p.amount_due ?? 0), 0)
      }

      monthlyIncome.push({ month: monthKey, due: mDue, collected: mCollected })
    }

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
      monthly_income:      monthlyIncome,
      leases_ending_soon:  leasesEndingSoonRes.data ?? [],
      overdue_payments:    overduePaymentsRes.data ?? [],
    })
  } catch (err) {
    console.error('[GET /organizations/:id/reports]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
