import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cache } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  try {
    const admin = createAdminClient()
    const { error } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    const dbLatencyMs = Date.now() - start

    if (error) {
      return NextResponse.json(
        { status: 'degraded', db: 'error', error: error.message, latencyMs: dbLatencyMs },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        status: 'ok',
        db: 'ok',
        dbLatencyMs,
        cacheSize: cache.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: String(err), latencyMs: Date.now() - start },
      { status: 503 },
    )
  }
}
