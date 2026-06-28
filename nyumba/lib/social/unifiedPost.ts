import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { postListingToSocialMedia } from './autoPost'
import { postVideoToTikTok, generateTikTokCaption } from './tiktok'
import type { Listing } from '@/lib/types/database'

export type UnifiedPlatform = 'instagram' | 'facebook' | 'tiktok'

// ── Spec-compatible type aliases ─────────────────────────────────────────────
export type Platform = UnifiedPlatform

export interface PostPayload {
  listingId:  string
  videoUrl:   string
  imageUrls:  string[]
  caption:    string
  platforms:  Platform[]
  postType:   'video' | 'image' | 'carousel'
}

export interface PlatformResult {
  platform:   Platform
  success:    boolean
  postId?:    string
  postUrl?:   string
  error?:     string
  publishId?: string
}

export interface PostAllResult {
  results:      PlatformResult[]
  successCount: number
  failCount:    number
}

/**
 * Spec alias — posts to multiple platforms in parallel.
 * Wraps postListingToAllPlatforms for callers using the PostPayload API.
 */
export async function postToAllPlatforms(payload: PostPayload): Promise<PostAllResult> {
  const result = await postListingToAllPlatforms({
    listingId:  payload.listingId,
    platforms:  payload.platforms,
  })
  return {
    results:      result.results.map(r => ({
      platform:   r.platform,
      success:    r.success,
      postId:     r.postId,
      postUrl:    r.postUrl,
      error:      r.error,
    })),
    successCount: result.successCount,
    failCount:    result.failedCount,
  }
}

