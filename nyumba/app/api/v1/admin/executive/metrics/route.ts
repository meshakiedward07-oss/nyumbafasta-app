import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { cache, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const CACHE_KEY = 'admin:executive:metrics'
    const hit = cache.get(CACHE_KEY)
    if (hit) return NextResponse.json(hit)

    const admin = createAdminClient()
    const now   = new Date()

    const todayStr   = now.toISOString().slice(0, 10)
    const yesterday  = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStartStr  = monthStart.toISOString().slice(0, 10)
    const monthStartISO  = monthStart.toISOString()
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [
      todayIncomeRes,
      todayUnlocksRes,
      newRegsRes,
      pendingListingsRes,
      activeDalaliSubsRes,
      trialDalaliSubsRes,
      activeOrgSubsRes,
      totalUsersRes,
      clientsRes,
      dalaliRes,
      activeListingsRes,
      thisMonthIncomeRes,
      fraudHighRes,
      fraudCriticalRes,
      pendingKycRes,
      totalLeadsRes,
      openMaintenanceRes,
      activeLeasesRes,
      rentPaymentsRes,
      brokerageCommRes,
      whatsappOpenRes,
      cascadeMissRes,
    ] = await Promise.all([
      admin.from('income_records').select('amount_tzs').eq('transaction_date', todayStr).eq('status', 'confirmed'),
      admin.from('contact_unlocks').select('amount_paid').gte('created_at', todayStart).eq('status', 'completed'),
      admin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', yesterday),
      admin.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').neq('plan', 'free'),
      admin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'trial'),
      admin.from('organization_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('users').select('*', { count: 'exact', head: true }),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'dalali'),
      admin.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('income_records').select('amount_tzs').gte('transaction_date', monthStartStr).eq('status', 'confirmed'),
      admin.from('fraud_signals').select('*', { count: 'exact', head: true }).in('severity', ['high', 'critical']).eq('is_resolved', false),
      admin.from('fraud_signals').select('*', { count: 'exact', head: true }).eq('severity', 'critical').eq('is_resolved', false),
      admin.from('kyc_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('agent_leads').select('*', { count: 'exact', head: true }),
      admin.from('maintenance_requests').select('*', { count: 'exact', head: true }).in('status', ['open', 'assigned', 'in_progress', 'awaiting_parts']),
      admin.from('leases').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('lease_payments').select('amount_due, amount_paid, status').gte('due_date', monthStartStr).lte('due_date', monthEnd),
      admin.from('brokerage_requests').select('commission_amount').eq('commission_status', 'pending').neq('status', 'cancelled'),
      admin.from('whatsapp_sessions').select('*', { count: 'exact', head: true }).not('status', 'eq', 'resolved'),
      admin.from('cascade_miss_log').select('*', { count: 'exact', head: true }).gte('created_at', monthStartISO),
    ])

    const today_income         = (todayIncomeRes.data ?? []).reduce((s, r) => s + Number(r.amount_tzs ?? 0), 0)
    const today_unlocks_count  = (todayUnlocksRes.data ?? []).length
    const today_unlocks_revenue = (todayUnlocksRes.data ?? []).reduce((s, r) => s + Number(r.amount_paid ?? 0), 0)
    const this_month_income    = (thisMonthIncomeRes.data ?? []).reduce((s, r) => s + Number(r.amount_tzs ?? 0), 0)

    const rentPayments      = rentPaymentsRes.data ?? []
    const total_rent_due    = rentPayments.reduce((s, p) => s + Number(p.amount_due ?? 0), 0)
    const total_rent_paid   = rentPayments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount_paid ?? 0), 0)
    const rent_collection_rate = total_rent_due > 0 ? Math.round((total_rent_paid / total_rent_due) * 1000) / 10 : 0

    const brokerage_pending_commissions = (brokerageCommRes.data ?? [])
      .reduce((s, r) => s + Number(r.commission_amount ?? 0), 0)

    const result = {
      today_income,
      today_unlocks_count,
      today_unlocks_revenue,
      new_registrations_24h:      newRegsRes.count              ?? 0,
      pending_listings:           pendingListingsRes.count       ?? 0,
      active_dalali_subs:         activeDalaliSubsRes.count      ?? 0,
      trial_dalali_subs:          trialDalaliSubsRes.count       ?? 0,
      active_org_subs:            activeOrgSubsRes.count         ?? 0,
      total_users:                totalUsersRes.count            ?? 0,
      total_clients:              clientsRes.count               ?? 0,
      total_dalali:               dalaliRes.count                ?? 0,
      active_listings:            activeListingsRes.count        ?? 0,
      this_month_income,
      unresolved_fraud_high:      fraudHighRes.count             ?? 0,
      unresolved_fraud_critical:  fraudCriticalRes.count         ?? 0,
      pending_kyc:                pendingKycRes.count            ?? 0,
      total_leads:                totalLeadsRes.count            ?? 0,
      open_maintenance_requests:  openMaintenanceRes.count       ?? 0,
      active_leases:              activeLeasesRes.count          ?? 0,
      rent_collection_rate,
      brokerage_pending_commissions,
      whatsapp_open_sessions:     whatsappOpenRes.count          ?? 0,
      cascade_miss_count_month:   cascadeMissRes.count           ?? 0,
    }

    cache.set(CACHE_KEY, result, TTL.FINANCE_STATS)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /admin/executive/metrics]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
