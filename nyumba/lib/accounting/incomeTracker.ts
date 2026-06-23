import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// AzamPay fee (~1% of transaction amount)
const AZAMPAY_FEE_PERCENT = 0.01

// ── Week number helper ────────────────────────────────────────────────────
function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

// ── Record income from a contact_unlock ───────────────────────────────────
export async function recordIncomeFromUnlock(unlockId: string): Promise<void> {
  const { data: unlock } = await supabaseAdmin
    .from('contact_unlocks')
    .select('id, amount_paid, created_at, listing_id, dalali_id, payment_method, payment_ref, status')
    .eq('id', unlockId)
    .eq('status', 'completed')
    .single()

  if (!unlock) {
    console.log('[Accounting] Unlock not found or not completed:', unlockId)
    return
  }

  const amount     = Number(unlock.amount_paid)
  const fee        = amount * AZAMPAY_FEE_PERCENT
  const txDate     = new Date(unlock.created_at)

  const { error } = await supabaseAdmin.from('income_records').insert({
    source:           'contact_unlock',
    source_ref_id:    unlock.id,
    dalali_id:        unlock.dalali_id,
    listing_id:       unlock.listing_id,
    amount_tzs:       amount,
    platform_fee_tzs: parseFloat(fee.toFixed(2)),
    net_amount_tzs:   parseFloat((amount - fee).toFixed(2)),
    description:      'Contact unlock fee — TZS 2,000',
    reference_number: unlock.payment_ref,
    payment_method:   unlock.payment_method,
    transaction_date: txDate.toISOString().split('T')[0],
    month:            txDate.getMonth() + 1,
    year:             txDate.getFullYear(),
    week:             getWeekNumber(txDate),
    status:           'confirmed',
  })

  if (error && error.code !== '23505') {
    // 23505 = unique_violation (already recorded) — ignore
    console.error('[Accounting] recordIncomeFromUnlock error:', error.message)
  } else {
    console.log('[Accounting] Income recorded — unlock:', unlockId, 'TZS', amount)
  }
}

// ── Record income from a subscription ─────────────────────────────────────
export async function recordIncomeFromSubscription(subscriptionId: string): Promise<void> {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id, amount_paid, plan, dalali_id, payment_method, payment_ref, created_at, status')
    .eq('id', subscriptionId)
    .eq('status', 'active')
    .single()

  if (!sub) {
    console.log('[Accounting] Subscription not found or not active:', subscriptionId)
    return
  }

  // Fallback: derive amount from plan if amount_paid is null
  const PLAN_PRICES: Record<string, number> = { basic: 10_000, premium: 25_000, enterprise: 50_000 }
  const amount     = Number(sub.amount_paid) || PLAN_PRICES[sub.plan] || 10_000
  const fee        = amount * AZAMPAY_FEE_PERCENT
  const txDate     = new Date(sub.created_at)
  const planLabel  = sub.plan === 'premium' ? 'Premium' : sub.plan === 'enterprise' ? 'Enterprise' : 'Basic'

  const { error } = await supabaseAdmin.from('income_records').insert({
    source:           'subscription',
    source_ref_id:    sub.id,
    dalali_id:        sub.dalali_id,
    amount_tzs:       amount,
    platform_fee_tzs: parseFloat(fee.toFixed(2)),
    net_amount_tzs:   parseFloat((amount - fee).toFixed(2)),
    description:      `Subscription ya dalali — Plan ${planLabel}`,
    reference_number: sub.payment_ref,
    payment_method:   sub.payment_method,
    transaction_date: txDate.toISOString().split('T')[0],
    month:            txDate.getMonth() + 1,
    year:             txDate.getFullYear(),
    week:             getWeekNumber(txDate),
    status:           'confirmed',
  })

  if (error && error.code !== '23505') {
    console.error('[Accounting] recordIncomeFromSubscription error:', error.message)
  } else {
    console.log('[Accounting] Income recorded — sub:', subscriptionId, 'TZS', amount)
  }
}

// ── Record income from a boost payment ────────────────────────────────────
export async function recordIncomeFromBoost(boostPaymentId: string): Promise<void> {
  const { data: bp } = await supabaseAdmin
    .from('boost_payments')
    .select('id, amount, listing_id, dalali_id, payment_method, payment_ref, weeks, created_at, status')
    .eq('id', boostPaymentId)
    .eq('status', 'completed')
    .single()

  if (!bp) {
    console.log('[Accounting] Boost payment not found or not completed:', boostPaymentId)
    return
  }

  const amount     = Number(bp.amount)
  const fee        = amount * AZAMPAY_FEE_PERCENT
  const txDate     = new Date(bp.created_at)

  const { error } = await supabaseAdmin.from('income_records').insert({
    source:           'boost_listing',
    source_ref_id:    bp.id,
    dalali_id:        bp.dalali_id,
    listing_id:       bp.listing_id,
    amount_tzs:       amount,
    platform_fee_tzs: parseFloat(fee.toFixed(2)),
    net_amount_tzs:   parseFloat((amount - fee).toFixed(2)),
    description:      `Boost listing fee — wiki ${bp.weeks}`,
    reference_number: bp.payment_ref,
    payment_method:   bp.payment_method,
    transaction_date: txDate.toISOString().split('T')[0],
    month:            txDate.getMonth() + 1,
    year:             txDate.getFullYear(),
    week:             getWeekNumber(txDate),
    status:           'confirmed',
  })

  if (error && error.code !== '23505') {
    console.error('[Accounting] recordIncomeFromBoost error:', error.message)
  } else {
    console.log('[Accounting] Income recorded — boost:', boostPaymentId, 'TZS', amount)
  }
}

