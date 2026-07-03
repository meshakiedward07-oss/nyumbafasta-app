import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 20

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const dalaliId = params.id
  const db = createAdminClient()

  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    userRes,
    todayRes,
    weekRes,
    monthRes,
    totalRes,
    sourcesRes,
    clicksRes,
    listingsRes,
  ] = await Promise.all([
    db.from('users')
      .select('id, full_name, username, is_active, profile_whatsapp_clicks, profile_share_count')
      .eq('id', dalaliId)
      .single(),
    db.from('profile_views').select('id', { count: 'exact', head: true }).eq('dalali_id', dalaliId).gte('created_at', todayStart),
    db.from('profile_views').select('id', { count: 'exact', head: true }).eq('dalali_id', dalaliId).gte('created_at', weekStart),
    db.from('profile_views').select('id', { count: 'exact', head: true }).eq('dalali_id', dalaliId).gte('created_at', monthStart),
    db.from('profile_views').select('id', { count: 'exact', head: true }).eq('dalali_id', dalaliId),
    db.from('profile_views').select('source').eq('dalali_id', dalaliId).gte('created_at', monthStart),
    db.from('profile_click_events').select('event_type').eq('dalali_id', dalaliId).gte('created_at', monthStart),
    db.from('listings').select('id, is_boosted', { count: 'exact' }).eq('dalali_id', dalaliId).eq('status', 'active'),
  ])

  const sources: Record<string, number> = {}
  for (const v of sourcesRes.data ?? []) {
    sources[v.source] = (sources[v.source] ?? 0) + 1
  }

  const clicks: Record<string, number> = {}
  for (const c of clicksRes.data ?? []) {
    clicks[c.event_type] = (clicks[c.event_type] ?? 0) + 1
  }

  const user = userRes.data
  const boosted = (listingsRes.data ?? []).filter(l => l.is_boosted).length

  return NextResponse.json({
    dalali: {
      id:         user?.id,
      name:       user?.full_name,
      username:   user?.username ?? null,
      isActive:   user?.is_active ?? true,
      profileUrl: user?.username ? `https://nyumbafasta.co/agent/${user.username}` : null,
    },
    analytics: {
      viewsToday:      todayRes.count  ?? 0,
      viewsWeek:       weekRes.count   ?? 0,
      viewsMonth:      monthRes.count  ?? 0,
      viewsTotal:      totalRes.count  ?? 0,
      whatsappClicks:  user?.profile_whatsapp_clicks ?? 0,
      shareCount:      user?.profile_share_count     ?? 0,
      sources,
      clicks,
    },
    listings: {
      total:   listingsRes.count ?? 0,
      boosted,
    },
  })
}
