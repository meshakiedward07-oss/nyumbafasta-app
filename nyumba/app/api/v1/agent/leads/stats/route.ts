import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [total, newToday, contacted, converted, regionalRaw] = await Promise.all([
      supabaseAdmin.from('agent_leads').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('agent_leads').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabaseAdmin.from('agent_leads').select('id', { count: 'exact', head: true }).eq('status', 'contacted'),
      supabaseAdmin.from('agent_leads').select('id', { count: 'exact', head: true }).eq('status', 'converted'),
      supabaseAdmin.from('agent_leads').select('region').not('region', 'is', null),
    ])

    const byRegion: Record<string, number> = {}
    for (const lead of regionalRaw.data || []) {
      const region = lead.region || 'Haijulikani'
      byRegion[region] = (byRegion[region] || 0) + 1
    }

    const by_region = Object.entries(byRegion)
      .sort((a, b) => b[1] - a[1])
      .map(([region, count]) => ({ region, count }))

    return NextResponse.json({
      total: total.count || 0,
      new_today: newToday.count || 0,
      contacted: contacted.count || 0,
      converted: converted.count || 0,
      by_region,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
