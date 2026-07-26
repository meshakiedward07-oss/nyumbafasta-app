import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/[id]/rent-analytics
// Returns rent collection analytics: invoices sent vs cleared, overdue, totals, monthly trend
export async function GET(_req: NextRequest, { params }: Params) {
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

    // All leases for this org (with unit + tenant)
    const { data: orgLeases } = await admin
      .from('leases')
      .select('id, tenant_id, tenant:users!tenant_id(id, full_name, phone), unit:property_units(id, unit_number)')
      .eq('org_id', orgId)

    const leaseIds = (orgLeases ?? []).map(l => l.id)
    const leaseMap = new Map(
      (orgLeases ?? []).map(l => [l.id, l])
    )

    // All payments for this org's leases
    const { data: payments } = await admin
      .from('lease_payments')
      .select('id, status, amount_due, amount_paid, due_date, paid_date, invoice_sent_at, verified_at, lease_id, proof_url, proof_note')
      .in('lease_id', leaseIds.length > 0 ? leaseIds : ['00000000-0000-0000-0000-000000000000'])
      .order('due_date', { ascending: false })

    const all = payments ?? []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const UNPAID = ['pending', 'partial', 'late']

    const totalInvoicesSent = all.filter(p => p.invoice_sent_at).length
    const totalCleared      = all.filter(p => p.status === 'paid').length
    const totalPending      = all.filter(p => UNPAID.includes(p.status)).length
    const totalProofUp      = all.filter(p => p.status === 'proof_uploaded').length
    const totalOverdue      = all.filter(p =>
      (UNPAID.includes(p.status) || p.status === 'proof_uploaded') && new Date(p.due_date) < today
    ).length

    const amountCollected = all
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + (p.amount_paid ?? p.amount_due ?? 0), 0)

    const amountOutstanding = all
      .filter(p => [...UNPAID, 'proof_uploaded'].includes(p.status))
      .reduce((s, p) => s + (p.amount_due ?? 0), 0)

    // 6-month collection trend
    const months: { month: string; collected: number; invoiced: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const ym = d.toISOString().slice(0, 7)  // "2025-07"
      const label = d.toLocaleDateString('sw-TZ', { month: 'short', year: '2-digit' })
      const invoiced  = all.filter(p => p.due_date?.startsWith(ym)).reduce((s, p) => s + (p.amount_due ?? 0), 0)
      const collected = all.filter(p => p.paid_date?.startsWith(ym) && p.status === 'paid').reduce((s, p) => s + (p.amount_paid ?? p.amount_due ?? 0), 0)
      months.push({ month: label, collected, invoiced })
    }

    function enrichPayment(p: typeof all[number]) {
      const lease = leaseMap.get(p.lease_id)
      const tenant = lease?.tenant as unknown as { id: string; full_name: string | null; phone: string | null } | null
      const unit   = lease?.unit   as unknown as { id: string; unit_number: string } | null
      return { ...p, tenant_name: tenant?.full_name ?? null, tenant_phone: tenant?.phone ?? null, unit_number: unit?.unit_number ?? null }
    }

    const awaitingVerification = all
      .filter(p => p.status === 'proof_uploaded')
      .slice(0, 10)
      .map(enrichPayment)

    const overdueList = all
      .filter(p => ['pending', 'partial', 'late'].includes(p.status) && new Date(p.due_date) < today)
      .slice(0, 10)
      .map(enrichPayment)

    return NextResponse.json({
      summary: {
        total_invoices_sent: totalInvoicesSent,
        total_cleared:       totalCleared,
        total_pending:       totalPending,
        total_proof_up:      totalProofUp,
        total_overdue:       totalOverdue,
        amount_collected:    amountCollected,
        amount_outstanding:  amountOutstanding,
        collection_rate:     totalInvoicesSent > 0
          ? Math.round((totalCleared / totalInvoicesSent) * 100)
          : 0,
      },
      monthly_trend:         months,
      awaiting_verification: awaitingVerification,
      overdue_list:          overdueList,
    })
  } catch (err) {
    console.error('[GET /organizations/[id]/rent-analytics]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
