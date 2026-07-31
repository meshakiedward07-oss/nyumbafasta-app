import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

async function authorize(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [memberRes, profileRes] = await Promise.all([
    admin.from('organization_members').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('user_id', user.id),
    admin.from('users').select('role').eq('id', user.id).single(),
  ])
  const isAdmin = ['admin', 'staff'].includes(profileRes.data?.role ?? '')
  if (!memberRes.count && !isAdmin) return null
  return { user, admin }
}

// GET /api/v1/organizations/:id/expenses?month=YYYY-MM
export async function GET(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  const ctx = await authorize(orgId)
  if (!ctx) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const monthParam = req.nextUrl.searchParams.get('month')
  let query = ctx.admin.from('org_expenses').select(`
    id, amount_tzs, category, description, vendor, receipt_url,
    expense_date, payment_method, notes, created_at,
    recorded_by_user:users!recorded_by(full_name)
  `).eq('organization_id', orgId).order('expense_date', { ascending: false }).limit(500)

  if (monthParam) {
    const [y, m] = monthParam.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end   = new Date(y, m, 1).toISOString().split('T')[0]
    query = query.gte('expense_date', start).lt('expense_date', end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data })
}

// POST /api/v1/organizations/:id/expenses
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  const ctx = await authorize(orgId)
  if (!ctx) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const body = await req.json()
  const { amount_tzs, category, description, vendor, receipt_url, expense_date, payment_method, notes } = body

  if (!amount_tzs || !description || !expense_date) {
    return NextResponse.json({ error: 'amount_tzs, description, na expense_date zinahitajika' }, { status: 400 })
  }

  const { data, error } = await ctx.admin.from('org_expenses').insert({
    organization_id: orgId,
    amount_tzs:      Number(amount_tzs),
    category:        category ?? 'other',
    description:     String(description).slice(0, 500),
    vendor:          vendor ? String(vendor).slice(0, 200) : null,
    receipt_url:     receipt_url ?? null,
    expense_date,
    payment_method:  payment_method ?? 'cash',
    notes:           notes ? String(notes).slice(0, 1000) : null,
    recorded_by:     ctx.user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, expense: data }, { status: 201 })
}

// PATCH /api/v1/organizations/:id/expenses?expenseId=...
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  const ctx = await authorize(orgId)
  if (!ctx) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const expenseId = req.nextUrl.searchParams.get('expenseId')
  if (!expenseId) return NextResponse.json({ error: 'expenseId inahitajika' }, { status: 400 })

  const body = await req.json()
  const allowed = ['amount_tzs', 'category', 'description', 'vendor', 'receipt_url', 'expense_date', 'payment_method', 'notes']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]
  patch.updated_at = new Date().toISOString()

  const { data, error } = await ctx.admin.from('org_expenses')
    .update(patch).eq('id', expenseId).eq('organization_id', orgId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, expense: data })
}

// DELETE /api/v1/organizations/:id/expenses?expenseId=...
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  const ctx = await authorize(orgId)
  if (!ctx) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const expenseId = req.nextUrl.searchParams.get('expenseId')
  if (!expenseId) return NextResponse.json({ error: 'expenseId inahitajika' }, { status: 400 })

  const { error } = await ctx.admin.from('org_expenses')
    .delete().eq('id', expenseId).eq('organization_id', orgId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
