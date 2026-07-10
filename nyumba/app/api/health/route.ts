import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cache } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

// GET /api/health — public uptime check (no auth required)
// Returns 200 ok | 503 degraded
export async function GET() {
  const start = Date.now()

  // DB ping
  let dbStatus: 'ok' | 'error' = 'error'
  let dbLatencyMs = 0
  let dbError: string | undefined

  try {
    const admin = createAdminClient()
    const t0 = Date.now()
    const { error } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    dbLatencyMs = Date.now() - t0
    if (error) {
      dbError = error.message
    } else {
      dbStatus = 'ok'
    }
  } catch (err) {
    dbError = String(err)
  }

  // Cache ping
  let cacheStatus: 'ok' | 'error' = 'error'
  try {
    cache.set('__health__', 1, 5_000)
    if (cache.get('__health__') === 1) cacheStatus = 'ok'
  } catch { /* non-fatal */ }

  const allOk = dbStatus === 'ok' && cacheStatus === 'ok'

  return NextResponse.json(
    {
      status:      allOk ? 'ok' : 'degraded',
      timestamp:   new Date().toISOString(),
      responseMs:  Date.now() - start,
      cacheSize:   cache.size,
      uptime:      process.uptime(),
      checks: {
        database: { status: dbStatus, latencyMs: dbLatencyMs, ...(dbError ? { error: dbError } : {}) },
        cache:    { status: cacheStatus },
      },
    },
    {
      status:  allOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
