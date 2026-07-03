import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export const maxDuration = 20

// GET /api/v1/profile/analytics
// Returns profile view + click stats for the authenticated dalali.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  // Verify dalali role
  const { data: me } = await supabase.from('users').select('role, username').eq('id', user.id).single()
  if (!me || me.role !== 'dalali') {
    return NextResponse.json({ error: 'Ruhusa ya dalali inahitajika' }, { status: 403 })
  }

  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [todayRes, weekRes, monthRes, totalRes, sourcesRes, clicksRes] = await Promise.all([
    supabaseAdmin.from('profile_views').select('id', { count: 'exact', head: true }).eq('dalali_id', user.id).gte('created_at', todayStart),
    supabaseAdmin.from('profile_views').select('id', { count: 'exact', head: true }).eq('dalali_id', user.id).gte('created_at', weekStart),
    supabaseAdmin.from('profile_views').select('id', { count: 'exact', head: true }).eq('dalali_id', user.id).gte('created_at', monthStart),
    supabaseAdmin.from('profile_views').select('id', { count: 'exact', head: true }).eq('dalali_id', user.id),
    supabaseAdmin.from('profile_views').select('source').eq('dalali_id', user.id).gte('created_at', monthStart),
    supabaseAdmin.from('profile_click_events').select('event_type').eq('dalali_id', user.id).gte('created_at', monthStart),
  ])

  // Aggregate sources
  const sources: Record<string, number> = {}
  for (const v of sourcesRes.data ?? []) {
    sources[v.source] = (sources[v.source] ?? 0) + 1
  }

  // Aggregate clicks by type
  const clicks: Record<string, number> = {}
  for (const c of clicksRes.data ?? []) {
    clicks[c.event_type] = (clicks[c.event_type] ?? 0) + 1
  }

  return NextResponse.json({
    username:    me.username ?? null,
    viewsToday:  todayRes.count  ?? 0,
    viewsWeek:   weekRes.count   ?? 0,
    viewsMonth:  monthRes.count  ?? 0,
    viewsTotal:  totalRes.count  ?? 0,
    sources,
    clicks,
    whatsappClicks: clicks['whatsapp_click'] ?? 0,
    shareCount:     clicks['share_click']    ?? 0,
  })
}
