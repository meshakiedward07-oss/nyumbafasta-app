import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'
import {
  getCachedRecommendation,
  analyzeBestTimes,
  collectPostPerformance,
  getHeatmapData,
} from '@/lib/social/bestTimeAnalyzer'

export const maxDuration = 60

// GET /api/v1/social/best-time?platform=instagram
export async function GET(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const platform = (new URL(req.url).searchParams.get('platform') ?? 'instagram') as 'instagram' | 'facebook'

  const [rec, heatmap] = await Promise.all([
    getCachedRecommendation(platform),
    getHeatmapData(platform),
  ])

  return NextResponse.json({ ...rec, heatmap })
}

// POST /api/v1/social/best-time — trigger fresh analysis
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { platform = 'instagram' } = await req.json() as { platform?: 'instagram' | 'facebook' }

  console.log('[BestTime] Starting fresh analysis for', platform)
  const saved = await collectPostPerformance(platform)
  const result = await analyzeBestTimes(platform)
  const heatmap = await getHeatmapData(platform)

  return NextResponse.json({ ...result, heatmap, postsAnalyzed: saved })
}
