import { type NextRequest } from 'next/server'
import { runAlertCheck } from '@/lib/alerts/checker'
import { notifyAdminOfCriticalAlerts } from '@/lib/alerts/notifier'

export const dynamic = 'force-dynamic'

function verify(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// GET — despite this comment's original claim, vercel.json currently
// schedules this once a day, not every 15 minutes: deliberately downgraded
// to fit the Vercel Hobby plan's "at most once/day" cron limit (see commits
// adcf036/db57c0c, and the same note in cron/hourly/route.ts, whose section
// 2 is meant as this route's fallback). Alert-detection latency is
// therefore capped at ~24h instead of ~15min today — worth tightening back
// to "*/15 * * * *" once Vercel Pro is restored.
export async function GET(req: NextRequest) {
  if (!verify(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAlertCheck()
    await notifyAdminOfCriticalAlerts(result)

    return Response.json({
      success:  true,
      ran_at:   result.ran_at,
      fired:    result.fired,
      existing: result.existing,
      metrics:  result.metrics.length,
    })
  } catch (err) {
    console.error('[cron/alert-check]', err)
    return Response.json({ success: false, error: String(err) }, { status: 500 })
  }
}
