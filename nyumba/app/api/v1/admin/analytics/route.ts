import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await createAdminClient()
    .from('users').select('role').eq('id', user.id).single()
  if (!me || !['admin', 'staff'].includes(me.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const now   = new Date()
  const thisMonth  = now.getMonth() + 1
  const thisYear   = now.getFullYear()
  const lastMonth  = thisMonth === 1 ? 12 : thisMonth - 1
  const lastYear   = thisMonth === 1 ? thisYear - 1 : thisYear

  // ── Helper: month label ───────────────────────────────────────
  const monthLabel = (y: number, m: number) =>
    new Date(y, m - 1, 1).toLocaleDateString('sw-TZ', { month: 'short', year: '2-digit' })

  // ── 1. Last 12 months income from income_records ──────────────
  const twelveMonthsAgo = new Date(now)
  twelveMonthsAgo.setMonth(now.getMonth() - 11)
  const startDate = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

  const { data: incomeRows } = await admin
    .from('income_records')
    .select('amount_tzs, platform_fee_tzs, net_amount_tzs, source, month, year, transaction_date')
    .gte('transaction_date', startDate)
    .eq('status', 'confirmed')

  // Build monthly revenue series
  const monthMap: Record<string, { label: string; income: number; net: number; fees: number; subscription: number; unlock: number; boost: number; extra: number }> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    monthMap[key] = { label: monthLabel(d.getFullYear(), d.getMonth() + 1), income: 0, net: 0, fees: 0, subscription: 0, unlock: 0, boost: 0, extra: 0 }
  }
  for (const row of incomeRows ?? []) {
    const key = `${row.year}-${row.month}`
    if (!monthMap[key]) continue
    const amt = Number(row.amount_tzs)
    monthMap[key].income += amt
    monthMap[key].net    += Number(row.net_amount_tzs ?? amt)
    monthMap[key].fees   += Number(row.platform_fee_tzs ?? 0)
    if (row.source === 'subscription')    monthMap[key].subscription += amt
    if (row.source === 'contact_unlock')  monthMap[key].unlock       += amt
    if (row.source === 'boost_listing')   monthMap[key].boost        += amt
    if (row.source === 'extra_listing')   monthMap[key].extra        += amt
  }
  const revenueByMonth = Object.values(monthMap)

  // ── 2. This month vs last month ───────────────────────────────
  const thisKey = `${thisYear}-${thisMonth}`
  const lastKey = `${lastYear}-${lastMonth}`
  const thisMonthIncome = monthMap[thisKey]?.income ?? 0
  const lastMonthIncome = monthMap[lastKey]?.income ?? 0
  const growth = lastMonthIncome > 0
    ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome * 100)
    : thisMonthIncome > 0 ? 100 : 0

  // ── 3. Revenue breakdown totals (all time) ────────────────────
  const totals = (incomeRows ?? []).reduce((acc, r) => {
    acc.total += Number(r.amount_tzs)
    acc[r.source as keyof typeof acc] = ((acc[r.source as keyof typeof acc] as number) ?? 0) + Number(r.amount_tzs)
    return acc
  }, { total: 0, subscription: 0, contact_unlock: 0, boost_listing: 0, extra_listing: 0 } as Record<string, number>)

  // ── 4. Subscription metrics ───────────────────────────────────
  const { data: allSubs } = await admin
    .from('subscriptions')
    .select('id, plan, status, created_at, expires_at, dalali_id')
    .neq('plan', 'free')

  const activeSubs      = (allSubs ?? []).filter(s => s.status === 'active')
  const basicActive     = activeSubs.filter(s => s.plan === 'basic').length
  const premiumActive   = activeSubs.filter(s => s.plan === 'premium').length
  const enterpriseActive= activeSubs.filter(s => s.plan === 'enterprise').length

  // New subs this month
  const newThisMonth = (allSubs ?? []).filter(s => {
    const d = new Date(s.created_at)
    return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear
  }).length

  // Expired/cancelled this month (churn)
  const churnedThisMonth = (allSubs ?? []).filter(s => {
    if (!['expired', 'cancelled', 'failed'].includes(s.status)) return false
    const d = new Date(s.expires_at ?? s.created_at)
    return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear
  }).length

  // Retention: active subs that renewed (have > 1 sub for same dalali)
  const dalaliSubCounts: Record<string, number> = {}
  for (const s of allSubs ?? []) dalaliSubCounts[s.dalali_id] = (dalaliSubCounts[s.dalali_id] ?? 0) + 1
  const returnSubscribers = Object.values(dalaliSubCounts).filter(c => c > 1).length
  const totalUniqueSubscribers = Object.keys(dalaliSubCounts).length
  const retentionRate = totalUniqueSubscribers > 0
    ? Math.round((returnSubscribers / totalUniqueSubscribers) * 100)
    : 0

  // MRR
  const PLAN_PRICES: Record<string, number> = { basic: 10000, premium: 25000, enterprise: 50000 }
  const mrr = activeSubs.reduce((sum, s) => sum + (PLAN_PRICES[s.plan] ?? 0), 0)

  // Expiring soon (next 7 days)
  const soon = new Date(); soon.setDate(soon.getDate() + 7)
  const expiringSoon = activeSubs.filter(s => {
    if (!s.expires_at) return false
    const exp = new Date(s.expires_at)
    return exp >= now && exp <= soon
  }).length

  // ── 5. Unlock metrics ─────────────────────────────────────────
  const { data: unlocks } = await admin
    .from('contact_unlocks')
    .select('id, listing_id, created_at, status')
    .eq('status', 'completed')

  const unlocksThisMonth = (unlocks ?? []).filter(u => {
    const d = new Date(u.created_at)
    return d.getMonth() + 1 === thisMonth && d.getFullYear() === thisYear
  }).length

  const unlocksLastMonth = (unlocks ?? []).filter(u => {
    const d = new Date(u.created_at)
    return d.getMonth() + 1 === lastMonth && d.getFullYear() === lastYear
  }).length

  // Top listings by unlocks
  const listingUnlockMap: Record<string, number> = {}
  for (const u of unlocks ?? []) {
    if (u.listing_id) listingUnlockMap[u.listing_id] = (listingUnlockMap[u.listing_id] ?? 0) + 1
  }
  const topListingIds = Object.entries(listingUnlockMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0])

  let topListings: { id: string; type: string; district: string; region: string; count: number }[] = []
  if (topListingIds.length > 0) {
    const { data: listingData } = await admin
      .from('listings')
      .select('id, type, district, region')
      .in('id', topListingIds)
    topListings = (listingData ?? []).map(l => ({
      id: l.id, type: l.type, district: l.district, region: l.region,
      count: listingUnlockMap[l.id] ?? 0,
    })).sort((a, b) => b.count - a.count)
  }

  // ── 6. District performance (revenue per region from unlocks) ──
  const { data: unlocksFull } = await admin
    .from('contact_unlocks')
    .select('listing_id, amount_paid, status, listings(district, region)')
    .eq('status', 'completed')
    .limit(500)

  const regionMap: Record<string, { revenue: number; count: number }> = {}
  for (const u of unlocksFull ?? []) {
    const listing = u.listings as { district?: string; region?: string } | null
    const region = listing?.region ?? listing?.district ?? 'Nyingine'
    if (!regionMap[region]) regionMap[region] = { revenue: 0, count: 0 }
    regionMap[region].revenue += Number(u.amount_paid ?? 0)
    regionMap[region].count++
  }
  const topRegions = Object.entries(regionMap)
    .map(([region, d]) => ({ region, ...d }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  // ── 7. Expenses this month ─────────────────────────────────────
  const { data: expensesData } = await admin
    .from('expense_records')
    .select('amount_tzs, category')
    .eq('month', thisMonth)
    .eq('year', thisYear)

  const { data: recurringData } = await admin
    .from('recurring_expenses')
    .select('amount_tzs, category')
    .eq('is_active', true)

  const expensesThisMonth = (expensesData ?? []).reduce((s, e) => s + Number(e.amount_tzs), 0)
  const recurringTotal    = (recurringData ?? []).reduce((s, e) => s + Number(e.amount_tzs), 0)
  const totalExpenses     = expensesThisMonth + recurringTotal
  const profitThisMonth   = thisMonthIncome - totalExpenses

  return NextResponse.json({
    revenueByMonth,
    totals,
    growth: Math.round(growth * 10) / 10,
    thisMonthIncome,
    lastMonthIncome,
    mrr,
    subscriptions: {
      active: activeSubs.length,
      basic:  basicActive,
      premium: premiumActive,
      enterprise: enterpriseActive,
      newThisMonth,
      churnedThisMonth,
      retentionRate,
      expiringSoon,
      totalUnique: totalUniqueSubscribers,
    },
    unlocks: {
      total: (unlocks ?? []).length,
      thisMonth: unlocksThisMonth,
      lastMonth: unlocksLastMonth,
      topListings,
    },
    topRegions,
    expenses: {
      thisMonth: totalExpenses,
      recurring: recurringTotal,
      profit:    profitThisMonth,
    },
  })
}
