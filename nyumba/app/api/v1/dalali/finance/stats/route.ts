import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cached, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const id  = user.id
    const now = new Date()
    const month = parseInt(req.nextUrl.searchParams.get('month') ?? String(now.getMonth() + 1))
    const year  = parseInt(req.nextUrl.searchParams.get('year')  ?? String(now.getFullYear()))
    const today   = now.toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]

    const monthStart   = `${year}-${String(month).padStart(2, '0')}-01`
    // First day of next month — used as exclusive upper bound for all monthly queries
    const nextMonth    = month === 12 ? 1 : month + 1
    const nextYear     = month === 12 ? year + 1 : year
    const monthEnd     = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    const yearStart    = `${year}-01-01`
    const nextYearStart = `${year + 1}-01-01`

    const cacheKey = `finance-stats:${id}:${year}-${month}`

    const result = await cached(cacheKey, TTL.FINANCE_STATS, async () => {
      const [
        todayInc, weekInc, monthInc, yearInc,
        monthExp, yearExp,
        commissions, goal,
        allIncome, allExpenses,
      ] = await Promise.all([
        // Today income (no bound needed — exact date match)
        admin.from('dalali_income').select('amount').eq('dalali_id', id).eq('date', today),
        // Week income — only the last 7 days up to today
        admin.from('dalali_income').select('amount').eq('dalali_id', id).gte('date', weekAgo).lte('date', today),
        // Month income — exact month window
        admin.from('dalali_income').select('amount, category').eq('dalali_id', id)
          .gte('date', monthStart).lt('date', monthEnd),
        // Year income
        admin.from('dalali_income').select('amount').eq('dalali_id', id)
          .gte('date', yearStart).lt('date', nextYearStart),
        // Month expenses — exact month window
        admin.from('dalali_expenses').select('amount, category').eq('dalali_id', id)
          .gte('date', monthStart).lt('date', monthEnd),
        // Year expenses
        admin.from('dalali_expenses').select('amount').eq('dalali_id', id)
          .gte('date', yearStart).lt('date', nextYearStart),
        // Commissions (all, not month-scoped — dalali manages these across time)
        admin.from('dalali_commissions')
          .select('id, status, expected_amount, paid_amount, client_name, property_title, due_date, created_at')
          .eq('dalali_id', id).order('created_at', { ascending: false }).limit(50),
        // Monthly goal
        admin.from('dalali_goals').select('*').eq('dalali_id', id).eq('month', month).eq('year', year).maybeSingle(),
        // ALL income records for this month (not just 15) — used in the Mapato tab
        admin.from('dalali_income')
          .select('id, amount, category, date, description, client_name, listing_title, payment_method')
          .eq('dalali_id', id)
          .gte('date', monthStart).lt('date', monthEnd)
          .order('date', { ascending: false })
          .limit(500),
        // ALL expense records for this month — used in the Matumizi tab
        admin.from('dalali_expenses')
          .select('id, amount, category, date, description, vendor, payment_method')
          .eq('dalali_id', id)
          .gte('date', monthStart).lt('date', monthEnd)
          .order('date', { ascending: false })
          .limit(500),
      ])

      const sum = (arr: { amount: number }[] | null) =>
        (arr ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

      const monthIncomeTotal  = sum(monthInc.data)
      const monthExpenseTotal = sum(monthExp.data)
      const yearIncomeTotal   = sum(yearInc.data)
      const yearExpenseTotal  = sum(yearExp.data)

      const comms       = commissions.data ?? []
      const commPending = comms.filter(c => c.status === 'pending').reduce((s, c) => s + (c.expected_amount - c.paid_amount), 0)
      const commPaid    = comms.filter(c => c.status === 'paid').reduce((s, c) => s + c.paid_amount, 0)
      const commOverdue = comms.filter(c => c.status === 'overdue').reduce((s, c) => s + (c.expected_amount - c.paid_amount), 0)

      const incomeByCategory: Record<string, number> = {}
      for (const r of monthInc.data ?? []) {
        incomeByCategory[r.category] = (incomeByCategory[r.category] ?? 0) + r.amount
      }
      const expenseByCategory: Record<string, number> = {}
      for (const r of monthExp.data ?? []) {
        expenseByCategory[r.category] = (expenseByCategory[r.category] ?? 0) + r.amount
      }

      if (goal.data) {
        void admin.from('dalali_goals').update({ current_amount: monthIncomeTotal }).eq('id', goal.data.id)
      }

      return {
        summary: {
          today:         sum(todayInc.data),
          week:          sum(weekInc.data),
          monthIncome:   monthIncomeTotal,
          monthExpenses: monthExpenseTotal,
          monthProfit:   monthIncomeTotal - monthExpenseTotal,
          yearIncome:    yearIncomeTotal,
          yearExpenses:  yearExpenseTotal,
          yearProfit:    yearIncomeTotal - yearExpenseTotal,
        },
        commissions: { pending: commPending, paid: commPaid, overdue: commOverdue, list: comms },
        goal: goal.data ?? null,
        recentIncome:    allIncome.data   ?? [],
        recentExpenses:  allExpenses.data ?? [],
        incomeByCategory,
        expenseByCategory,
        period: { month, year, today },
      }
    })

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[finance/stats]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
