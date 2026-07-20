import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { cache, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

const LEADS_STATS_CACHE_KEY = 'leads:stats:global'

async function computeStats(since: string) {
  function base() {
    let q = supabaseAdmin.from('leads').select('id', { count: 'exact', head: true })
    if (since) q = q.gte('created_at', since)
    return q
  }

  const [
    total, high, medium, low, dead, duplicates,
    hasWa, hasFb, hasIg, hasTt, hasSocial,
    statusNew, statusContacted, statusInterested, statusRegistered, statusInactive, statusRejected,
    assigned,
  ] = await Promise.all([
    base(),
    base().eq('contact_quality', 'high').eq('is_duplicate', false),
    base().eq('contact_quality', 'medium').eq('is_duplicate', false),
    base().eq('contact_quality', 'low').eq('is_duplicate', false),
    base().eq('is_dead_lead', true),
    base().eq('is_duplicate', true),
    base().not('whatsapp_number', 'is', null).eq('is_duplicate', false),
    base().not('facebook_url', 'is', null).eq('is_duplicate', false),
    base().not('instagram_url', 'is', null).eq('is_duplicate', false),
    base().not('tiktok_url', 'is', null).eq('is_duplicate', false),
    base().eq('has_any_social', true).eq('is_duplicate', false),
    base().eq('status', 'new').eq('is_duplicate', false),
    base().eq('status', 'contacted').eq('is_duplicate', false),
    base().eq('status', 'interested').eq('is_duplicate', false),
    base().eq('status', 'registered').eq('is_duplicate', false),
    base().eq('status', 'inactive').eq('is_duplicate', false),
    base().eq('status', 'rejected').eq('is_duplicate', false),
    supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).not('assigned_to', 'is', null).eq('is_duplicate', false),
  ])

  return {
    total:             total.count             ?? 0,
    high:              high.count              ?? 0,
    medium:            medium.count            ?? 0,
    low:               low.count               ?? 0,
    dead:              dead.count              ?? 0,
    duplicates:        duplicates.count        ?? 0,
    has_whatsapp:      hasWa.count             ?? 0,
    has_facebook:      hasFb.count             ?? 0,
    has_instagram:     hasIg.count             ?? 0,
    has_tiktok:        hasTt.count             ?? 0,
    has_any_social:    hasSocial.count         ?? 0,
    status_new:        statusNew.count         ?? 0,
    status_contacted:  statusContacted.count   ?? 0,
    status_interested: statusInterested.count  ?? 0,
    status_registered: statusRegistered.count  ?? 0,
    status_inactive:   statusInactive.count    ?? 0,
    status_rejected:   statusRejected.count    ?? 0,
    assigned:          assigned.count          ?? 0,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const since = new URL(req.url).searchParams.get('since') || ''

  try {
    let stats: Awaited<ReturnType<typeof computeStats>>

    if (since) {
      // Report-specific queries are always fresh (parameterised by date range)
      stats = await computeStats(since)
    } else {
      // Global stats are cached for 5 minutes — avoids 19 COUNT queries per tab switch
      const hit = cache.get<typeof stats>(LEADS_STATS_CACHE_KEY)
      if (hit) {
        stats = hit
      } else {
        stats = await computeStats('')
        cache.set(LEADS_STATS_CACHE_KEY, stats, TTL.ADMIN_STATS)
      }
    }

    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
