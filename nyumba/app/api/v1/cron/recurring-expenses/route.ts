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

// GET — called by Vercel Cron on the 1st of each month at 3:30 AM UTC
// Processes org_recurring_expenses and creates org_expenses entries for the current month.
export async function GET(req: NextRequest) {
  if (!verify(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  try {
    // Fetch all active recurring expense templates
    const { data: templates, error: fetchErr } = await admin
      .from('org_recurring_expenses')
      .select('id, organization_id, amount_tzs, category, description, vendor, payment_method, day_of_month, last_applied_month, created_by')
      .eq('is_active', true)

    if (fetchErr) {
      console.error('[cron/recurring-expenses] Fetch error:', fetchErr.message)
      return Response.json({ error: fetchErr.message }, { status: 500 })
    }

    const toProcess = (templates ?? []).filter(t => t.last_applied_month !== monthKey)
    if (toProcess.length === 0) {
      return Response.json({ created: 0, skipped: templates?.length ?? 0, period: monthKey, message: 'All templates already applied this month' })
    }

    let created = 0
    let skipped = 0

    for (const t of toProcess) {
      // Build expense_date using day_of_month, clamped to end of month
      const lastDayOfMonth = new Date(year, month, 0).getDate()
      const day = Math.min(t.day_of_month, lastDayOfMonth)
      const expenseDate = `${monthKey}-${String(day).padStart(2, '0')}`

      const { error: insertErr } = await admin.from('org_expenses').insert({
        organization_id: t.organization_id,
        amount_tzs:      t.amount_tzs,
        category:        t.category,
        description:     t.description,
        vendor:          t.vendor,
        expense_date:    expenseDate,
        payment_method:  t.payment_method,
        notes:           `Auto-created from recurring template (${t.id})`,
        recorded_by:     t.created_by,
      })

      if (insertErr) {
        console.error(`[cron/recurring-expenses] Insert error for template ${t.id}:`, insertErr.message)
        skipped++
        continue
      }

      // Mark as applied for this month
      await admin.from('org_recurring_expenses')
        .update({ last_applied_month: monthKey, updated_at: now.toISOString() })
        .eq('id', t.id)
        .then(() => {}, () => {})

      created++
    }

    console.log(`[cron/recurring-expenses] Created ${created} org expenses for ${monthKey}`)
    return Response.json({ created, skipped, period: monthKey })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/recurring-expenses] Uncaught:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
