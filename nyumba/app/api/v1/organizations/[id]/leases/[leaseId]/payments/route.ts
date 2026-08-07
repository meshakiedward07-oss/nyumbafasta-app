import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string; leaseId: string } }

// GET /api/v1/organizations/:id/leases/:leaseId/payments
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: orgId, leaseId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { count } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', user.id)

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!count && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data, error } = await admin
      .from('lease_payments')
      .select('*')
      .eq('lease_id', leaseId)
      .order('due_date', { ascending: false })

    if (error) throw error
    return NextResponse.json({ payments: data ?? [] })
  } catch (err) {
    console.error('[GET /leases/:leaseId/payments]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/:id/leases/:leaseId/payments
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId, leaseId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager', 'agent', 'accountant'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const { amount_due, amount_paid, due_date, paid_date, payment_method, reference, notes } = body

    if (!amount_due || amount_due <= 0) return NextResponse.json({ error: 'Kiasi inahitajika' }, { status: 400 })
    if (!due_date) return NextResponse.json({ error: 'Tarehe ya malipo inahitajika' }, { status: 400 })

    // Derive status from amounts unless caller explicitly provides it
    const actualPaid = amount_paid ?? amount_due
    const status = body.status ?? (actualPaid >= amount_due ? 'paid' : 'partial')

    // Verify lease belongs to org
    const { data: lease } = await admin.from('leases').select('id, org_id').eq('id', leaseId).single()
    if (!lease) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })
    if (lease.org_id !== orgId && !isAdminStaff) return NextResponse.json({ error: 'Mkataba huu si wa shirika lako' }, { status: 403 })

    const { data: payment, error } = await admin
      .from('lease_payments')
      .insert({
        lease_id: leaseId,
        amount_due,
        amount_paid: actualPaid,
        due_date,
        paid_date: paid_date ?? new Date().toISOString().split('T')[0],
        status,
        payment_method: payment_method || null,
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        recorded_by: user.id,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ payment }, { status: 201 })
  } catch (err) {
    console.error('[POST /leases/:leaseId/payments]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
