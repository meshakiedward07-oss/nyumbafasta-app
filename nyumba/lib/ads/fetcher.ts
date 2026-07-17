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
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .eq(params.region ? 'target_region' : 'status', params.region ?? 'active')
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 10)

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
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })

  if (city) q = q.eq('target_region', city)

  const { data } = await q
  return (data ?? []) as unknown as ActiveAd[]
}

export async function checkSlotAvailability(params: {
  ad_type: string
  region: string
  plan_slot_limit: number
}): Promise<{ available: boolean; active: number; limit: number }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Check for region-specific override
  const { data: slotConfig } = await admin
    .from('ad_slot_config')
    .select('max_slots')
    .eq('ad_type', params.ad_type)
    .eq('region', params.region)
    .maybeSingle()

  const limit = slotConfig?.max_slots ?? params.plan_slot_limit

  const { count } = await admin
    .from('ad_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('ad_type', params.ad_type)
    .eq('target_region', params.region)
    .eq('status', 'active')
    .eq('payment_status', 'completed')
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  const active = count ?? 0
  return { available: active < limit, active, limit }
}
