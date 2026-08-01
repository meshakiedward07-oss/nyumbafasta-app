import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { cache, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const CACHE_KEY = 'admin:rent-collection'
    const hit = cache.get(CACHE_KEY)
    if (hit) return NextResponse.json(hit)

    const admin = createAdminClient()
    const now   = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

    const [leasesRes, paymentsRes] = await Promise.all([
      admin.from('leases').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('lease_payments')
        .select('amount_due, amount_paid, status, late_fee_amount')
        .gte('due_date', monthStart)
        .lte('due_date', monthEnd),
    ])

    const payments = paymentsRes.data ?? []
    const total_due  = payments.reduce((s, p) => s + Number(p.amount_due ?? 0), 0)
    const total_paid = payments
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount_paid ?? 0), 0)

    const overdue  = payments.filter(p => p.status === 'late' || p.status === 'partial')
    const overdue_amount = overdue.reduce((s, p) => s + (Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0)), 0)
    const total_late_fees = payments.reduce((s, p) => s + Number((p as { late_fee_amount?: unknown }).late_fee_amount ?? 0), 0)

    const result = {
      active_leases:         leasesRes.count  ?? 0,
      total_due_this_month:  total_due,
      total_paid_this_month: total_paid,
      collection_rate:       total_due > 0 ? Math.round((total_paid / total_due) * 1000) / 10 : 0,
      overdue_count:         overdue.length,
      overdue_amount,
      total_late_fees,
      pending_count:         payments.filter(p => p.status === 'pending').length,
      paid_count:            payments.filter(p => p.status === 'paid').length,
    }

    cache.set(CACHE_KEY, result, TTL.FINANCE_STATS)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /admin/rent-collection]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
