import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/:id/lease-payments
// Returns all payments across all leases for an org, with tenant + unit info.
// Query params: status (pending|proof|paid|overdue|all), limit, offset
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: orgId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ count: membership }, { data: profile }] = await Promise.all([
      admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('user_id', user.id),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    if (!membership && !['admin', 'staff'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const url    = req.nextUrl
    const status = url.searchParams.get('status') ?? 'all'
    const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '30'), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    // Get all leases for this org with tenant + unit info
    const { data: leases } = await admin
      .from('leases')
      .select('id, tenant:users!tenant_id(id, full_name, phone), unit:property_units(id, unit_number)')
      .eq('org_id', orgId)

    const leaseIds = (leases ?? []).map(l => l.id)
    const leaseMap = new Map((leases ?? []).map(l => [l.id, l]))

    if (leaseIds.length === 0) {
      return NextResponse.json({ payments: [], total: 0 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    let query = admin
      .from('lease_payments')
      .select('id, lease_id, status, amount_due, amount_paid, due_date, paid_date, invoice_sent_at, verified_at, proof_url, proof_note, payment_method, reference, notes', { count: 'exact' })
      .in('lease_id', leaseIds)
      .order('due_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status === 'pending') {
      query = query.in('status', ['pending', 'partial'])
    } else if (status === 'proof') {
      query = query.eq('status', 'proof_uploaded')
    } else if (status === 'paid') {
      query = query.eq('status', 'paid')
    } else if (status === 'overdue') {
      query = query.in('status', ['pending', 'partial']).lt('due_date', todayStr)
    }
    // 'all' has no filter

    const { data: payments, count, error } = await query
    if (error) throw error

    const enriched = (payments ?? []).map(p => {
      const lease  = leaseMap.get(p.lease_id)
      const tenant = lease?.tenant as unknown as { id: string; full_name: string | null; phone: string | null } | null
      const unit   = lease?.unit   as unknown as { id: string; unit_number: string } | null
      return {
        ...p,
        tenant_name:  tenant?.full_name ?? null,
        tenant_phone: tenant?.phone     ?? null,
        unit_number:  unit?.unit_number  ?? null,
      }
    })

    return NextResponse.json({ payments: enriched, total: count ?? 0 })
  } catch (err) {
    console.error('[GET /organizations/:id/lease-payments]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
