import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'

const admin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function verify(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// GET — called by Vercel Cron every hour
export async function GET(req: NextRequest) {
  if (!verify(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runHourlyTasks()
}

async function runHourlyTasks() {
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

  // ── 2. Clean up old push notification subscriptions ───
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
