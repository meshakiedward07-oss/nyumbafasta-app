import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { generateScorecards } from './scorer'

export interface SnapshotRow {
  snapped_at:  string  // YYYY-MM-DD
  owner_role:  string
  department:  string
  score:       number
  overall:     'good' | 'warning' | 'critical'
  open_alerts: number
}

// Saves today's scorecard scores for all departments.
// Safe to call multiple times — upserts on (snapped_at, owner_role).
export async function saveScorecardsSnapshot(): Promise<void> {
  const report  = await generateScorecards()
  const today   = new Date().toISOString().split('T')[0]

  const rows: SnapshotRow[] = report.departments.map(d => ({
    snapped_at:  today,
    owner_role:  d.owner_role,
    department:  d.department,
    score:       d.score,
    overall:     d.overall,
    open_alerts: d.open_alerts,
  }))

  const { error } = await supabaseAdmin
    .from('scorecard_snapshots')
    .upsert(rows, { onConflict: 'snapped_at,owner_role' })

  if (error) throw new Error(`snapshot upsert failed: ${error.message}`)
}

// Returns snapshots for all departments for the last N calendar days,
// newest-first, grouped by owner_role.
export async function getSnapshotHistory(
  days = 30,
): Promise<Record<string, SnapshotRow[]>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('scorecard_snapshots')
    .select('snapped_at, owner_role, department, score, overall, open_alerts')
    .gte('snapped_at', since)
    .order('snapped_at', { ascending: false })

  if (error) throw new Error(error.message)

  const grouped: Record<string, SnapshotRow[]> = {}
  for (const row of data ?? []) {
    ;(grouped[row.owner_role] ??= []).push(row as SnapshotRow)
  }
  return grouped
}
