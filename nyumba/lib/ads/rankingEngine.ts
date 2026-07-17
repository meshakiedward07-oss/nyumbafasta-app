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
  ad_type?:   AdType | AdType[]
  region:     string
  category?:  string
  sessionId:  string
  limit?:     number
  placement?: string   // filter by allowed_placements (plan entitlement)
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

const AD_SELECT = `
  id, ad_type, title, body_text, image_url, video_url,
  cta_type, cta_value, target_region, target_district, target_category,
  advertiser:advertiser_id (
    id, business_name, business_category,
    logo_url, whatsapp_number, description, city
  )
` as const

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

  // SSR renders share a single session ID — bypass freq cap entirely to avoid
  // poisoning the impression table with bot/crawler traffic.
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

  // ── 2. Shared filter applicator ──────────────────────────────────────────
  // Uses the partial index idx_ad_campaigns_active_ranking:
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
    // Placement entitlement: only show campaigns whose plan covers this placement.
    // Campaigns with empty allowed_placements (created before this feature) fall
    // back gracefully — they are not excluded.
    if (placement) {
      q = q.or(`allowed_placements.cs.{"${placement}"},allowed_placements.eq.{}`)
    }
    return q
  }

  // ── 3. Candidate + count in parallel ────────────────────────────────────
  // Candidate pool: fetch enough to score + pick from, but no more.
  // Extra headroom (×8) accounts for freq-cap exclusions and featured priority.
  // Capped at 80 — beyond that, latency cost exceeds ranking benefit.
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
  // Only runs for real sessions that have impressions; SSR never hits this.
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

  return {
    ads:   pool.slice(0, limit) as unknown as RankedAd[],
    total: total ?? 0,
  }
}
