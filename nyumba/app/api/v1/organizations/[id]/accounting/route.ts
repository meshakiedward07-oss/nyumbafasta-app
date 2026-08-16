import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/:id/accounting
// Returns YTD financials, 12-month trend, growth metrics, and recent transaction ledger.
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

    const now = new Date()
    const year = now.getFullYear()

    // YTD range: Jan 1 → today
    const ytdStart = `${year}-01-01`
    const today    = now.toISOString().split('T')[0]

    // Current month range
    const curMonthStart = new Date(year, now.getMonth(), 1).toISOString().split('T')[0]
    const curMonthEnd   = new Date(year, now.getMonth() + 1, 0).toISOString().split('T')[0]

    // Prior month range
    const prevYear  = now.getMonth() === 0 ? year - 1 : year
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const prevStart = new Date(prevYear, prevMonth, 1).toISOString().split('T')[0]
    const prevEnd   = new Date(prevYear, prevMonth + 1, 0).toISOString().split('T')[0]

    // Build 12-month windows (oldest first)
    const months12 = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, now.getMonth() - (11 - i), 1)
      return {
        key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        start: d.toISOString().split('T')[0],
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0],
      }
    })

    // Get all org lease IDs once
    const { data: orgLeases } = await admin
      .from('leases')
      .select('id')
      .eq('org_id', orgId)

    const allLeaseIds = (orgLeases ?? []).map(l => l.id)

    // ── Parallel fetches ─────────────────────────────────────────────────────

    const [
      ytdPaymentsRes,
      ytdExpensesRes,
      curPaymentsRes,
      curExpensesRes,
      prevPaymentsRes,
      prevExpensesRes,
      recentPaymentsRes,
      recentExpensesRes,
    ] = await Promise.all([
      // YTD income (paid lease_payments)
      allLeaseIds.length > 0
        ? admin.from('lease_payments')
            .select('amount_due, amount_paid, status, due_date')
            .in('lease_id', allLeaseIds)
            .gte('due_date', ytdStart)
            .lte('due_date', today)
        : Promise.resolve({ data: [] as { amount_due: number; amount_paid: number; status: string; due_date: string }[] }),

      // YTD expenses
      admin.from('org_expenses')
        .select('amount_tzs, expense_date, category')
        .eq('organization_id', orgId)
        .gte('expense_date', ytdStart)
        .lte('expense_date', today),

      // Current month income
      allLeaseIds.length > 0
        ? admin.from('lease_payments')
            .select('amount_due, amount_paid, status')
            .in('lease_id', allLeaseIds)
            .gte('due_date', curMonthStart)
            .lte('due_date', curMonthEnd)
        : Promise.resolve({ data: [] as { amount_due: number; amount_paid: number; status: string }[] }),

      // Current month expenses
      admin.from('org_expenses')
        .select('amount_tzs')
        .eq('organization_id', orgId)
        .gte('expense_date', curMonthStart)
        .lte('expense_date', curMonthEnd),

      // Prior month income
      allLeaseIds.length > 0
        ? admin.from('lease_payments')
            .select('amount_due, amount_paid, status')
            .in('lease_id', allLeaseIds)
            .gte('due_date', prevStart)
            .lte('due_date', prevEnd)
        : Promise.resolve({ data: [] as { amount_due: number; amount_paid: number; status: string }[] }),

      // Prior month expenses
      admin.from('org_expenses')
        .select('amount_tzs')
        .eq('organization_id', orgId)
        .gte('expense_date', prevStart)
        .lte('expense_date', prevEnd),

      // Recent paid payments for ledger (last 30)
      allLeaseIds.length > 0
        ? admin.from('lease_payments')
            .select(`
              id, amount_paid, amount_due, due_date, paid_at, status,
              lease:leases!lease_id(
                monthly_rent,
                tenant:users!tenant_id(full_name),
                unit:property_units(unit_number)
              )
            `)
            .in('lease_id', allLeaseIds)
            .eq('status', 'paid')
            .order('paid_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] as unknown[] }),

      // Recent expenses for ledger (last 30)
      admin.from('org_expenses')
        .select('id, amount_tzs, description, category, expense_date, vendor, payment_method')
        .eq('organization_id', orgId)
        .order('expense_date', { ascending: false })
        .limit(30),
    ])

    // ── Aggregations ─────────────────────────────────────────────────────────

    function sumPaid(rows: { amount_due: number; amount_paid: number; status: string }[]) {
      return rows
        .filter(p => p.status === 'paid')
        .reduce((s, p) => s + (p.amount_paid ?? p.amount_due ?? 0), 0)
    }
    function sumExp(rows: { amount_tzs: number }[]) {
      return rows.reduce((s, e) => s + Number(e.amount_tzs ?? 0), 0)
    }

    const ytdRevenue  = sumPaid((ytdPaymentsRes.data ?? []) as { amount_due: number; amount_paid: number; status: string }[])
    const ytdExpenses = sumExp((ytdExpensesRes.data ?? []) as { amount_tzs: number }[])
    const ytdNet      = ytdRevenue - ytdExpenses

    const curRevenue  = sumPaid((curPaymentsRes.data ?? []) as { amount_due: number; amount_paid: number; status: string }[])
    const curExpenses = sumExp((curExpensesRes.data ?? []) as { amount_tzs: number }[])
    const curNet      = curRevenue - curExpenses

    const prevRevenue  = sumPaid((prevPaymentsRes.data ?? []) as { amount_due: number; amount_paid: number; status: string }[])
    const prevExpenses = sumExp((prevExpensesRes.data ?? []) as { amount_tzs: number }[])
    const prevNet      = prevRevenue - prevExpenses

    function growthPct(curr: number, prev: number): number | null {
      if (prev === 0) return curr > 0 ? 100 : null
      return Math.round(((curr - prev) / prev) * 100)
    }

    // ── 12-month trend ───────────────────────────────────────────────────────
    const trendResults = await Promise.all(
      months12.map(async ({ key, start, end }) => {
        const [payRes, expRes] = await Promise.all([
          allLeaseIds.length > 0
            ? admin.from('lease_payments')
                .select('amount_due, amount_paid, status')
                .in('lease_id', allLeaseIds)
                .gte('due_date', start)
                .lte('due_date', end)
            : Promise.resolve({ data: [] as { amount_due: number; amount_paid: number; status: string }[] }),
          admin.from('org_expenses')
            .select('amount_tzs')
            .eq('organization_id', orgId)
            .gte('expense_date', start)
            .lte('expense_date', end),
        ])
        const revenue  = sumPaid((payRes.data ?? []) as { amount_due: number; amount_paid: number; status: string }[])
        const expenses = sumExp((expRes.data ?? []) as { amount_tzs: number }[])
        return { month: key, revenue, expenses, net: revenue - expenses }
      })
    )

    // ── Transaction ledger (merge + sort) ────────────────────────────────────
    type TxRow = {
      id: string
      date: string
      description: string
      amount: number
      type: 'income' | 'expense'
      category: string
    }

    const CATS: Record<string, string> = {
      maintenance: 'Matengenezo', utilities: 'Huduma', salaries: 'Mishahara',
      marketing: 'Masoko', legal: 'Kisheria', insurance: 'Bima',
      taxes: 'Kodi', office: 'Ofisi', other: 'Mengine',
    }

    const incomeTxs: TxRow[] = ((recentPaymentsRes.data ?? []) as Array<{
      id: string; amount_paid: number; amount_due: number; paid_at: string | null; due_date: string
      lease: {
        monthly_rent: number
        tenant: { full_name: string | null } | null
        unit: { unit_number: string } | null
      } | null
    }>).map(p => ({
      id:          p.id,
      date:        p.paid_at ?? p.due_date,
      description: [p.lease?.tenant?.full_name, p.lease?.unit?.unit_number].filter(Boolean).join(' · ') || 'Kodi',
      amount:      p.amount_paid ?? p.amount_due ?? 0,
      type:        'income' as const,
      category:    'Kodi ya Pango',
    }))

    const expenseTxs: TxRow[] = ((recentExpensesRes.data ?? []) as Array<{
      id: string; amount_tzs: number; description: string; category: string; expense_date: string; vendor: string | null
    }>).map(e => ({
      id:          e.id,
      date:        e.expense_date,
      description: e.description || (CATS[e.category] ?? e.category),
      amount:      Number(e.amount_tzs ?? 0),
      type:        'expense' as const,
      category:    CATS[e.category] ?? e.category,
    }))

    const transactions = [...incomeTxs, ...expenseTxs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40)

    return NextResponse.json({
      year,
      ytd: {
        revenue:  ytdRevenue,
        expenses: ytdExpenses,
        net:      ytdNet,
      },
      current_month: {
        revenue:  curRevenue,
        expenses: curExpenses,
        net:      curNet,
      },
      prior_month: {
        revenue:  prevRevenue,
        expenses: prevExpenses,
        net:      prevNet,
      },
      growth: {
        revenue_pct:  growthPct(curRevenue,  prevRevenue),
        expenses_pct: growthPct(curExpenses, prevExpenses),
        net_pct:      growthPct(curNet,      prevNet),
      },
      trend:        trendResults,
      transactions,
    })
  } catch (err) {
    console.error('[GET /organizations/:id/accounting]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