export interface UnifiedPostResult {
  platform: UnifiedPlatform
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

export interface UnifiedPostOptions {
  listingId: string
  platforms: UnifiedPlatform[]
  createdBy?: string
}

// ── Post listing to all selected platforms ───────────────────────────────────
export async function postListingToAllPlatforms(opts: UnifiedPostOptions): Promise<{
  results: UnifiedPostResult[]
  successCount: number
  failedCount: number
}> {
  const { listingId, platforms, createdBy } = opts
  const results: UnifiedPostResult[] = []

  // ── Instagram + Facebook (use autoPost.ts — has watermarks + captions) ────
  const metaPlatforms = platforms.filter(p => p === 'instagram' || p === 'facebook')
  if (metaPlatforms.length > 0) {
    try {
      const platformArg = (metaPlatforms.includes('instagram') && metaPlatforms.includes('facebook'))
        ? 'both'
        : metaPlatforms[0] as 'instagram' | 'facebook'

      const result = await postListingToSocialMedia(listingId, platformArg, createdBy)

      if (metaPlatforms.includes('instagram')) {
        results.push({
          platform:  'instagram',
          success:   !!result.instagramPostId,
          postId:    result.instagramPostId,
          postUrl:   result.instagramPostId
            ? `https://www.instagram.com/p/${result.instagramPostId}/`
            : undefined,
          error: !result.instagramPostId ? (result.error ?? 'IG post ilishindwa') : undefined,
        })
      }
      if (metaPlatforms.includes('facebook')) {
        results.push({
          platform: 'facebook',
          success:  !!result.facebookPostId,
          postId:   result.facebookPostId,
          postUrl:  result.facebookPostId
            ? `https://www.facebook.com/permalink.php?story_fbid=${result.facebookPostId}`
            : undefined,
          error: !result.facebookPostId ? (result.error ?? 'FB post ilishindwa') : undefined,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      for (const p of metaPlatforms) {
        results.push({ platform: p, success: false, error: msg })
      }
    }
  }

  // ── TikTok ────────────────────────────────────────────────────────────────
  if (platforms.includes('tiktok')) {
    try {
      const { data: listing } = await supabaseAdmin
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single()

      if (!listing?.video_url) {
        results.push({ platform: 'tiktok', success: false, error: 'Listing haina video' })
      } else {
        const caption  = await generateTikTokCaption(listing as Listing)
        const ttResult = await postVideoToTikTok({ videoUrl: listing.video_url, caption, listingId })
        results.push({
          platform: 'tiktok',
          success:  ttResult.success,
          postId:   ttResult.publishId,
          error:    ttResult.error,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ platform: 'tiktok', success: false, error: msg })
    }
  }

  const successCount = results.filter(r => r.success).length
  const failedCount  = results.filter(r => !r.success).length
  return { results, successCount, failedCount }
}

// ── Return which platforms are currently connected ───────────────────────────
export async function getConnectedPlatforms(): Promise<UnifiedPlatform[]> {
  const platforms: UnifiedPlatform[] = []

  if (process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN)
    platforms.push('instagram')

  if (process.env.FACEBOOK_PAGE_ID &&
      (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN))
    platforms.push('facebook')

  const { data: tt } = await supabaseAdmin
    .from('tiktok_connections')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (tt) platforms.push('tiktok')

  return platforms
}

// ── Unified stats aggregated from social_posts + tiktok_posts ────────────────
export async function getUnifiedStats(period: 'today' | 'week' | 'month' | 'all' = 'month') {
  let dateFrom: string | null = null
  if (period === 'today') dateFrom = new Date().toISOString().split('T')[0]
  else if (period === 'week')  dateFrom = new Date(Date.now() - 7  * 86400000).toISOString()
  else if (period === 'month') dateFrom = new Date(Date.now() - 30 * 86400000).toISOString()

  // ── social_posts (IG + FB) ────────────────────────────────────────────────
  let spQuery = supabaseAdmin
    .from('social_posts')
    .select('id, platform, status, instagram_post_id, facebook_post_id, metrics, published_at, created_at, listing_id')
    .order('created_at', { ascending: false })

  if (dateFrom) spQuery = spQuery.gte('created_at', dateFrom)
  const { data: spPosts } = await spQuery

  // ── tiktok_posts ──────────────────────────────────────────────────────────
  let ttQuery = supabaseAdmin
    .from('tiktok_posts')
    .select('id, status, publish_id, video_url, caption, created_at, listing_id, views_count, likes_count, comments_count')
    .order('created_at', { ascending: false })

  if (dateFrom) ttQuery = ttQuery.gte('created_at', dateFrom)
  const { data: ttPosts } = await ttQuery

  // ── Aggregate per platform ─────────────────────────────────────────────────
  const igPosts = (spPosts ?? []).filter(p => p.platform === 'instagram' || p.platform === 'both' || !!p.instagram_post_id)
  const fbPosts = (spPosts ?? []).filter(p => p.platform === 'facebook'  || p.platform === 'both' || !!p.facebook_post_id)

  function sumMetricKey(posts: typeof spPosts, key: string) {
    return (posts ?? []).reduce((s, p) => s + ((p.metrics as Record<string, number> | null)?.[key] ?? 0), 0)
  }

  const platformStats = [
    {
      platform:     'instagram',
      totalPosts:   igPosts.length,
      successPosts: igPosts.filter(p => !!p.instagram_post_id || p.status === 'published').length,
      failedPosts:  igPosts.filter(p => p.status === 'failed').length,
      totalViews:   0,
      totalLikes:   sumMetricKey(igPosts, 'ig_likes'),
      totalComments: sumMetricKey(igPosts, 'ig_comments'),
      totalShares:  0,
      lastPostAt:   igPosts[0]?.published_at ?? null,
    },
    {
      platform:     'facebook',
      totalPosts:   fbPosts.length,
      successPosts: fbPosts.filter(p => !!p.facebook_post_id || p.status === 'published').length,
      failedPosts:  fbPosts.filter(p => p.status === 'failed').length,
      totalViews:   0,
      totalLikes:   sumMetricKey(fbPosts, 'fb_likes'),
      totalComments: sumMetricKey(fbPosts, 'fb_comments'),
      totalShares:  sumMetricKey(fbPosts, 'fb_shares'),
      lastPostAt:   fbPosts[0]?.published_at ?? null,
    },
    {
      platform:     'tiktok',
      totalPosts:   (ttPosts ?? []).length,
      successPosts: (ttPosts ?? []).filter(p => p.status === 'published' || p.status === 'processing').length,
      failedPosts:  (ttPosts ?? []).filter(p => p.status === 'failed').length,
      totalViews:   (ttPosts ?? []).reduce((s, p) => s + ((p.views_count as number) ?? 0), 0),
      totalLikes:   (ttPosts ?? []).reduce((s, p) => s + ((p.likes_count as number) ?? 0), 0),
      totalComments: (ttPosts ?? []).reduce((s, p) => s + ((p.comments_count as number) ?? 0), 0),
      totalShares:  0,
      lastPostAt:   (ttPosts ?? [])[0]?.created_at ?? null,
    },
  ]

  const totals = {
    posts:    platformStats.reduce((s, p) => s + p.totalPosts, 0),
    views:    platformStats.reduce((s, p) => s + p.totalViews, 0),
    likes:    platformStats.reduce((s, p) => s + p.totalLikes, 0),
    comments: platformStats.reduce((s, p) => s + p.totalComments, 0),
    shares:   platformStats.reduce((s, p) => s + p.totalShares, 0),
  }

  // Recent posts (unified, latest 20)
  const recentMeta = (spPosts ?? []).slice(0, 20).map(p => ({
    id:         p.id,
    platform:   (p.platform === 'both' ? 'instagram' : p.platform) as string,
    status:     p.status === 'published' ? 'posted' : p.status,
    postId:     p.instagram_post_id ?? p.facebook_post_id ?? null,
    created_at: p.created_at,
    listing_id: p.listing_id,
  }))
  const recentTT = (ttPosts ?? []).slice(0, 20).map(p => ({
    id:         p.id,
    platform:   'tiktok',
    status:     p.status === 'processing' ? 'posting' : p.status,
    postId:     p.publish_id,
    created_at: p.created_at,
    listing_id: p.listing_id,
  }))
  const recentPosts = [...recentMeta, ...recentTT]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 20)

  return { platforms: platformStats, totals, recentPosts }
}
