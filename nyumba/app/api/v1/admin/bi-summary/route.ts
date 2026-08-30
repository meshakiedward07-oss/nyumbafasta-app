import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { cache, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const CACHE_KEY = 'admin:bi-summary'
    const hit = cache.get(CACHE_KEY)
    if (hit) return NextResponse.json(hit)

    const admin = createAdminClient()
    const now   = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartIso  = monthStart.toISOString()
    const monthStartDate = monthStart.toISOString().slice(0, 10)
    const monthEndDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

    const [
      // Platform – user counts
      totalUsersRes,
      clientsRes,
      dalaliRes,
      newUsersRes,
      // Platform – listings counts
      activeListingsRes,
      pendingListingsRes,

      // Income this month
      incomeRes,

      // Ads
      campaignsRes,
      advertisersRes,
      adPaymentsRes,

      // Property
      activeLeasesRes,
      paymentsRes,
      maintenanceRes,

      // Brokerage
      brokerageRes,
      closedMonthRes,
      pendingCommRes,

      // Vendors
      vendorsRes,

      // Alerts – recent items to display (capped preview, NOT used for counts below)
      alertsRes,
      // Alerts – exact counts, independent of the capped preview above so
      // they stay correct once open+acknowledged alerts exceed the preview
      // cap (the same "capped array used as a total" bug already found and
      // fixed once in lib/admin/getData.ts on 2026-08-27 — same fix here).
      alertsOpenCountRes,
      alertsAckCountRes,
      alertsCriticalCountRes,
      alertsWarningCountRes,
      alertsInfoCountRes,
    ] = await Promise.all([
      // Users (count queries — efficient at scale)
      admin.from('users').select('*', { count: 'exact', head: true }).neq('role', 'admin').neq('role', 'staff'),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'dalali'),
      admin.from('users').select('*', { count: 'exact', head: true })
        .neq('role', 'admin').neq('role', 'staff').gte('created_at', monthStartIso),

      // Listings (count queries)
      admin.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),

      // Income records this month
      admin.from('income_records')
        .select('amount_tzs, source')
        .gte('transaction_date', monthStartDate)
        .eq('status', 'confirmed'),

      // Ads
      admin.from('ad_campaigns').select('status, impressions, clicks'),
      admin.from('advertisers').select('status'),
      admin.from('ad_payments').select('amount').eq('status', 'completed'),

      // Property
      admin.from('leases').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('lease_payments')
        .select('amount_due, amount_paid, status')
        .gte('due_date', monthStartDate)
        .lte('due_date', monthEndDate),
      admin.from('maintenance_requests').select('status, priority'),

      // Brokerage
      admin.from('brokerage_requests')
        .select('status, commission_status, commission_amount')
        .neq('status', 'cancelled'),
      admin.from('brokerage_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'deal_closed')
        .gte('deal_closed_at', monthStartIso),
      admin.from('brokerage_requests')
        .select('commission_amount')
        .eq('commission_status', 'pending')
        .neq('status', 'cancelled'),

      // Vendors
      admin.from('vendors').select('verification_status'),

      // Alerts
      admin.from('alert_events')
        .select('severity, status, metric, display_name, current_value, threshold_value, created_at')
        .in('status', ['open', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(20),
      admin.from('alert_events').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      admin.from('alert_events').select('*', { count: 'exact', head: true }).eq('status', 'acknowledged'),
      admin.from('alert_events').select('*', { count: 'exact', head: true }).in('status', ['open', 'acknowledged']).eq('severity', 'critical'),
      admin.from('alert_events').select('*', { count: 'exact', head: true }).in('status', ['open', 'acknowledged']).eq('severity', 'warning'),
      admin.from('alert_events').select('*', { count: 'exact', head: true }).in('status', ['open', 'acknowledged']).eq('severity', 'info'),
    ])

    // ── Platform stats ─────────────────────────────────────────────────────────
    const total_users    = totalUsersRes.count  ?? 0
    const total_clients  = clientsRes.count     ?? 0
    const total_dalali   = dalaliRes.count      ?? 0
    const new_users_month = newUsersRes.count   ?? 0
    const active_listings  = activeListingsRes.count  ?? 0
    const pending_listings = pendingListingsRes.count ?? 0

    // ── Income this month ──────────────────────────────────────────────────────
    const income = incomeRes.data ?? []
    const revenue_this_month   = income.reduce((s, r) => s + Number(r.amount_tzs ?? 0), 0)
    const subscription_revenue = income.filter(r => r.source === 'subscription').reduce((s, r) => s + Number(r.amount_tzs ?? 0), 0)
    const unlock_revenue       = income.filter(r => r.source === 'unlock').reduce((s, r) => s + Number(r.amount_tzs ?? 0), 0)
    const boost_revenue        = income.filter(r => r.source === 'boost').reduce((s, r) => s + Number(r.amount_tzs ?? 0), 0)

    // ── Ads system ────────────────────────────────────────────────────────────
    const campaigns   = campaignsRes.data   ?? []
    const advertisers = advertisersRes.data ?? []
    const adPayments  = adPaymentsRes.data  ?? []

    const ads_active_campaigns    = campaigns.filter(c => c.status === 'active').length
    const ads_total_campaigns     = campaigns.length
    const ads_total_impressions   = campaigns.reduce((s, c) => s + Number((c as { impressions?: unknown }).impressions ?? 0), 0)
    const ads_total_clicks        = campaigns.reduce((s, c) => s + Number((c as { clicks?: unknown }).clicks ?? 0), 0)
    const ads_ctr                 = ads_total_impressions > 0 ? +((ads_total_clicks / ads_total_impressions) * 100).toFixed(2) : 0
    const ads_total_advertisers   = advertisers.length
    const ads_active_advertisers  = advertisers.filter(a => a.status === 'active').length
    const ads_pending_advertisers = advertisers.filter(a => a.status === 'pending_review').length
    const ads_total_revenue       = adPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0)

    // ── Property management ───────────────────────────────────────────────────
    const payments    = paymentsRes.data   ?? []
    const maintenance = maintenanceRes.data ?? []

    const active_leases      = activeLeasesRes.count ?? 0
    const total_due_month    = payments.reduce((s, p) => s + Number(p.amount_due ?? 0), 0)
    const total_paid_month   = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount_paid ?? 0), 0)
    const rent_collection_rate = total_due_month > 0 ? Math.round((total_paid_month / total_due_month) * 1000) / 10 : 0
    const overdue_count      = payments.filter(p => p.status === 'late' || p.status === 'partial').length
    const open_maintenance   = maintenance.filter(m => m.status === 'open' || m.status === 'in_progress').length
    const urgent_maintenance = maintenance.filter(m => (m.priority === 'urgent' || m.priority === 'high') && (m.status === 'open' || m.status === 'in_progress')).length

    // ── Brokerage ──────────────────────────────────────────────────────────────
    const brokerageRows = brokerageRes.data ?? []
    const brokerage_total_pipeline = brokerageRows.length
    const brokerage_deals_month    = closedMonthRes.count ?? 0
    const brokerage_pending_comm   = (pendingCommRes.data ?? []).reduce((s, r) => s + Number(r.commission_amount ?? 0), 0)
    const brokerage_pipeline_by_status = {
      pending:    brokerageRows.filter(r => r.status === 'pending').length,
      approved:   brokerageRows.filter(r => r.status === 'approved').length,
      listed:     brokerageRows.filter(r => r.status === 'listed').length,
      deal_closed:brokerageRows.filter(r => r.status === 'deal_closed').length,
    }

    // ── Vendors / Mafundi ─────────────────────────────────────────────────────
    const vendors = vendorsRes.data ?? []
    const vendors_total   = vendors.length
    const vendors_verified = vendors.filter(v => v.verification_status === 'verified').length
    const vendors_pending  = vendors.filter(v => v.verification_status === 'pending').length
    const vendors_rejected = vendors.filter(v => v.verification_status === 'rejected').length

    // ── Alerts ────────────────────────────────────────────────────────────────
    const alertRows = alertsRes.data ?? []
    const alerts_open_items = alertRows.filter(a => a.status === 'open')

    const result = {
      generated_at: now.toISOString(),
      platform: {
        total_users,
        total_clients,
        total_dalali,
        new_users_month,
        active_listings,
        pending_listings,
      },
      income: {
        revenue_this_month,
        subscription_revenue,
        unlock_revenue,
        boost_revenue,
      },
      ads: {
        total_advertisers:   ads_total_advertisers,
        active_advertisers:  ads_active_advertisers,
        pending_advertisers: ads_pending_advertisers,
        total_campaigns:     ads_total_campaigns,
        active_campaigns:    ads_active_campaigns,
        total_impressions:   ads_total_impressions,
        total_clicks:        ads_total_clicks,
        ctr:                 ads_ctr,
        total_revenue:       ads_total_revenue,
      },
      property: {
        active_leases,
        total_due_month,
        total_paid_month,
        rent_collection_rate,
        overdue_count,
        open_maintenance,
        urgent_maintenance,
      },
      brokerage: {
        total_pipeline:          brokerage_total_pipeline,
        deals_closed_this_month: brokerage_deals_month,
        pending_commissions:     brokerage_pending_comm,
        pipeline_by_status:      brokerage_pipeline_by_status,
      },
      vendors: {
        total:    vendors_total,
        verified: vendors_verified,
        pending:  vendors_pending,
        rejected: vendors_rejected,
      },
      alerts: {
        total_open:         alertsOpenCountRes.count ?? 0,
        total_acknowledged: alertsAckCountRes.count ?? 0,
        critical: alertsCriticalCountRes.count ?? 0,
        warning:  alertsWarningCountRes.count ?? 0,
        info:     alertsInfoCountRes.count ?? 0,
        items:    alerts_open_items.slice(0, 10),
      },
    }

    cache.set(CACHE_KEY, result, TTL.STATS)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /admin/bi-summary]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
