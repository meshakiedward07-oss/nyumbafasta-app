import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const [campaignsRes, advertisersRes, paymentsRes] = await Promise.all([
    admin.from('ad_campaigns').select(
      'id, title, ad_type, status, impressions, clicks, cta_type, advertiser_id, plan_id, starts_at, expires_at, created_at'
    ),
    admin.from('advertisers').select('id, business_name, status, city, created_at'),
    admin.from('ad_payments').select('amount, status, paid_at, advertiser_id').eq('status', 'completed'),
  ])

  const campaigns   = campaignsRes.data   ?? []
  const advertisers = advertisersRes.data ?? []
  const payments    = paymentsRes.data    ?? []

  // ── Overview KPIs ──────────────────────────────────────────────────────────
  const totalImpressions = campaigns.reduce((s, c) => s + ((c.impressions as number) ?? 0), 0)
  const totalClicks      = campaigns.reduce((s, c) => s + ((c.clicks as number) ?? 0), 0)
  const totalRevenue     = payments.reduce((s, p)  => s + ((p.amount as number) ?? 0), 0)

  const overview = {
    total_advertisers:  advertisers.length,
    active_advertisers: advertisers.filter(a => a.status === 'active').length,
    pending_advertisers: advertisers.filter(a => a.status === 'pending_review').length,
    total_campaigns:    campaigns.length,
    active_campaigns:   campaigns.filter(c => c.status === 'active').length,
    total_impressions:  totalImpressions,
    total_clicks:       totalClicks,
    overall_ctr:        totalImpressions > 0 ? +((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
    total_revenue:      totalRevenue,
  }

  // ── By Ad Type ─────────────────────────────────────────────────────────────
  const typeMap: Record<string, { ad_type: string; campaigns: number; active: number; impressions: number; clicks: number }> = {}
  for (const c of campaigns) {
    const t = c.ad_type as string
    if (!typeMap[t]) typeMap[t] = { ad_type: t, campaigns: 0, active: 0, impressions: 0, clicks: 0 }
    typeMap[t].campaigns++
    if (c.status === 'active') typeMap[t].active++
    typeMap[t].impressions += (c.impressions as number) ?? 0
    typeMap[t].clicks      += (c.clicks as number)      ?? 0
  }
  const by_ad_type = Object.values(typeMap)
    .map(r => ({ ...r, ctr: r.impressions > 0 ? +((r.clicks / r.impressions) * 100).toFixed(2) : 0 }))
    .sort((a, b) => b.impressions - a.impressions)

  // ── Revenue by Month ────────────────────────────────────────────────────────
  const revenueByMonth: Record<string, number> = {}
  for (const p of payments) {
    if (!p.paid_at) continue
    const month = (p.paid_at as string).slice(0, 7)
    revenueByMonth[month] = (revenueByMonth[month] ?? 0) + ((p.amount as number) ?? 0)
  }
  const revenue_by_month = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month, amount }))

  // ── Top Campaigns by Impressions ───────────────────────────────────────────
  const advMap: Record<string, string> = {}
  for (const a of advertisers) advMap[a.id as string] = a.business_name as string

  const top_campaigns = campaigns
    .filter(c => ((c.impressions as number) ?? 0) > 0)
    .sort((a, b) => ((b.impressions as number) ?? 0) - ((a.impressions as number) ?? 0))
    .slice(0, 10)
    .map(c => {
      const impr = (c.impressions as number) ?? 0
      const clks = (c.clicks as number) ?? 0
      return {
        id:         c.id,
        title:      c.title,
        ad_type:    c.ad_type,
        status:     c.status,
        impressions: impr,
        clicks:     clks,
        ctr:        impr > 0 ? +((clks / impr) * 100).toFixed(2) : 0,
        cta_type:   c.cta_type,
        advertiser: advMap[c.advertiser_id as string] ?? 'Unknown',
        expires_at: c.expires_at,
      }
    })

  // ── Subscription plan revenue ──────────────────────────────────────────────
  // Payments joined to campaigns to get plan names
  const campaignPlanMap: Record<string, string> = {}
  for (const c of campaigns) campaignPlanMap[c.id as string] = c.plan_id as string

  const { data: plans } = await admin
    .from('ad_subscription_plans')
    .select('id, name, ad_type, price_tzs, duration_days')

  const planMap: Record<string, { name: string; ad_type: string; price_tzs: number; revenue: number; campaign_count: number }> = {}
  for (const p of plans ?? []) {
    planMap[p.id as string] = { name: p.name as string, ad_type: p.ad_type as string, price_tzs: p.price_tzs as number, revenue: 0, campaign_count: 0 }
  }

  for (const c of campaigns) {
    const pid = c.plan_id as string
    if (planMap[pid]) planMap[pid].campaign_count++
  }

  const by_plan = Object.values(planMap)
    .filter(p => p.campaign_count > 0)
    .sort((a, b) => b.campaign_count - a.campaign_count)

  return NextResponse.json({ overview, by_ad_type, by_plan, top_campaigns, revenue_by_month })
}
