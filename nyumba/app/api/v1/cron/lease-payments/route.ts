import { NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function verify(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// GET — called by Vercel Cron on the 1st of each month at 2 AM UTC
// Creates lease_payment records for all active leases for the current month,
// skipping leases that already have a payment record for this month.
export async function GET(req: NextRequest) {
  if (!verify(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const dueDate     = `${year}-${String(month).padStart(2, '0')}-01`
  const monthStart  = dueDate
  const monthEnd    = new Date(year, month, 1).toISOString().split('T')[0]

  try {
    // Fetch all active leases with their monthly rent
    const { data: activeLeases, error: leaseErr } = await admin
      .from('leases')
      .select('id, monthly_rent, start_date, end_date')
      .eq('status', 'active')
      .lte('start_date', dueDate) // lease must have started

    if (leaseErr) {
      console.error('[cron/lease-payments] Failed to fetch leases:', leaseErr.message)
      return Response.json({ error: leaseErr.message }, { status: 500 })
    }

    const leases = activeLeases ?? []
    if (leases.length === 0) {
      return Response.json({ created: 0, skipped: 0, message: 'No active leases' })
    }

    const leaseIds = leases.map(l => l.id)

    // Find leases that already have a payment record for this month
    const { data: existing } = await admin
      .from('lease_payments')
      .select('lease_id')
      .in('lease_id', leaseIds)
      .gte('due_date', monthStart)
      .lt('due_date', monthEnd)

    const alreadyHasPayment = new Set((existing ?? []).map(e => e.lease_id))

    const toInsert = leases
      .filter(l => !alreadyHasPayment.has(l.id))
      .filter(l => {
        // Skip leases that ended before this month
        if (l.end_date && l.end_date < monthStart) return false
        return true
      })
      .map(l => ({
        lease_id:   l.id,
        amount_due: l.monthly_rent,
        due_date:   dueDate,
        status:     'pending' as const,
      }))

    let created = 0
    if (toInsert.length > 0) {
      const { error: insertErr } = await admin.from('lease_payments').insert(toInsert)
      if (insertErr) {
        console.error('[cron/lease-payments] Insert failed:', insertErr.message)
        return Response.json({ error: insertErr.message }, { status: 500 })
      }
      created = toInsert.length
    }

    // Apply late fees to past-due pending payments (due before today)
    const today = now.toISOString().split('T')[0]
    const LATE_FEE_PCT = 0.05 // 5% late fee

    const { data: overdue } = await admin
      .from('lease_payments')
      .select('id, amount_due, late_fee_amount')
      .eq('status', 'pending')
      .lt('due_date', today)
      .is('late_fee_applied_at', null)

    if (overdue && overdue.length > 0) {
      const lateUpdates = overdue.map(p => ({
        id:                    p.id,
        status:                'late' as const,
        late_fee_amount:       Math.round(p.amount_due * LATE_FEE_PCT),
        late_fee_applied_at:   now.toISOString(),
      }))
      // Batch update (upsert by id)
      await admin.from('lease_payments').upsert(lateUpdates, { onConflict: 'id' })
      console.log(`[cron/lease-payments] Applied late fees to ${lateUpdates.length} overdue payments`)
    }

    console.log(`[cron/lease-payments] Created ${created} payment records for ${dueDate}, skipped ${alreadyHasPayment.size}`)
    return Response.json({
      created,
      skipped:    alreadyHasPayment.size,
      late_fees:  overdue?.length ?? 0,
      period:     dueDate,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/lease-payments] Uncaught error:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
