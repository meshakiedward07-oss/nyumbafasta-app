import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notifyOrgInvoiceCreated } from '@/lib/subscription/notifications'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/[id]/invoices
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: m }, { data: u }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    if (!m && !['admin', 'staff'].includes(u?.role ?? '')) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const { data, error } = await admin
      .from('subscription_invoices')
      .select('*, plan:subscription_plans(id, name, price_tzs, billing_cycle)')
      .eq('org_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ invoices: data ?? [] })
  } catch (err) {
    console.error('[GET /organizations/[id]/invoices]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/[id]/invoices
// Creates an upgrade request invoice (org-initiated). Body: { plan_id, billing_cycle?, notes? }
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: m }, { data: u }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(u?.role ?? '')
    if (!isAdminStaff && m?.role !== 'owner') {
      return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kuomba ankara' }, { status: 403 })
    }

    const body = await req.json()
    const { plan_id, billing_cycle = 'monthly', notes } = body

    if (!plan_id) return NextResponse.json({ error: 'plan_id inahitajika' }, { status: 400 })

    const { data: plan } = await admin
      .from('subscription_plans')
      .select('id, price_tzs, billing_cycle')
      .eq('id', plan_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!plan) return NextResponse.json({ error: 'Mpango haukupatikana au hauna kazi' }, { status: 404 })

    const validCycles = ['monthly', 'quarterly', 'annual']
    if (!validCycles.includes(billing_cycle)) {
      return NextResponse.json({ error: 'Mzunguko wa bili si sahihi' }, { status: 400 })
    }

    // Calculate amount: quarterly = 3x, annual = 12x
    const multiplier = billing_cycle === 'monthly' ? 1 : billing_cycle === 'quarterly' ? 3 : 12
    const amount_tzs = plan.price_tzs * multiplier

    // Due date: 7 days from now
    const due = new Date()
    due.setDate(due.getDate() + 7)

    const { data, error } = await admin
      .from('subscription_invoices')
      .insert({
        org_id:        id,
        plan_id:       plan.id,
        amount_tzs,
        billing_cycle,
        status:        'pending',
        due_date:      due.toISOString().slice(0, 10),
        notes:         notes?.trim() || null,
        created_by:    user.id,
      })
      .select('*, plan:subscription_plans(id, name, price_tzs)')
      .single()

    if (error) throw error

    // Notify org owner asynchronously (non-fatal)
    const planName = (data.plan as { name: string } | null)?.name ?? 'Mpango'
    notifyOrgInvoiceCreated(id, amount_tzs, planName).catch(() => {})

    return NextResponse.json({ invoice: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/[id]/invoices]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
