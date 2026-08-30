import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { runAlertCheck } from '@/lib/alerts/checker'
import { notifyAdminOfCriticalAlerts } from '@/lib/alerts/notifier'

export const dynamic = 'force-dynamic'

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function verify(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// GET — despite the route name and this comment's original claim, this
// currently runs once a day, not hourly: vercel.json's cron schedule for
// this path was deliberately downgraded to daily to fit the Vercel Hobby
// plan's "at most once/day" cron limit (see commits adcf036/db57c0c). The
// 10-min payment-timeout sweep below (section 1) and the alert-check
// fallback (section 2) both therefore run with up to ~24h of latency
// instead of the ~10min/15min this code's own logic was written for — this
// gets worse (a growing backlog of stuck "pending" unlocks/subscriptions,
// slower fraud/health alerting) as transaction volume grows. Once Vercel
// Pro is restored, tighten vercel.json's schedule for this path back to
// "0 * * * *" (hourly) to restore the originally-intended behavior.
export async function GET(req: NextRequest) {
  if (!verify(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runHourlyTasks()
}

async function runHourlyTasks() {
  const admin = getAdmin()
  const results: string[] = []
  const errors: string[]  = []
  const now = new Date()

  // ── 1. Timeout pending payments (older than 10 min → failed) ──
  try {
    const tenMinAgo = new Date(now.getTime() - 10 * 60_000).toISOString()

    const { data: timedOutUnlocks } = await admin
      .from('contact_unlocks')
      .update({ status: 'failed' })
      .eq('status', 'pending')
      .lt('created_at', tenMinAgo)
      .select('id')

    const { data: timedOutSubs } = await admin
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('created_at', tenMinAgo)
      .select('id')

    results.push(`✅ Timed-out unlocks: ${timedOutUnlocks?.length ?? 0}, subs: ${timedOutSubs?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Payment cleanup: ${String(e)}`)
  }

  // ── 2. Alert check (fallback — /cron/alert-check is meant to be the
  //      primary, every 15 min, but it's ALSO currently downgraded to once
  //      daily on vercel.json for the same Hobby-plan reason as this route —
  //      so right now both this "fallback" and the "primary" run once a day) ──
  try {
    const alertResult = await runAlertCheck()
    await notifyAdminOfCriticalAlerts(alertResult)
    results.push(`✅ Alert check: ${alertResult.fired} new, ${alertResult.existing} existing`)
  } catch (e) {
    errors.push(`❌ Alert check: ${String(e)}`)
  }

  // ── 3. Clean up old push notification subscriptions ───
  try {
    // Remove push subs older than 90 days that haven't been refreshed
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString()
    const { data: deletedSubs } = await admin
      .from('push_subscriptions')
      .delete()
      .lt('created_at', ninetyDaysAgo)
      .select('id')
    results.push(`✅ Old push subs cleaned: ${deletedSubs?.length ?? 0}`)
  } catch {
    // push_subscriptions table may not exist — ignore silently
    results.push('⚠️ Push cleanup skipped (table may not exist)')
  }

  return Response.json({
    success: errors.length === 0,
    timestamp: now.toISOString(),
    results,
    errors,
  })
}
