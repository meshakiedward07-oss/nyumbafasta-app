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

  const amount  = Number(unlock.amount_paid)
  const fee     = amount * AZAMPAY_FEE_PERCENT
  const txDate  = new Date(unlock.created_at)

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

  const PLAN_PRICES: Record<string, number> = { basic: 10_000, premium: 25_000, enterprise: 50_000 }
  const amount    = sub.amount_paid != null ? Number(sub.amount_paid) : (PLAN_PRICES[sub.plan] ?? 10_000)
  const fee       = amount * AZAMPAY_FEE_PERCENT
  const txDate    = new Date(sub.created_at)
  const planLabel = sub.plan === 'premium' ? 'Premium' : sub.plan === 'enterprise' ? 'Enterprise' : 'Basic'

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

  const amount  = Number(bp.amount)
  const fee     = amount * AZAMPAY_FEE_PERCENT
  const txDate  = new Date(bp.created_at)

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
// source_ref_id = payment.id (NOT subscription id) so each purchase is unique.
export async function recordIncomeFromExtraListings(params: {
  paymentId:  string   // payments.id — used as source_ref_id for uniqueness
  dalaliId:   string
  count:      number
  amount:     number
  externalId: string
  createdAt?: string   // ISO string from payments.created_at (falls back to now)
  paymentMethod?: string
}): Promise<void> {
  const { paymentId, dalaliId, count, amount, externalId, createdAt, paymentMethod } = params
  const fee    = amount * AZAMPAY_FEE_PERCENT
  const txDate = new Date(createdAt ?? Date.now())

  const { error } = await supabaseAdmin.from('income_records').insert({
    source:           'extra_listing',
    source_ref_id:    paymentId,
    dalali_id:        dalaliId,
    amount_tzs:       amount,
    platform_fee_tzs: parseFloat(fee.toFixed(2)),
    net_amount_tzs:   parseFloat((amount - fee).toFixed(2)),
    description:      `Listings za ziada — ${count} listings (TZS ${amount.toLocaleString()})`,
    reference_number: externalId,
    payment_method:   paymentMethod ?? null,
    transaction_date: txDate.toISOString().split('T')[0],
    month:            txDate.getMonth() + 1,
    year:             txDate.getFullYear(),
    week:             getWeekNumber(txDate),
    status:           'confirmed',
  })

  if (error && error.code !== '23505') {
    console.error('[Accounting] recordIncomeFromExtraListings error:', error.message)
  } else {
    console.log('[Accounting] Income recorded — extra listings paymentId:', paymentId, 'TZS', amount)
  }
}

// ── Record income from an ad campaign payment ─────────────────────────────
export async function recordIncomeFromAdCampaign(adPaymentId: string): Promise<void> {
  const { data: payment } = await supabaseAdmin
    .from('ad_payments')
    .select('id, campaign_id, advertiser_id, amount, provider, gateway_reference, paid_at, created_at, status')
    .eq('id', adPaymentId)
    .eq('status', 'completed')
    .single()

  if (!payment) {
    console.log('[Accounting] Ad payment not found or not completed:', adPaymentId)
    return
  }

  const [campaignRes, advertiserRes] = await Promise.all([
    supabaseAdmin
      .from('ad_campaigns')
      .select('ad_type, title, plan:plan_id (name)')
      .eq('id', payment.campaign_id)
      .single(),
    supabaseAdmin
      .from('advertisers')
      .select('business_name')
      .eq('id', payment.advertiser_id)
      .single(),
  ])

  const campaign   = campaignRes.data
  const advertiser = advertiserRes.data
  const amount     = Number(payment.amount)
  const fee        = amount * AZAMPAY_FEE_PERCENT
  const txDate     = new Date(payment.paid_at ?? payment.created_at)
  const planName   = (campaign?.plan as unknown as { name: string } | null)?.name ?? campaign?.ad_type ?? 'Ad'
  const desc       = `Tangazo — ${advertiser?.business_name ?? '—'} — ${planName} (${campaign?.ad_type ?? ''})`

  const { error } = await supabaseAdmin.from('income_records').insert({
    source:           'ad_campaign',
    source_ref_id:    payment.id,
    amount_tzs:       amount,
    platform_fee_tzs: parseFloat(fee.toFixed(2)),
    net_amount_tzs:   parseFloat((amount - fee).toFixed(2)),
    description:      desc,
    reference_number: payment.gateway_reference ?? payment.id,
    payment_method:   payment.provider ?? null,
    transaction_date: txDate.toISOString().split('T')[0],
    month:            txDate.getMonth() + 1,
    year:             txDate.getFullYear(),
    week:             getWeekNumber(txDate),
    status:           'confirmed',
  })

  if (error && error.code !== '23505') {
    console.error('[Accounting] recordIncomeFromAdCampaign error:', error.message)
  } else {
    console.log('[Accounting] Income recorded — ad payment:', adPaymentId, 'TZS', amount)
  }
}

