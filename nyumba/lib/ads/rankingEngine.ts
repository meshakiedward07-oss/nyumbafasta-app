import { createAdminClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AdType = 'banner' | 'search' | 'nearby' | 'video' | 'featured'

export type RankedAd = {
  id:               string
  ad_type:          AdType
  title:            string
  body_text:        string | null
  image_url:        string | null
  video_url:        string | null
  cta_type:         'whatsapp' | 'call' | 'website'
  cta_value:        string
  target_region:    string
  target_district:  string | null
  target_category:  string | null
  is_featured:      boolean
  quality_score:    number
  advertiser: {
    id:                string
    business_name:     string
    business_category: string
    logo_url:          string | null
    whatsapp_number:   string | null
    description:       string | null
    city:              string
  } | null
}

export type RankAdsParams = {
  ad_type?:  AdType | AdType[]
  region:    string
  category?: string
  sessionId: string
  limit?:    number
}

export type RankAdsResult = {
  ads:   RankedAd[]
  total: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDayOfYear(): number {
  const now   = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000)
}

// Deterministic hash of a UUID string → positive 32-bit integer
function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i)
  }
  return Math.abs(h >>> 0)
}

// ── Core ranking (TypeScript, no extra DB round-trips) ─────────────────────────

type RawRow = {
  id:              string
  ad_type:         string
  title:           string
  body_text:       string | null
  image_url:       string | null
  video_url:       string | null
  cta_type:        string
  cta_value:       string
  target_region:   string
  target_district: string | null
  target_category: string | null
  advertiser:      Record<string, unknown> | null
}

type ScoredRow = RawRow & {
  is_featured:   boolean
  quality_score: number
  rotation_key:  number
}

function scoreRows(rows: RawRow[]): ScoredRow[] {
  const doy = getDayOfYear()
  return rows.map(r => {
    const adv           = r.advertiser
    const quality_score =
      (adv?.description && String(adv.description).length > 0 ? 1 : 0) +
      (adv?.logo_url ? 1 : 0) +
      (adv?.city && String(adv.city).length > 0 ? 1 : 0)
    return {
      ...r,
      is_featured:   r.ad_type === 'featured',
      quality_score,
      // rotation_key: changes every day, consistent within a day, per-ad-id
      rotation_key:  (doy + djb2(r.id)) % 997,
    }
  })
}

function sortScored(rows: ScoredRow[]): ScoredRow[] {
  return [...rows].sort((a, b) => {
    // 1. Featured before regular
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1
    // 2. Higher quality score first
    if (a.quality_score !== b.quality_score) return b.quality_score - a.quality_score
    // 3. Tie-break with daily rotation (lower key = earlier today)
    return a.rotation_key - b.rotation_key
  })
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function rankAds(params: RankAdsParams): Promise<RankAdsResult> {
  const { ad_type, region, category, sessionId, limit = 5 } = params
  const admin = createAdminClient()
  const now   = new Date().toISOString()
  const capAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

  // ── 1. Frequency cap: fetch recently shown IDs for this session ──────────
  const { data: recentData } = await admin
    .from('ad_impressions')
    .select('campaign_id')
    .eq('session_id', sessionId)
    .gt('shown_at', capAt)

  const recentIds: string[] = (recentData ?? []).map(r => r.campaign_id as string)

  // ── 2. Build candidate query (relevance filter + frequency cap) ──────────
  function buildCandidateQuery(excludeIds: string[]) {
    let q = admin
      .from('ad_campaigns')
      .select(`
        id, ad_type, title, body_text, image_url, video_url,
        cta_type, cta_value, target_region, target_district, target_category,
        advertiser:advertiser_id (
          id, business_name, business_category,
          logo_url, whatsapp_number, description, city
        )
      `)
      .eq('status', 'active')
      .eq('payment_status', 'completed')
      .eq('target_region', region)
      .or(`expires_at.is.null,expires_at.gt.${now}`)

    if (ad_type) {
      if (Array.isArray(ad_type)) q = q.in('ad_type', ad_type)
      else                        q = q.eq('ad_type', ad_type)
    }

    // Relevance filter: NULL target_category = "any category" → always show
    if (category) {
      q = q.or(`target_category.is.null,target_category.eq.${category}`)
    }

    // Frequency cap exclusion
    if (excludeIds.length > 0) {
      q = q.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    return q.limit(50)
  }

  // ── 3. Total count — no frequency cap (for "Tazama zote" badge) ──────────
  let countQ = admin
    .from('ad_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('payment_status', 'completed')
    .eq('target_region', region)
    .or(`expires_at.is.null,expires_at.gt.${now}`)

  if (ad_type) {
    if (Array.isArray(ad_type)) countQ = countQ.in('ad_type', ad_type)
    else                        countQ = countQ.eq('ad_type', ad_type)
  }
  if (category) {
    countQ = countQ.or(`target_category.is.null,target_category.eq.${category}`)
  }

  // Run candidate + count in parallel
  const [{ data: rawCandidates }, { count: total }] = await Promise.all([
    buildCandidateQuery(recentIds),
    countQ,
  ])

  // ── 4. Score + sort ──────────────────────────────────────────────────────
  const scored = sortScored(scoreRows((rawCandidates ?? []) as unknown as RawRow[]))

  // ── 5. Split: Featured (max 2) + Regular (fill remainder) ───────────────
  const featured = scored.filter(c => c.is_featured).slice(0, 2)
  const regular  = scored.filter(c => !c.is_featured).slice(0, limit - featured.length)
  let pool       = [...featured, ...regular]

  // ── 6. Fallback — if < 3 ads, relax frequency cap to fill slots ──────────
  if (pool.length < 3 && recentIds.length > 0) {
    const existingIds = new Set(pool.map(c => c.id))
    const needed      = 3 - pool.length

    const { data: fallbackRaw } = await admin
      .from('ad_campaigns')
      .select(`
        id, ad_type, title, body_text, image_url, video_url,
        cta_type, cta_value, target_region, target_district, target_category,
        advertiser:advertiser_id (
          id, business_name, business_category,
          logo_url, whatsapp_number, description, city
        )
      `)
      .eq('status', 'active')
      .eq('payment_status', 'completed')
      .eq('target_region', region)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .in('id', recentIds)
      .limit(needed + 5)

    const fallbackScored = sortScored(
      scoreRows((fallbackRaw ?? []) as unknown as RawRow[])
    ).filter(c => !existingIds.has(c.id))

    pool = [...pool, ...fallbackScored.slice(0, needed)]
  }

  return {
    ads:   pool.slice(0, limit) as unknown as RankedAd[],
    total: total ?? 0,
  }
}
