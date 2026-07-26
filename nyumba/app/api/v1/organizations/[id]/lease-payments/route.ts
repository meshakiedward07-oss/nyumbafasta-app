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
    const format = url.searchParams.get('format')
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
      if (format === 'csv') {
        return new Response('Jina,Kitengo,Tarehe ya Ankara,Kiasi,Kiasi Kilicholipwa,Hali,Tarehe ya Malipo,Njia ya Malipo,Kumbukumbu,Imethibitishwa\n', {
          headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="malipo-${new Date().toISOString().split('T')[0]}.csv"` },
        })
      }
      return NextResponse.json({ payments: [], total: 0 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    function applyStatusFilter<T extends ReturnType<typeof admin.from>>(q: T): T {
      if (status === 'pending') return (q as unknown as { in: (col: string, vals: string[]) => T }).in('status', ['pending', 'partial', 'late']) as T
      if (status === 'proof')   return (q as unknown as { eq: (col: string, val: string) => T }).eq('status', 'proof_uploaded') as T
      if (status === 'paid')    return (q as unknown as { eq: (col: string, val: string) => T }).eq('status', 'paid') as T
      if (status === 'overdue') return (q as unknown as { in: (col: string, vals: string[]) => unknown; lt: (col: string, val: string) => T }).in('status', ['pending', 'partial', 'late']) as T
      return q
    }

    // ── CSV export (no pagination, all matching rows) ─────────────────────────
    if (format === 'csv') {
      let csvQuery = admin
        .from('lease_payments')
        .select('id, lease_id, status, amount_due, amount_paid, due_date, paid_date, payment_method, reference, verified_at')
        .in('lease_id', leaseIds)
        .order('due_date', { ascending: false })
      if (status === 'pending') csvQuery = csvQuery.in('status', ['pending', 'partial', 'late'])
      else if (status === 'proof') csvQuery = csvQuery.eq('status', 'proof_uploaded')
      else if (status === 'paid') csvQuery = csvQuery.eq('status', 'paid')
      else if (status === 'overdue') csvQuery = csvQuery.in('status', ['pending', 'partial', 'late']).lt('due_date', todayStr)

      const { data: csvRows, error: csvErr } = await csvQuery
      if (csvErr) throw csvErr

      const header = ['Jina la Mpangaji', 'Kitengo', 'Tarehe ya Ankara', 'Kiasi Kinachostahili (TZS)', 'Kiasi Kilicholipwa (TZS)', 'Hali', 'Tarehe ya Malipo', 'Njia ya Malipo', 'Kumbukumbu', 'Tarehe ya Uthibitisho']
      const rows = (csvRows ?? []).map(p => {
        const lease  = leaseMap.get(p.lease_id)
        const tenant = lease?.tenant as unknown as { full_name: string | null } | null
        const unit   = lease?.unit   as unknown as { unit_number: string } | null
        return [
          tenant?.full_name ?? '',
          unit?.unit_number  ?? '',
          p.due_date         ?? '',
          String(p.amount_due ?? ''),
          String(p.amount_paid ?? ''),
          p.status           ?? '',
          p.paid_date        ?? '',
          p.payment_method   ?? '',
          p.reference        ?? '',
          p.verified_at ? p.verified_at.split('T')[0] : '',
        ]
      })

      const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="malipo-${todayStr}.csv"`,
        },
      })
    }

    // ── JSON (paginated) ──────────────────────────────────────────────────────
    let query = admin
      .from('lease_payments')
      .select('id, lease_id, status, amount_due, amount_paid, due_date, paid_date, invoice_sent_at, verified_at, proof_url, proof_note, payment_method, reference, notes', { count: 'exact' })
      .in('lease_id', leaseIds)
      .order('due_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status === 'pending') {
      query = query.in('status', ['pending', 'partial', 'late'])
    } else if (status === 'proof') {
      query = query.eq('status', 'proof_uploaded')
    } else if (status === 'paid') {
      query = query.eq('status', 'paid')
    } else if (status === 'overdue') {
      query = query.in('status', ['pending', 'partial', 'late']).lt('due_date', todayStr)
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