// ── Sync all completed payments to income_records ─────────────────────────
// Uses a bulk set-membership check instead of N individual SELECTs — O(n+4) queries.
export async function syncAllPaymentsToIncome(): Promise<{ synced: number; skipped: number }> {
  let synced = 0
  let skipped = 0

  // Load all existing (source, source_ref_id) pairs in one query
  const { data: existingRaw } = await supabaseAdmin
    .from('income_records')
    .select('source, source_ref_id')

  const existing = new Set(
    (existingRaw ?? []).map(r => `${r.source}:${r.source_ref_id}`)
  )

  // ── 1. Contact unlocks ──────────────────────────────────────────────────
  const { data: unlocks } = await supabaseAdmin
    .from('contact_unlocks')
    .select('id')
    .eq('status', 'completed')

  for (const u of unlocks ?? []) {
    if (existing.has(`contact_unlock:${u.id}`)) { skipped++; continue }
    await recordIncomeFromUnlock(u.id)
    synced++
  }

  // ── 2. Subscriptions ───────────────────────────────────────────────────
  const { data: subs } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('status', 'active')

  for (const s of subs ?? []) {
    if (existing.has(`subscription:${s.id}`)) { skipped++; continue }
    await recordIncomeFromSubscription(s.id)
    synced++
  }

  // ── 3. Boost payments ──────────────────────────────────────────────────
  const { data: boosts } = await supabaseAdmin
    .from('boost_payments')
    .select('id')
    .eq('status', 'completed')

  for (const bp of boosts ?? []) {
    if (existing.has(`boost_listing:${bp.id}`)) { skipped++; continue }
    await recordIncomeFromBoost(bp.id)
    synced++
  }

  // ── 4. Extra listings (payments table) ────────────────────────────────
  const { data: extraPays } = await supabaseAdmin
    .from('payments')
    .select('id, dalali_id, amount, external_id, created_at, provider')
    .eq('type', 'extra_listings')
    .eq('status', 'completed')

  for (const ep of extraPays ?? []) {
    if (existing.has(`extra_listing:${ep.id}`)) { skipped++; continue }
    // Decode count from externalId format: EX-{sub_id}-{count}
    const parts = (ep.external_id ?? '').split('-')
    const count = parseInt(parts[parts.length - 1], 10)
    await recordIncomeFromExtraListings({
      paymentId:     ep.id,
      dalaliId:      ep.dalali_id,
      count:         isNaN(count) ? 1 : count,
      amount:        Number(ep.amount),
      externalId:    ep.external_id ?? ep.id,
      createdAt:     ep.created_at,
      paymentMethod: ep.provider ?? undefined,
    })
    synced++
  }

  // ── 5. Ad campaign payments ────────────────────────────────────────────
  const { data: adPays } = await supabaseAdmin
    .from('ad_payments')
    .select('id')
    .eq('status', 'completed')

  for (const ap of adPays ?? []) {
    if (existing.has(`ad_campaign:${ap.id}`)) { skipped++; continue }
    await recordIncomeFromAdCampaign(ap.id)
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
