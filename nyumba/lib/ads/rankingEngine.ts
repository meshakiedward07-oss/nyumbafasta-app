import { createAdminClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AdType = 'banner' | 'search' | 'nearby' | 'video' | 'featured'

export type RankedAd = {
  id:               string
  ad_type:          AdType
  title:            string
  body_text:        string | null
  image_url:        string | null   // placement-resolved: nearby → nearby_url, etc.
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
  ad_type?:   AdType | AdType[]
  region:     string
  category?:  string
  sessionId:  string
  limit?:     number
  placement?: string   // filter by allowed_placements; also selects variant URL
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

function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i)
  }
  return Math.abs(h >>> 0)
}

// ── Core types ─────────────────────────────────────────────────────────────────

type Creative = {
  banner_url:      string | null
  search_url:      string | null
  nearby_url:      string | null
  featured_url:    string | null
  video_thumb_url: string | null
} | null

type RawRow = {
  id:              string
  ad_type:         string
  title:           string
  body_text:       string | null
  image_url:       string | null   // fallback if no creative
  video_url:       string | null
  cta_type:        string
  cta_value:       string
  target_region:   string
  target_district: string | null
  target_category: string | null
  creative:        Creative
  advertiser:      Record<string, unknown> | null
}

type ScoredRow = RawRow & {
  is_featured:   boolean
  quality_score: number
  rotation_key:  number
}

// ── Per-placement image URL resolver ──────────────────────────────────────────
// Returns the variant most appropriate for the requested placement,
// falling back gracefully if a specific variant was not generated.

function resolveImageUrl(row: RawRow, placement?: string): string | null {
  const c = row.creative
  if (!c) return row.image_url
  switch (placement) {
    case 'nearby':   return c.nearby_url      ?? c.banner_url ?? row.image_url
    case 'search':   return c.search_url      ?? c.banner_url ?? row.image_url
    case 'featured': return c.featured_url    ?? c.banner_url ?? row.image_url
    case 'video':    return c.video_thumb_url ?? c.banner_url ?? row.image_url
    default:         return c.banner_url      ?? row.image_url
  }
}

// ── SELECT string (shared by candidate + fallback queries) ────────────────────
// Joins ad_creatives for per-placement variant URLs.

const AD_SELECT = `
  id, ad_type, title, body_text, image_url, video_url,
  cta_type, cta_value, target_region, target_district, target_category,
  creative:creative_id (
    banner_url, search_url, nearby_url, featured_url, video_thumb_url
  ),
  advertiser:advertiser_id (
    id, business_name, business_category,
    logo_url, whatsapp_number, description, city
  )
` as const

// ── Scoring ────────────────────────────────────────────────────────────────────

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
      is_featured:  r.ad_type === 'featured',
      quality_score,
      rotation_key: (doy + djb2(r.id)) % 997,
    }
  })
}

function sortScored(rows: ScoredRow[]): ScoredRow[] {
  return [...rows].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1
    if (a.quality_score !== b.quality_score) return b.quality_score - a.quality_score
    return a.rotation_key - b.rotation_key
  })
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function rankAds(params: RankAdsParams): Promise<RankAdsResult> {
  const { ad_type, region, category, sessionId, limit = 5, placement } = params
  const admin = createAdminClient()
  const now   = new Date().toISOString()
  const capAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

  // SSR: skip freq cap — all server renders share 'ssr' session, which would
  // incorrectly accumulate impressions and cap ads for real users.
  const isSsr = !sessionId || sessionId === 'ssr'

  // ── 1. Frequency cap: recent impression IDs for this session ─────────────
  let recentIds: string[] = []
  if (!isSsr) {
    const { data: recentData } = await admin
      .from('ad_impressions')
      .select('campaign_id')
      .eq('session_id', sessionId)
      .gt('shown_at', capAt)
    recentIds = (recentData ?? []).map(r => r.campaign_id as string)
  }

  // ── 2. Filter applicator ──────────────────────────────────────────────────
  // Partial index idx_ad_campaigns_active_ranking covers:
  //   (target_region, ad_type, target_category, expires_at)
  //   WHERE status = 'active' AND payment_status = 'completed'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any): any {
    q = q
      .eq('status', 'active')
      .eq('payment_status', 'completed')
      .eq('target_region', region)
      .or(`expires_at.is.null,expires_at.gt.${now}`)

    if (ad_type) {
      if (Array.isArray(ad_type)) q = q.in('ad_type', ad_type)
      else                        q = q.eq('ad_type', ad_type)
    }

    if (category) {
      q = q.or(`target_category.is.null,target_category.eq.${category}`)
    }

    // Placement entitlement: campaigns whose plan includes this placement.
    // Uses GIN index idx_ad_campaigns_placements for O(1) array-contains lookup.
    // Campaigns with empty allowed_placements (pre-migration) are excluded —
    // run the ad_creatives.sql migration to backfill them.
    if (placement) {
      q = q.filter('allowed_placements', 'cs', `{"${placement}"}`)
    }

    return q
  }

  // ── 3. Candidate + count in parallel ────────────────────────────────────
  const candidateLimit = Math.min(limit * 8, 80)

  let candidateQ = applyFilters(
    admin.from('ad_campaigns').select(AD_SELECT)
  )
  if (recentIds.length > 0) {
    candidateQ = candidateQ.not('id', 'in', `(${recentIds.join(',')})`)
  }
  candidateQ = candidateQ.limit(candidateLimit)

  const countQ = applyFilters(
    admin.from('ad_campaigns').select('*', { count: 'exact', head: true })
  )

  const [{ data: rawCandidates }, { count: total }] = await Promise.all([
    candidateQ,
    countQ,
  ])

  // ── 4. Score + sort ──────────────────────────────────────────────────────
  const scored = sortScored(scoreRows((rawCandidates ?? []) as unknown as RawRow[]))

  // ── 5. Split: Featured (max 2 slots) + Regular (fill remainder) ──────────
  const featured = scored.filter(c => c.is_featured).slice(0, 2)
  const regular  = scored.filter(c => !c.is_featured).slice(0, limit - featured.length)
  let pool       = [...featured, ...regular]

  // ── 6. Fallback: if still < 3, re-include recently seen ads ─────────────
  if (!isSsr && pool.length < 3 && recentIds.length > 0) {
    const existingIds = new Set(pool.map(c => c.id))
    const needed      = 3 - pool.length

    const { data: fallbackRaw } = await admin
      .from('ad_campaigns')
      .select(AD_SELECT)
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

  // ── 7. Resolve per-placement image URLs ──────────────────────────────────
  // Swap image_url to the variant sized for the requested placement.
  // nearby → 300×200, search → 600×200, featured → 800×450, etc.
  const resolvedPool = pool.slice(0, limit).map(row => ({
    ...row,
    image_url: resolveImageUrl(row, placement),
  }))

  return {
    ads:   resolvedPool as unknown as RankedAd[],
    total: total ?? 0,
  }
}
