import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data: campaigns } = await admin
    .from('ad_campaigns')
    .select(`
      id, title, ad_type, status, impressions, clicks, cta_type,
      starts_at, expires_at, created_at,
      plan:plan_id (name, price_tzs, duration_days)
    `)
    .eq('advertiser_id', auth.advertiser.id)
    .order('created_at', { ascending: false })

  const now = new Date()
  const rows = (campaigns ?? []).map(c => {
    const impr = (c.impressions as number) ?? 0
    const clks = (c.clicks as number)      ?? 0
    const expiresAt = c.expires_at ? new Date(c.expires_at as string) : null
    const daysRemaining = expiresAt && c.status === 'active'
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000))
      : null
    return {
      id:            c.id,
      title:         c.title,
      ad_type:       c.ad_type,
      status:        c.status,
      impressions:   impr,
      clicks:        clks,
      ctr:           impr > 0 ? +((clks / impr) * 100).toFixed(2) : 0,
      cta_type:      c.cta_type,
      starts_at:     c.starts_at,
      expires_at:    c.expires_at,
      days_remaining: daysRemaining,
      plan:          c.plan,
    }
  })

  const totalImpressions = rows.reduce((s, c) => s + c.impressions, 0)
  const totalClicks      = rows.reduce((s, c) => s + c.clicks, 0)

  return NextResponse.json({
    summary: {
      total_campaigns:  rows.length,
      active_campaigns: rows.filter(c => c.status === 'active').length,
      total_impressions: totalImpressions,
      total_clicks:      totalClicks,
      overall_ctr: totalImpressions > 0 ? +((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
    },
    campaigns: rows,
  })
}
