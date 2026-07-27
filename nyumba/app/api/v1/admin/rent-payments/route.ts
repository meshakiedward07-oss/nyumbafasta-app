import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/rent-payments
// Fleet view of lease payments across all organizations.
// Query params: org_id, status (all|pending|proof|paid|overdue), date_from, date_to, limit, offset
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const admin    = createAdminClient()
    const url      = req.nextUrl
    const orgId    = url.searchParams.get('org_id')    ?? ''
    const status   = url.searchParams.get('status')    ?? 'all'
    const dateFrom = url.searchParams.get('date_from') ?? ''
    const dateTo   = url.searchParams.get('date_to')   ?? ''
    const limit    = Math.min(parseInt(url.searchParams.get('limit')  ?? '30'), 100)
    const offset   = parseInt(url.searchParams.get('offset') ?? '0')

    const today = new Date().toISOString().split('T')[0]

    // Fetch leases (with org, tenant, unit) — optionally filtered by org
    let leaseQuery = admin
      .from('leases')
      .select('id, org_id, organization:organizations!org_id(id, name), tenant:users!tenant_id(id, full_name, phone), unit:property_units!unit_id(id, unit_number)')

    if (orgId) leaseQuery = leaseQuery.eq('org_id', orgId)

    const { data: leases } = await leaseQuery
    const leaseIds  = (leases ?? []).map(l => l.id)
    const leaseMap  = new Map((leases ?? []).map(l => [l.id, l]))

    if (leaseIds.length === 0) {
      return NextResponse.json({
        payments: [], total: 0,
        summary: { total: 0, pending: 0, proof: 0, paid: 0, overdue: 0, total_due: 0, total_paid: 0 },
      })
    }

    // Build payments query
    let query = admin
      .from('lease_payments')
      .select(
        'id, lease_id, status, amount_due, amount_paid, due_date, paid_date, verified_at, proof_url, payment_method, reference',
        { count: 'exact' }
      )
      .in('lease_id', leaseIds)
      .order('due_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status === 'pending') query = query.in('status', ['pending', 'partial', 'late'])
    else if (status === 'proof')   query = query.eq('status', 'proof_uploaded')
    else if (status === 'paid')    query = query.eq('status', 'paid')
    else if (status === 'overdue') query = query.in('status', ['pending', 'partial', 'late']).lt('due_date', today)

    if (dateFrom) query = query.gte('due_date', dateFrom)
    if (dateTo)   query = query.lte('due_date', dateTo)

    const { data: payments, count, error } = await query
    if (error) throw error

    // Enrich with tenant/unit/org from leaseMap
    const enriched = (payments ?? []).map(p => {
      const lease  = leaseMap.get(p.lease_id)
      const tenant = (lease?.tenant  as unknown as { id: string; full_name: string | null; phone: string | null } | null)
      const unit   = (lease?.unit    as unknown as { id: string; unit_number: string } | null)
      const org    = (lease?.organization as unknown as { id: string; name: string } | null)
      return {
        ...p,
        org_id:       lease?.org_id      ?? null,
        org_name:     org?.name          ?? null,
        tenant_name:  tenant?.full_name  ?? null,
        tenant_phone: tenant?.phone      ?? null,
        unit_number:  unit?.unit_number  ?? null,
      }
    })

    // Summary stats across entire result (before pagination)
    const { data: allStats } = await admin
      .from('lease_payments')
      .select('status, due_date, amount_due, amount_paid')
      .in('lease_id', leaseIds)

    const summary = {
      total:      count ?? 0,
      pending:    allStats?.filter(p => ['pending', 'partial', 'late'].includes(p.status)).length ?? 0,
      proof:      allStats?.filter(p => p.status === 'proof_uploaded').length ?? 0,
      paid:       allStats?.filter(p => p.status === 'paid').length           ?? 0,
      overdue:    allStats?.filter(p => ['pending', 'partial', 'late'].includes(p.status) && (p.due_date ?? '') < today).length ?? 0,
      total_due:  allStats?.reduce((s, p) => s + (p.amount_due  ?? 0), 0)    ?? 0,
      total_paid: allStats?.reduce((s, p) => s + (p.amount_paid ?? 0), 0)    ?? 0,
    }

    return NextResponse.json({ payments: enriched, total: count ?? 0, summary })
  } catch (err) {
    console.error('[GET /admin/rent-payments]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
