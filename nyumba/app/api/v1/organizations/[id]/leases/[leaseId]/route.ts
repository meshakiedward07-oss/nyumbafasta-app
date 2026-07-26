import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string; leaseId: string } }

// GET /api/v1/organizations/:id/leases/:leaseId
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: orgId, leaseId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ count: membership }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', user.id),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    // Tenants can also view their own lease
    const { data: leaseCheck } = await admin.from('leases').select('tenant_id').eq('id', leaseId).maybeSingle()
    const isTenant = leaseCheck?.tenant_id === user.id
    if (!membership && !isAdminStaff && !isTenant) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const [leaseRes, paymentsRes, bankingRes] = await Promise.all([
      admin.from('leases').select(`
        *,
        tenant:users!tenant_id(id, full_name, phone, email, avatar_url),
        unit:property_units(id, unit_number, unit_type, monthly_rent),
        listing:listings(id, title, district, region)
      `).eq('id', leaseId).eq('org_id', orgId).single(),
      admin.from('lease_payments').select('*').eq('lease_id', leaseId).order('due_date', { ascending: false }),
      admin.from('organization_banking').select('bank_name, account_name, account_number, branch, mobile_money_number, mobile_money_provider, additional_instructions').eq('org_id', orgId).maybeSingle(),
    ])

    if (leaseRes.error) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })
    return NextResponse.json({ lease: leaseRes.data, payments: paymentsRes.data ?? [], banking: bankingRes.data ?? null })
  } catch (err) {
    console.error('[GET /organizations/:id/leases/:leaseId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/organizations/:id/leases/:leaseId
export async function PATCH(req: NextRequest, { params }: Params) {
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
    const canWrite = isAdminStaff || ['owner', 'branch_manager'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const { status, termination_reason, end_date, notes, deposit_paid } = body

    // Get current lease
    const { data: current } = await admin
      .from('leases')
      .select('id, unit_id, org_id, status')
      .eq('id', leaseId)
      .single()

    if (!current) return NextResponse.json({ error: 'Mkataba haupatikani' }, { status: 404 })
    if (current.org_id !== orgId && !isAdminStaff) return NextResponse.json({ error: 'Mkataba huu si wa shirika lako' }, { status: 403 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (termination_reason) updates.termination_reason = termination_reason
    if (end_date) updates.end_date = end_date
    if (notes !== undefined) updates.notes = notes
    if (deposit_paid !== undefined) {
      updates.deposit_paid = deposit_paid
      updates.deposit_paid_at = deposit_paid ? new Date().toISOString() : null
    }

    const { data: lease, error } = await admin
      .from('leases')
      .update(updates)
      .eq('id', leaseId)
      .select()
      .single()

    if (error) throw error

    // Free the unit if lease is ended/terminated
    if (['terminated', 'expired'].includes(status ?? '')) {
      await admin
        .from('property_units')
        .update({ status: 'vacant', updated_at: new Date().toISOString() })
        .eq('id', current.unit_id)
    }

    return NextResponse.json({ lease })
  } catch (err) {
    console.error('[PATCH /leases/:leaseId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
