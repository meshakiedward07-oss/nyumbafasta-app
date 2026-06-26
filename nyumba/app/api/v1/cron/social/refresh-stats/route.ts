import { type NextRequest } from 'next/server'
import { refreshAllStats } from '@/lib/social/statsRefresher'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  const xHeader = req.headers.get('x-cron-secret')
  return auth === `Bearer ${secret}` || xHeader === secret
}

// POST — called by Vercel Cron or admin panel
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await refreshAllStats()
    return Response.json({
      success: result.errors.length === 0,
      updated: result.updated,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/social/refresh-stats]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

// GET — Vercel Cron uses GET by default
export async function GET(req: NextRequest) {
  return POST(req)
}
