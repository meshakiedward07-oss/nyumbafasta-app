import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

async function authorize(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [memberRes, profileRes] = await Promise.all([
    admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle(),
    admin.from('users').select('role').eq('id', user.id).single(),
  ])
  const isAdmin = ['admin', 'staff'].includes(profileRes.data?.role ?? '')
  if (!memberRes.data && !isAdmin) return null
  const canWrite = isAdmin || ['owner', 'branch_manager', 'accountant'].includes(memberRes.data?.role ?? '')
  return { user, admin, canWrite }
}

// GET /api/v1/organizations/:id/recurring-expenses
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  const ctx = await authorize(orgId)
  if (!ctx) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const { data, error } = await ctx.admin
    .from('org_recurring_expenses')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

// POST /api/v1/organizations/:id/recurring-expenses
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  const ctx = await authorize(orgId)
  if (!ctx) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
  if (!ctx.canWrite) return NextResponse.json({ error: 'Huna ruhusa ya kuandika' }, { status: 403 })

  const body = await req.json()
  const { amount_tzs, category, description, vendor, payment_method, day_of_month } = body

  if (!amount_tzs || !description) {
    return NextResponse.json({ error: 'amount_tzs na description zinahitajika' }, { status: 400 })
  }

  const { data, error } = await ctx.admin.from('org_recurring_expenses').insert({
    organization_id: orgId,
    amount_tzs:      Number(amount_tzs),
    category:        category ?? 'other',
    description:     String(description).slice(0, 500),
    vendor:          vendor ? String(vendor).slice(0, 200) : null,
    payment_method:  payment_method ?? 'cash',
    day_of_month:    day_of_month ? Math.min(28, Math.max(1, Number(day_of_month))) : 1,
    created_by:      ctx.user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data }, { status: 201 })
}

// PATCH /api/v1/organizations/:id/recurring-expenses?templateId=...
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  const ctx = await authorize(orgId)
  if (!ctx) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
  if (!ctx.canWrite) return NextResponse.json({ error: 'Huna ruhusa ya kuandika' }, { status: 403 })

  const url = new URL(req.url)
  const templateId = url.searchParams.get('templateId')
  if (!templateId) return NextResponse.json({ error: 'templateId inahitajika' }, { status: 400 })

  const body = await req.json()
  const allowed = ['amount_tzs', 'category', 'description', 'vendor', 'payment_method', 'day_of_month', 'is_active']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (k in body) patch[k] = body[k]
  }
  if ('day_of_month' in patch) patch.day_of_month = Math.min(28, Math.max(1, Number(patch.day_of_month)))

  const { data, error } = await ctx.admin.from('org_recurring_expenses')
    .update(patch).eq('id', templateId).eq('organization_id', orgId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

// DELETE /api/v1/organizations/:id/recurring-expenses?templateId=...
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  const ctx = await authorize(orgId)
  if (!ctx) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
  if (!ctx.canWrite) return NextResponse.json({ error: 'Huna ruhusa ya kuandika' }, { status: 403 })

  const url = new URL(req.url)
  const templateId = url.searchParams.get('templateId')
  if (!templateId) return NextResponse.json({ error: 'templateId inahitajika' }, { status: 400 })

  const { error } = await ctx.admin.from('org_recurring_expenses')
    .delete().eq('id', templateId).eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
