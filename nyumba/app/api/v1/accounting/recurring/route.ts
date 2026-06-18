export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { addRecurringExpense } from '@/lib/accounting/expenseTracker'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/accounting/recurring
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const db = createAdminClient()
    const { data, error } = await db
      .from('recurring_expenses')
      .select('*')
      .order('category')
      .order('created_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ records: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/v1/accounting/recurring — add new recurring expense
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
      paymentMethod?:  string
      recurringPeriod?: string
      nextDueDate:     string
    }

    if (!body.category)    return NextResponse.json({ error: 'category inahitajika' }, { status: 400 })
    if (!body.description) return NextResponse.json({ error: 'description inahitajika' }, { status: 400 })
    if (!body.nextDueDate) return NextResponse.json({ error: 'nextDueDate inahitajika' }, { status: 400 })

    const result = await addRecurringExpense({ ...body, addedBy: admin.id })
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

    return NextResponse.json({ success: true, id: result.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
