import { NextRequest, NextResponse } from 'next/server'
import {
  runGoogleMapsRunner,
  runGoogleBusinessRunner,
  runFacebookGroupsRunner,
  runFacebookPagesRunner,
  runInstagramRunner,
  runTiktokRunner,
} from '@/lib/agent/runners'
import {
  PRIORITY_REGIONS,
  SECONDARY_REGIONS,
  TERTIARY_REGIONS,
} from '@/lib/agent/regions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []
  const errors: string[] = []

  const dayOfWeek = new Date().getDay()
  let weeklyRegions: string[]

  if (dayOfWeek === 1) {
    weeklyRegions = PRIORITY_REGIONS
  } else if (dayOfWeek === 2) {
    weeklyRegions = SECONDARY_REGIONS
  } else {
    weeklyRegions = TERTIARY_REGIONS
  }

  for (const region of weeklyRegions) {
    try {
      const settled = await Promise.allSettled([
        runGoogleMapsRunner(region),
        runGoogleBusinessRunner(region),
        runFacebookGroupsRunner(region),
        runFacebookPagesRunner(region),
        runInstagramRunner(region),
        runTiktokRunner(region),
      ])

      const failed = settled.filter(r => r.status === 'rejected').length
      results.push(`✅ ${region} — ${settled.length - failed}/${settled.length} sources zimefanikiwa`)
      await new Promise(r => setTimeout(r, 3000))
    } catch (e) {
      errors.push(`❌ ${region}: ${String(e)}`)
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    regions_count: weeklyRegions.length,
    results,
    errors,
  })
}
