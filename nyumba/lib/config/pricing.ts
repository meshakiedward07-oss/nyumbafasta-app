import { createAdminClient } from '@/lib/supabase/server'

export type Pricing = {
  subscription:  { basic: number; premium: number; enterprise: number }
  unlock:        number
  boost:         { 1: number; 2: number; 4: number }
  extraListing:  number
  listingLimits: { free: number; basic: number; premium: number; enterprise: number }
}

export const PRICING_DEFAULTS: Pricing = {
  subscription:  { basic: 10_000, premium: 25_000, enterprise: 50_000 },
  unlock:        2_000,
  boost:         { 1: 5_000, 2: 9_000, 4: 16_000 },
  extraListing:  2_000,
  listingLimits: { free: 2, basic: 5, premium: 20, enterprise: 50 },
}

// Module-level cache — shared across all requests on the same serverless instance.
// Prevents O(requests) DB hits; degrades gracefully to PRICING_DEFAULTS on error.
let _pricing: Pricing | null = null
let _pricingExpiresAt = 0
const PRICING_TTL_MS = 60 * 60 * 1_000  // 1 hour

export async function getPricing(): Promise<Pricing> {
  const now = Date.now()
  if (_pricing && now < _pricingExpiresAt) return _pricing

  try {
    const admin = createAdminClient()
    const { data } = await admin.from('app_settings').select('key, value')
    if (!data?.length) {
      _pricing = PRICING_DEFAULTS
      _pricingExpiresAt = now + PRICING_TTL_MS
      return _pricing
    }

    const m: Record<string, number> = {}
    for (const row of data) m[row.key] = parseInt(row.value, 10)

    _pricing = {
      subscription: {
        basic:      m['subscription_basic_price']      ?? PRICING_DEFAULTS.subscription.basic,
        premium:    m['subscription_premium_price']    ?? PRICING_DEFAULTS.subscription.premium,
        enterprise: m['subscription_enterprise_price'] ?? PRICING_DEFAULTS.subscription.enterprise,
      },
      unlock:       m['unlock_price']        ?? PRICING_DEFAULTS.unlock,
      boost: {
        1:          m['boost_1week_price']   ?? PRICING_DEFAULTS.boost[1],
        2:          m['boost_2week_price']   ?? PRICING_DEFAULTS.boost[2],
        4:          m['boost_4week_price']   ?? PRICING_DEFAULTS.boost[4],
      },
      extraListing: m['extra_listing_price'] ?? PRICING_DEFAULTS.extraListing,
      listingLimits: {
        free:       m['listing_limit_free']       ?? PRICING_DEFAULTS.listingLimits.free,
        basic:      m['listing_limit_basic']      ?? PRICING_DEFAULTS.listingLimits.basic,
        premium:    m['listing_limit_premium']    ?? PRICING_DEFAULTS.listingLimits.premium,
        enterprise: m['listing_limit_enterprise'] ?? PRICING_DEFAULTS.listingLimits.enterprise,
      },
    }
    _pricingExpiresAt = now + PRICING_TTL_MS
    return _pricing
  } catch {
    return PRICING_DEFAULTS
  }
}

// Invalidate the in-process pricing cache (call after admin saves new prices).
export function invalidatePricingCache(): void {
  _pricing = null
  _pricingExpiresAt = 0
}

// Converts Pricing to flat key-value pairs for DB storage
export function pricingToRows(p: Pricing): { key: string; value: string }[] {
  return [
    { key: 'subscription_basic_price',      value: String(p.subscription.basic) },
    { key: 'subscription_premium_price',    value: String(p.subscription.premium) },
    { key: 'subscription_enterprise_price', value: String(p.subscription.enterprise) },
    { key: 'unlock_price',                  value: String(p.unlock) },
    { key: 'boost_1week_price',             value: String(p.boost[1]) },
    { key: 'boost_2week_price',             value: String(p.boost[2]) },
    { key: 'boost_4week_price',             value: String(p.boost[4]) },
    { key: 'extra_listing_price',           value: String(p.extraListing) },
    { key: 'listing_limit_free',            value: String(p.listingLimits.free) },
    { key: 'listing_limit_basic',           value: String(p.listingLimits.basic) },
    { key: 'listing_limit_premium',         value: String(p.listingLimits.premium) },
    { key: 'listing_limit_enterprise',      value: String(p.listingLimits.enterprise) },
  ]
}
