export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { addExpense } from '@/lib/accounting/expenseTracker'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/accounting/expenses?period=monthly&date=2026-06-01&category=hosting
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const period   = searchParams.get('period') ?? 'monthly'
    const dateStr  = searchParams.get('date')
    const category = searchParams.get('category')
    const page     = parseInt(searchParams.get('page') ?? '1', 10)
    const limit    = parseInt(searchParams.get('limit') ?? '50', 10)

    const date = dateStr ? new Date(dateStr) : new Date()

    let startDate: string
    let endDate:   string
    if (period === 'daily') {
      startDate = endDate = date.toISOString().split('T')[0]
    } else if (period === 'weekly') {
      const ws = new Date(date); ws.setDate(date.getDate() - date.getDay() + 1)
      const we = new Date(ws);   we.setDate(ws.getDate() + 6)
      startDate = ws.toISOString().split('T')[0]
      endDate   = we.toISOString().split('T')[0]
    } else if (period === 'yearly') {
      startDate = `${date.getFullYear()}-01-01`
      endDate   = `${date.getFullYear()}-12-31`
    } else {
      startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
      endDate   = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
    }

    const db  = createAdminClient()
    let query = db
      .from('expense_records')
      .select('*', { count: 'exact' })
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .eq('status', 'paid')
      .order('expense_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (category) query = query.eq('category', category) as typeof query

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ records: data ?? [], total: count ?? 0, page, limit, startDate, endDate })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/v1/accounting/expenses — add new expense
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      category:        string
      subcategory?:    string
      description:     string
      vendor?:         string
      amountTzs:       number
      amountUsd?:      number
      exchangeRate?:   number
      paymentMethod?:  string
      expenseDate:     string
      isRecurring?:    boolean
      recurringPeriod?: string
      receiptUrl?:     string
    }

    if (!body.category)    return NextResponse.json({ error: 'category inahitajika' }, { status: 400 })
    if (!body.description) return NextResponse.json({ error: 'description inahitajika' }, { status: 400 })
    if (!body.amountTzs)   return NextResponse.json({ error: 'amountTzs inahitajika' }, { status: 400 })
    if (!body.expenseDate) return NextResponse.json({ error: 'expenseDate inahitajika' }, { status: 400 })

    const result = await addExpense({ ...body, addedBy: admin.id })
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

    return NextResponse.json({ success: true, id: result.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
