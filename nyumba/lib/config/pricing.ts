import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'

export type Pricing = {
  subscription: { basic: number; premium: number; enterprise: number }
  unlock:       number
  boost:        { 1: number; 2: number; 4: number }
  extraListing: number
}

export const PRICING_DEFAULTS: Pricing = {
  subscription: { basic: 10_000, premium: 25_000, enterprise: 50_000 },
  unlock:       2_000,
  boost:        { 1: 5_000, 2: 9_000, 4: 16_000 },
  extraListing: 2_000,
}

// Request-level cache (deduplicates within one server render/route handler)
export const getPricing = cache(async (): Promise<Pricing> => {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('app_settings').select('key, value')
    if (!data?.length) return PRICING_DEFAULTS

    const m: Record<string, number> = {}
    for (const row of data) m[row.key] = parseInt(row.value, 10)

    return {
      subscription: {
        basic:      m['subscription_basic_price']      ?? PRICING_DEFAULTS.subscription.basic,
        premium:    m['subscription_premium_price']    ?? PRICING_DEFAULTS.subscription.premium,
        enterprise: m['subscription_enterprise_price'] ?? PRICING_DEFAULTS.subscription.enterprise,
      },
      unlock:       m['unlock_price']          ?? PRICING_DEFAULTS.unlock,
      boost: {
        1:          m['boost_1week_price']      ?? PRICING_DEFAULTS.boost[1],
        2:          m['boost_2week_price']      ?? PRICING_DEFAULTS.boost[2],
        4:          m['boost_4week_price']      ?? PRICING_DEFAULTS.boost[4],
      },
      extraListing: m['extra_listing_price']   ?? PRICING_DEFAULTS.extraListing,
    }
  } catch {
    return PRICING_DEFAULTS
  }
})

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
  ]
}
