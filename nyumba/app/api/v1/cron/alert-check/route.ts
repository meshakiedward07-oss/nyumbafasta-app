import { type NextRequest } from 'next/server'
import { runAlertCheck } from '@/lib/alerts/checker'
import { notifyAdminOfCriticalAlerts } from '@/lib/alerts/notifier'

export const dynamic = 'force-dynamic'

function verify(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// GET — called by Vercel Cron every 15 minutes
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
