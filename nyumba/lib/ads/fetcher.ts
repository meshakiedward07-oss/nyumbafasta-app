import { createAdminClient } from '@/lib/supabase/server'

export type ActiveAd = {
  id: string
  ad_type: 'banner' | 'search' | 'nearby' | 'video' | 'featured'
  title: string
  body_text: string | null
  image_url: string | null
  video_url: string | null
  cta_type: 'whatsapp' | 'call' | 'website'
  cta_value: string
  target_region: string
  target_district: string | null
  target_category: string | null
  advertiser: {
    id: string
    business_name: string
    business_category: string
    logo_url: string | null
    whatsapp_number: string | null
  } | null
}

export async function getActiveAds(params: {
  ad_type: ActiveAd['ad_type']
  region?: string
  limit?: number
}): Promise<ActiveAd[]> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  let q = admin
    .from('ad_campaigns')
    .select(`
      id, ad_type, title, body_text, image_url, video_url,
      cta_type, cta_value, target_region, target_district, target_category,
      advertiser:advertiser_id (
        id, business_name, business_category, logo_url, whatsapp_number
      )
    `)
    .eq('status', 'active')
    .eq('payment_status', 'completed')
    .eq('ad_type', params.ad_type)
    // Region-wide fetch — exclude district/kata-scoped campaigns so they
    // don't leak to the wrong (broader) audience than what was paid for.
    .is('target_district', null)
    .is('target_wards', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 10)

  if (params.region) q = q.eq('target_region', params.region)

  const { data } = await q
  return (data ?? []) as unknown as ActiveAd[]
}

export async function getActiveAdsForRegion(params: {
  ad_type: ActiveAd['ad_type']
  region: string
  limit?: number
}): Promise<ActiveAd[]> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data } = await admin
    .from('ad_campaigns')
    .select(`
      id, ad_type, title, body_text, image_url, video_url,
      cta_type, cta_value, target_region, target_district, target_category,
      advertiser:advertiser_id (
        id, business_name, business_category, logo_url, whatsapp_number
      )
    `)
    .eq('status', 'active')
    .eq('payment_status', 'completed')
    .eq('ad_type', params.ad_type)
    .eq('target_region', params.region)
    .is('target_district', null)
    .is('target_wards', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 10)

  return (data ?? []) as unknown as ActiveAd[]
}

export async function getFeaturedBusinesses(city?: string): Promise<ActiveAd[]> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  let q = admin
    .from('ad_campaigns')
    .select(`
      id, ad_type, title, body_text, image_url, video_url,
      cta_type, cta_value, target_region, target_district, target_category,
      advertiser:advertiser_id (
        id, business_name, business_category, logo_url, whatsapp_number
      )
    `)
    .eq('status', 'active')
    .eq('payment_status', 'completed')
    .eq('ad_type', 'featured')
    .is('target_district', null)
    .is('target_wards', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })

  if (city) q = q.eq('target_region', city)

  const { data } = await q
  return (data ?? []) as unknown as ActiveAd[]
}

/**
 * Slot pools are keyed by the campaign's EXACT geo-targeting scope so a
 * kata-scoped campaign never competes with (or gets blocked by) a
 * region-wide or district-wide pool for the same ad_type/region — the
 * whole point of letting a small business target 1-2 kata instead of
 * waiting for a region-wide slot (added 2026-09-01, "kata targeting").
 *
 * - wards given  → checks EACH ward independently (a campaign targeting
 *   2 wards needs room in BOTH); `active`/`limit` in the result describe
 *   the tightest (most-consumed) of the requested wards, for a useful
 *   error message.
 * - district given (no wards) → pool = campaigns with this exact
 *   target_district and no target_wards (pure district-wide competitors).
 * - neither given → pool = campaigns with no target_district and no
 *   target_wards (pure region-wide competitors) — unchanged behavior,
 *   just now explicitly excluding narrower-scoped campaigns that used to
 *   be miscounted into the region pool before this feature existed.
 */
export async function checkSlotAvailability(params: {
  ad_type: string
  region: string
  plan_slot_limit: number
  district?: string | null
  wards?: string[] | null
}): Promise<{ available: boolean; active: number; limit: number }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Region-specific override (still only applies to the region-wide pool —
  // district/ward tiers use their own plan's slot_limit directly)
  const { data: slotConfig } = await admin
    .from('ad_slot_config')
    .select('max_slots')
    .eq('ad_type', params.ad_type)
    .eq('region', params.region)
    .maybeSingle()

  const wards = (params.wards ?? []).filter(Boolean)

  if (wards.length > 0) {
    const limit = params.plan_slot_limit
    let tightestActive = 0
    for (const ward of wards) {
      const { count } = await admin
        .from('ad_campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('ad_type', params.ad_type)
        .eq('target_region', params.region)
        .eq('status', 'active')
        .eq('payment_status', 'completed')
        .contains('target_wards', [ward])
        .or(`expires_at.is.null,expires_at.gt.${now}`)

      const active = count ?? 0
      if (active > tightestActive) tightestActive = active
      if (active >= limit) return { available: false, active, limit }
    }
    return { available: true, active: tightestActive, limit }
  }

  if (params.district) {
    const limit = params.plan_slot_limit
    const { count } = await admin
      .from('ad_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('ad_type', params.ad_type)
      .eq('target_region', params.region)
      .eq('target_district', params.district)
      .is('target_wards', null)
      .eq('status', 'active')
      .eq('payment_status', 'completed')
      .or(`expires_at.is.null,expires_at.gt.${now}`)

    const active = count ?? 0
    return { available: active < limit, active, limit }
  }

  const limit = slotConfig?.max_slots ?? params.plan_slot_limit

  const { count } = await admin
    .from('ad_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('ad_type', params.ad_type)
    .eq('target_region', params.region)
    .is('target_district', null)
    .is('target_wards', null)
    .eq('status', 'active')
    .eq('payment_status', 'completed')
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  const active = count ?? 0
  return { available: active < limit, active, limit }
}
