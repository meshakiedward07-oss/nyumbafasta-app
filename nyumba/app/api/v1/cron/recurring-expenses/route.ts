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
// Finds all is_recurring=true expense_records and creates a new copy for the current month
// if one doesn't already exist for this month.
export async function GET(req: NextRequest) {
  if (!verify(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd   = new Date(year, month, 1).toISOString().split('T')[0]

  try {
    // Fetch all recurring expense templates
    const { data: templates, error: fetchErr } = await admin
      .from('expense_records')
      .select('id, category, subcategory, description, vendor, amount_tzs, amount_usd, payment_method, recurring_period, receipt_url, added_by')
      .eq('is_recurring', true)
      .eq('status', 'paid')

    if (fetchErr) {
      console.error('[cron/recurring-expenses] Fetch error:', fetchErr.message)
      return Response.json({ error: fetchErr.message }, { status: 500 })
    }

    const recurring = templates ?? []
    if (recurring.length === 0) {
      return Response.json({ created: 0, skipped: 0, message: 'No recurring expenses configured' })
    }

    // Find which ones already have an entry this month (match by description + category)
    const { data: existing } = await admin
      .from('expense_records')
      .select('description, category')
      .gte('expense_date', monthStart)
      .lt('expense_date', monthEnd)
      .eq('is_recurring', false) // new copies are not marked recurring

    const existingKeys = new Set(
      (existing ?? []).map(e => `${e.category}::${e.description}`)
    )

    // Filter out monthly-only ones that are already covered this month
    const toCreate = recurring.filter(r => {
      const key = `${r.category}::${r.description}`
      return !existingKeys.has(key)
    })

    if (toCreate.length === 0) {
      console.log('[cron/recurring-expenses] All recurring expenses already exist for', monthStart)
      return Response.json({ created: 0, skipped: recurring.length, period: monthStart })
    }

    const d       = new Date(monthStart)
    const weekNum = Math.ceil(d.getDate() / 7)

    const inserts = toCreate.map(r => ({
      category:         r.category,
      subcategory:      r.subcategory,
      description:      r.description,
      vendor:           r.vendor,
      amount_tzs:       r.amount_tzs,
      amount_usd:       r.amount_usd,
      payment_method:   r.payment_method,
      expense_date:     monthStart,
      month,
      year,
      week:             weekNum,
      is_recurring:     false,     // copies are not themselves templates
      recurring_period: null,
      receipt_url:      r.receipt_url,
      added_by:         r.added_by,
      status:           'paid',
      notes:            `Auto-created from recurring template (${r.id})`,
    }))

    const { error: insertErr } = await admin.from('expense_records').insert(inserts)
    if (insertErr) {
      console.error('[cron/recurring-expenses] Insert error:', insertErr.message)
      return Response.json({ error: insertErr.message }, { status: 500 })
    }

    console.log(`[cron/recurring-expenses] Created ${inserts.length} recurring expenses for ${monthStart}`)
    return Response.json({
      created:  inserts.length,
      skipped:  recurring.length - inserts.length,
      period:   monthStart,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/recurring-expenses] Uncaught:', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
