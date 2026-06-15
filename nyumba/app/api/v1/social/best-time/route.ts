import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCachedRecommendation,
  analyzeBestTimes,
  collectPostPerformance,
  getHeatmapData,
} from '@/lib/social/bestTimeAnalyzer'

export const maxDuration = 60

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/social/best-time?platform=instagram
export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
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
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { platform = 'instagram' } = await req.json() as { platform?: 'instagram' | 'facebook' }

  console.log('[BestTime] Starting fresh analysis for', platform)
  const saved = await collectPostPerformance(platform)
  const result = await analyzeBestTimes(platform)
  const heatmap = await getHeatmapData(platform)

  return NextResponse.json({ ...result, heatmap, postsAnalyzed: saved })
}
