import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

const STAGES = ['mpya', 'mawasiliano', 'anajisajili', 'ameweka_listing', 'amefanikiwa', 'amepotea'] as const
const STAGE_LABELS: Record<string, string> = {
  mpya:             'Mpya',
  mawasiliano:      'Mawasiliano',
  anajisajili:      'Anajisajili',
  ameweka_listing:  'Ameweka Listing',
  amefanikiwa:      'Amefanikiwa',
  amepotea:         'Amepotea',
}

// GET /api/v1/admin/staff/[id]/performance?period=7|30|90
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const db = createAdminClient()
  const staffId = params.id
  const days = parseInt(new URL(req.url).searchParams.get('period') || '30', 10)
  const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. All-time pipeline breakdown ───────────────────────────────────────
  const { data: allLeads } = await db
    .from('agent_leads')
    .select('pipeline_stage, assigned_at, converted_at, last_contacted_at')
    .eq('assigned_to', staffId)

  const pipelineCounts: Record<string, number> = Object.fromEntries(STAGES.map(s => [s, 0]))
  for (const l of allLeads ?? []) {
    const s = l.pipeline_stage as string
    if (pipelineCounts[s] !== undefined) pipelineCounts[s]++
  }
  const totalAssigned = (allLeads ?? []).length

  // ── 2. Period-specific KPIs ───────────────────────────────────────────────
  const { data: periodLeads } = await db
    .from('agent_leads')
    .select('pipeline_stage, assigned_at, converted_at, last_contacted_at')
    .eq('assigned_to', staffId)
    .gte('assigned_at', periodStart)

  const periodTotal     = (periodLeads ?? []).length
  const periodConverted = (periodLeads ?? []).filter(l => l.pipeline_stage === 'amefanikiwa').length
  const periodLost      = (periodLeads ?? []).filter(l => l.pipeline_stage === 'amepotea').length
  const periodContacted = (periodLeads ?? []).filter(l => l.last_contacted_at != null).length
  const conversionRate  = periodTotal > 0 ? Math.round((periodConverted / periodTotal) * 1000) / 10 : 0

  // ── 3. Daily activity from log ────────────────────────────────────────────
  const { data: activityRows } = await db
    .from('staff_activity_log')
    .select('created_at')
    .eq('staff_id', staffId)
    .gte('created_at', periodStart)
    .order('created_at', { ascending: true })

  // Group by calendar date (YYYY-MM-DD)
  const byDate: Record<string, number> = {}
  for (const a of activityRows ?? []) {
    const d = (a.created_at as string).slice(0, 10)
    byDate[d] = (byDate[d] ?? 0) + 1
  }
  // Fill every date in the window so chart has no gaps
  const dailyActivity: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    dailyActivity.push({ date: d, count: byDate[d] ?? 0 })
  }
  const totalActivityCount = (activityRows ?? []).length
  const avgDailyActivity   = Math.round((totalActivityCount / days) * 10) / 10

  // ── 4. Team average conversion rate for comparison ───────────────────────
  const { data: teamStats } = await db
    .from('agent_leads')
    .select('assigned_to, pipeline_stage')
    .gte('assigned_at', periodStart)
    .not('assigned_to', 'is', null)

  const byStaff: Record<string, { total: number; converted: number }> = {}
  for (const l of teamStats ?? []) {
    const id = l.assigned_to as string
    if (!byStaff[id]) byStaff[id] = { total: 0, converted: 0 }
    byStaff[id].total++
    if (l.pipeline_stage === 'amefanikiwa') byStaff[id].converted++
  }
  const rates = Object.values(byStaff)
    .filter(s => s.total >= 5)
    .map(s => (s.converted / s.total) * 100)
  const teamAvgRate = rates.length > 0
    ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10
    : 0

  // Grade relative to team
  const diff  = conversionRate - teamAvgRate
  const grade = conversionRate >= 20 ? 'A' : conversionRate >= 12 ? 'B' : conversionRate >= 6 ? 'C' : 'D'

  return NextResponse.json({
    period: days,
    summary: {
      total_assigned:     periodTotal,
      all_time_assigned:  totalAssigned,
      converted:          periodConverted,
      lost:               periodLost,
      contacted:          periodContacted,
      conversion_rate:    conversionRate,
      activity_count:     totalActivityCount,
      avg_daily_activity: avgDailyActivity,
    },
    pipeline: STAGES.map(s => ({
      stage: s,
      label: STAGE_LABELS[s],
      count: pipelineCounts[s],
      pct:   totalAssigned > 0 ? Math.round((pipelineCounts[s] / totalAssigned) * 1000) / 10 : 0,
    })),
    daily_activity: dailyActivity,
    team_avg_rate:  teamAvgRate,
    vs_team:        Math.round(diff * 10) / 10,
    grade,
  })
}
