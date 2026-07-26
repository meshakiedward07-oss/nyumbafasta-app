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

    // All payments for this org's leases
    const { data: payments } = await admin
      .from('lease_payments')
      .select('id, status, amount_due, amount_paid, due_date, paid_date, invoice_sent_at, verified_at, lease_id')
      .in('lease_id',
        (await admin.from('leases').select('id').eq('org_id', orgId)).data?.map(l => l.id) ?? []
      )
      .order('due_date', { ascending: false })

    const all = payments ?? []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const totalInvoicesSent = all.filter(p => p.invoice_sent_at).length
    const totalCleared      = all.filter(p => p.status === 'paid').length
    const totalPending      = all.filter(p => ['pending', 'partial'].includes(p.status)).length
    const totalProofUp      = all.filter(p => p.status === 'proof_uploaded').length
    const totalOverdue      = all.filter(p =>
      ['pending', 'partial'].includes(p.status) && new Date(p.due_date) < today
    ).length

    const amountCollected = all
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + (p.amount_paid ?? p.amount_due ?? 0), 0)

    const amountOutstanding = all
      .filter(p => ['pending', 'partial', 'proof_uploaded'].includes(p.status))
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

    // Recent unpaid (awaiting verification or proof)
    const awaitingVerification = all
      .filter(p => p.status === 'proof_uploaded')
      .slice(0, 5)

    const overdueList = all
      .filter(p => ['pending', 'partial'].includes(p.status) && new Date(p.due_date) < today)
      .slice(0, 5)

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
