import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cache } from '@/lib/cache/memoryCache'

async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const month = searchParams.get('month')
    const year  = searchParams.get('year') ?? String(new Date().getFullYear())

    const admin = createAdminClient()
    let query = admin
      .from('dalali_expenses')
      .select('*')
      .eq('dalali_id', user.id)
      .order('date', { ascending: false })
      .limit(200)

    if (month) {
      const y = parseInt(year), m = parseInt(month)
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
      const monthEnd   = new Date(y, m, 1).toISOString().split('T')[0]
      query = query.gte('date', monthStart).lt('date', monthEnd)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ expenses: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/dalali/finance/expenses]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const { amount, category, date, description, vendor, payment_method, receipt_url } = body
    if (!amount || !category || !date)
      return NextResponse.json({ error: 'amount, category, date zinahitajika' }, { status: 400 })

    const VALID_EXPENSE_CATEGORIES = [
      'usafiri', 'masoko', 'simu', 'intaneti', 'ofisi', 'nyingine',
      'transport', 'marketing', 'phone', 'internet', 'office', 'printing',
      'fuel', 'utilities', 'software', 'commission', 'other',
    ]
    const VALID_PAYMENT_METHODS = ['cash', 'mpesa', 'airtel', 'tigo', 'halopesa', 'bank', 'transfer', 'other']

    if (!VALID_EXPENSE_CATEGORIES.includes(String(category))) {
      return NextResponse.json({ error: 'Aina ya gharama si sahihi' }, { status: 400 })
    }
    const safePaymentMethod = VALID_PAYMENT_METHODS.includes(String(payment_method))
      ? String(payment_method)
      : 'cash'

    const admin = createAdminClient()
    const insertPayload: Record<string, unknown> = {
      dalali_id: user.id,
      amount: parseInt(String(amount)),
      category,
      date,
      description:    typeof description === 'string' ? description.slice(0, 500) : null,
      vendor:         typeof vendor === 'string'      ? vendor.slice(0, 200)       : null,
      payment_method: safePaymentMethod,
    }
    // Only include receipt_url when provided — avoids schema-cache errors if column is missing
    if (typeof receipt_url === 'string' && receipt_url.trim()) {
      insertPayload.receipt_url = receipt_url.slice(0, 1000)
    }
    const { data, error } = await admin
      .from('dalali_expenses')
      .insert(insertPayload)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    cache.invalidatePrefix(`finance-stats:${user.id}:`)
    return NextResponse.json({ success: true, expense: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/dalali/finance/expenses]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID inahitajika' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    const allowed = ['amount', 'category', 'date', 'description', 'vendor', 'payment_method']
    const patch: Record<string, unknown> = {}
    for (const k of allowed) if (k in body) patch[k] = body[k]
    // Only include receipt_url when explicitly provided — avoids schema-cache errors if column is missing
    if (typeof body.receipt_url === 'string' && body.receipt_url.trim()) {
      patch.receipt_url = body.receipt_url.slice(0, 1000)
    }

    const admin = createAdminClient()
    const { data, error } = await admin.from('dalali_expenses')
      .update(patch).eq('id', id).eq('dalali_id', user.id).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    cache.invalidatePrefix(`finance-stats:${user.id}:`)
    return NextResponse.json({ success: true, expense: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH app/api/v1/dalali/finance/expenses]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID inahitajika' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('dalali_expenses').delete().eq('id', id).eq('dalali_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    cache.invalidatePrefix(`finance-stats:${user.id}:`)
    return NextResponse.json({ success: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE app/api/v1/dalali/finance/expenses]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
