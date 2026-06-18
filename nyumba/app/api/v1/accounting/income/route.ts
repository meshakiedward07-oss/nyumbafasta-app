export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { syncAllPaymentsToIncome } from '@/lib/accounting/incomeTracker'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/accounting/income?period=monthly&date=2026-06-01&source=subscription&page=1
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const period  = searchParams.get('period') ?? 'monthly'
    const dateStr = searchParams.get('date')
    const source  = searchParams.get('source')
    const page    = parseInt(searchParams.get('page') ?? '1', 10)
    const limit   = parseInt(searchParams.get('limit') ?? '50', 10)

    const date = dateStr ? new Date(dateStr) : new Date()

    // Compute date range
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
      // monthly
      startDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
      endDate   = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]
    }

    const db    = createAdminClient()
    let query   = db
      .from('income_records')
      .select('*', { count: 'exact' })
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .eq('status', 'confirmed')
      .order('transaction_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (source) query = query.eq('source', source) as typeof query

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ records: data ?? [], total: count ?? 0, page, limit, startDate, endDate })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Accounting/income GET] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/v1/accounting/income/sync — sync all completed payments to income_records
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const url = req.nextUrl.pathname
    if (!url.endsWith('/sync')) {
      return NextResponse.json({ error: 'Use /sync path' }, { status: 400 })
    }

    const result = await syncAllPaymentsToIncome()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Accounting/income sync] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
