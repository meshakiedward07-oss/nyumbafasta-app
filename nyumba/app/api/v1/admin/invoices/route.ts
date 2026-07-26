import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/invoices
// Query: q (org name), status, limit, offset
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const sp     = req.nextUrl.searchParams
    const search = sp.get('q')      ?? ''
    const status = sp.get('status') ?? ''
    const limit  = Math.min(parseInt(sp.get('limit')  ?? '50'), 100)
    const offset = parseInt(sp.get('offset') ?? '0')

    const admin = createAdminClient()

    let query = admin
      .from('subscription_invoices')
      .select(`
        *,
        org:organizations(id, name, org_type),
        plan:subscription_plans(id, name, price_tzs),
        confirmer:users!confirmed_by(id, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)

    const { data, count, error } = await query
    if (error) throw error

    let results = data ?? []
    if (search) {
      const lower = search.toLowerCase()
      results = results.filter(r => {
        const org = r.org as { name: string } | null
        return org?.name?.toLowerCase().includes(lower)
      })
    }

    // Summary
    const { data: allStatuses } = await admin
      .from('subscription_invoices')
      .select('status')

    const summary = {
      total:          count ?? 0,
      pending:        allStatuses?.filter(s => s.status === 'pending').length        ?? 0,
      proof_uploaded: allStatuses?.filter(s => s.status === 'proof_uploaded').length ?? 0,
      confirmed:      allStatuses?.filter(s => s.status === 'confirmed').length      ?? 0,
      void:           allStatuses?.filter(s => s.status === 'void').length           ?? 0,
    }

    return NextResponse.json({ invoices: results, count, summary })
  } catch (err) {
    console.error('[GET /admin/invoices]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/admin/invoices — admin creates invoice for any org
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const body  = await req.json()
    const { org_id, plan_id, billing_cycle = 'monthly', notes, due_date } = body

    if (!org_id)  return NextResponse.json({ error: 'org_id inahitajika' }, { status: 400 })
    if (!plan_id) return NextResponse.json({ error: 'plan_id inahitajika' }, { status: 400 })

    const { data: plan } = await admin
      .from('subscription_plans')
      .select('price_tzs')
      .eq('id', plan_id)
      .maybeSingle()

    if (!plan) return NextResponse.json({ error: 'Mpango haukupatikana' }, { status: 404 })

    const multiplier = billing_cycle === 'monthly' ? 1 : billing_cycle === 'quarterly' ? 3 : 12
    const amount_tzs = plan.price_tzs * multiplier

    const defaultDue = new Date()
    defaultDue.setDate(defaultDue.getDate() + 7)

    const { data, error } = await admin
      .from('subscription_invoices')
      .insert({
        org_id, plan_id, amount_tzs, billing_cycle,
        status:   'pending',
        due_date: due_date ?? defaultDue.toISOString().slice(0, 10),
        notes:    notes?.trim() || null,
        created_by: auth.userId,
      })
      .select('*, org:organizations(id, name), plan:subscription_plans(id, name, price_tzs)')
      .single()

    if (error) throw error
    return NextResponse.json({ invoice: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /admin/invoices]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
