/**
 * Single source of truth for a campaign's total price. Ward-scope plans
 * are priced PER WARD — a campaign targeting 3 wards costs 3× the plan's
 * listed price_tzs, not just price_tzs alone.
 *
 * Found 2026-09-01: pay/initiate/route.ts already computed this correctly
 * (so the actual charge was always right), but every DISPLAY location —
 * the advertiser's own payment confirmation page (app/advertising/pay/[id]/page.tsx,
 * the most serious instance: an advertiser could see "Lipa Tsh 5,000" and
 * then actually get charged Tsh 15,000 for 3 wards), the advertiser's
 * dashboard list, and both the admin campaign list and detail pages —
 * independently showed the raw, unmultiplied plan.price_tzs. Each had
 * silently forgotten (or never known) to multiply. Centralizing the
 * calculation here, used everywhere a campaign's price is shown or
 * charged, closes that whole class of bug — there is no other place left
 * that reimplements this logic.
 *
 * Deliberately NOT stored as a column on ad_campaigns (e.g. a cached
 * total_price_tzs) — target_wards can be edited after creation (PATCH
 * .../campaigns/[id] allows it), and a cached value would go stale on
 * every such edit unless every edit path also remembered to recompute it.
 * Computing fresh from the campaign's current target_wards + the plan's
 * current geo_scope/price_tzs is simpler and can't drift.
 */
export function getCampaignTotalPrice(
  planPriceTzs: number,
  geoScope: string | null | undefined,
  targetWards: string[] | null | undefined,
): number {
  if (geoScope === 'ward' && targetWards && targetWards.length > 0) {
    return planPriceTzs * targetWards.length
  }
  return planPriceTzs
}
