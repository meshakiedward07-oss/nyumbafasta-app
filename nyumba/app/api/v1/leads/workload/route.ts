import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireStaffAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

type WorkloadRow = {
  staff_id: string
  full_name: string
  total: number
  new_count: number
  contacted: number
  interested: number
  registered: number
  high_quality: number
}

// GET /api/v1/leads/workload — admin-only staff workload view
export async function GET() {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  try {
    // Fetch all non-dup, non-dead assigned leads with status and quality
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('assigned_to, status, contact_quality, assigned_user:assigned_to(full_name)')
      .not('assigned_to', 'is', null)
      .eq('is_duplicate', false)
      .eq('is_dead_lead', false)

    if (error) throw error

    // Aggregate in JS
    const map = new Map<string, WorkloadRow>()

    for (const row of data ?? []) {
      const sid = row.assigned_to as string
      if (!sid) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const name = (row.assigned_user as any)?.full_name ?? sid

      if (!map.has(sid)) {
        map.set(sid, {
          staff_id: sid,
          full_name: name,
          total: 0,
          new_count: 0,
          contacted: 0,
          interested: 0,
          registered: 0,
          high_quality: 0,
        })
      }
      const entry = map.get(sid)!
      entry.total++
      if (row.status === 'new')        entry.new_count++
      if (row.status === 'contacted')  entry.contacted++
      if (row.status === 'interested') entry.interested++
      if (row.status === 'registered') entry.registered++
      if (row.contact_quality === 'high') entry.high_quality++
    }

    const workload = [...map.values()].sort((a, b) => b.total - a.total)

    return NextResponse.json({ workload })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