// ── Record income from extra listings purchase ────────────────────────────
export async function recordIncomeFromExtraListings(params: {
  subscriptionId: string
  dalaliId:       string
  count:          number
  amount:         number
  externalId:     string
}): Promise<void> {
  const { subscriptionId, dalaliId, count, amount, externalId } = params
  const fee    = amount * AZAMPAY_FEE_PERCENT
  const txDate = new Date()

  const { error } = await supabaseAdmin.from('income_records').insert({
    source:           'extra_listing',
    source_ref_id:    subscriptionId,
    dalali_id:        dalaliId,
    amount_tzs:       amount,
    platform_fee_tzs: parseFloat(fee.toFixed(2)),
    net_amount_tzs:   parseFloat((amount - fee).toFixed(2)),
    description:      `Listings za ziada — ${count} listings (TZS ${amount.toLocaleString()})`,
    reference_number: externalId,
    transaction_date: txDate.toISOString().split('T')[0],
    month:            txDate.getMonth() + 1,
    year:             txDate.getFullYear(),
    week:             getWeekNumber(txDate),
    status:           'confirmed',
  })

  if (error && error.code !== '23505') {
    console.error('[Accounting] recordIncomeFromExtraListings error:', error.message)
  } else {
    console.log('[Accounting] Income recorded — extra listings sub:', subscriptionId, 'TZS', amount)
  }
}

// ── Sync all completed payments to income_records ─────────────────────────
// Pulls from all 3 source tables and inserts missing records idempotently.
export async function syncAllPaymentsToIncome(): Promise<{ synced: number; skipped: number }> {
  let synced = 0
  let skipped = 0

  // 1. Contact unlocks
  const { data: unlocks } = await supabaseAdmin
    .from('contact_unlocks')
    .select('id')
    .eq('status', 'completed')

  for (const unlock of unlocks ?? []) {
    const { data: existing } = await supabaseAdmin
      .from('income_records')
      .select('id')
      .eq('source', 'contact_unlock')
      .eq('source_ref_id', unlock.id)
      .maybeSingle()

    if (existing) { skipped++; continue }
    await recordIncomeFromUnlock(unlock.id)
    synced++
  }

  // 2. Subscriptions
  const { data: subs } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('status', 'active')

  for (const sub of subs ?? []) {
    const { data: existing } = await supabaseAdmin
      .from('income_records')
      .select('id')
      .eq('source', 'subscription')
      .eq('source_ref_id', sub.id)
      .maybeSingle()

    if (existing) { skipped++; continue }
    await recordIncomeFromSubscription(sub.id)
    synced++
  }

  // 3. Boost payments
  const { data: boosts } = await supabaseAdmin
    .from('boost_payments')
    .select('id')
    .eq('status', 'completed')

  for (const bp of boosts ?? []) {
    const { data: existing } = await supabaseAdmin
      .from('income_records')
      .select('id')
      .eq('source', 'boost_listing')
      .eq('source_ref_id', bp.id)
      .maybeSingle()

    if (existing) { skipped++; continue }
    await recordIncomeFromBoost(bp.id)
    synced++
  }

  console.log(`[Accounting] Sync done — synced: ${synced}, skipped: ${skipped}`)
  return { synced, skipped }
}

// ── Date range helper ─────────────────────────────────────────────────────
export function getDateRange(
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  date: Date,
): { startDate: string; endDate: string } {
  switch (period) {
    case 'daily': {
      const d = date.toISOString().split('T')[0]
      return { startDate: d, endDate: d }
    }
    case 'weekly': {
      const ws = new Date(date)
      ws.setDate(date.getDate() - date.getDay() + 1)
      const we = new Date(ws)
      we.setDate(ws.getDate() + 6)
      return { startDate: ws.toISOString().split('T')[0], endDate: we.toISOString().split('T')[0] }
    }
    case 'monthly': {
      const first = new Date(date.getFullYear(), date.getMonth(), 1)
      const last  = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      return { startDate: first.toISOString().split('T')[0], endDate: last.toISOString().split('T')[0] }
    }
    case 'yearly':
      return {
        startDate: `${date.getFullYear()}-01-01`,
        endDate:   `${date.getFullYear()}-12-31`,
      }
  }
}

// ── Get income summary for a period ──────────────────────────────────────
export async function getIncomeSummary(params: {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  date?: Date
}) {
  const { startDate, endDate } = getDateRange(params.period, params.date ?? new Date())

  const { data } = await supabaseAdmin
    .from('income_records')
    .select('*')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .eq('status', 'confirmed')

  const bySource: Record<string, number> = {}
  const byMethod: Record<string, number> = {}
  let total = 0
  let platformFees = 0

  for (const r of data ?? []) {
    const amt = Number(r.amount_tzs)
    total += amt
    platformFees += Number(r.platform_fee_tzs)
    bySource[r.source] = (bySource[r.source] ?? 0) + amt
    if (r.payment_method) {
      byMethod[r.payment_method] = (byMethod[r.payment_method] ?? 0) + amt
    }
  }

  return {
    total,
    bySource,
    byMethod,
    transactionCount: (data ?? []).length,
    platformFees,
    netIncome: total - platformFees,
    startDate,
    endDate,
    records: data ?? [],
  }
}
