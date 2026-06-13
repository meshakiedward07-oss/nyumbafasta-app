import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { getIGPostMetrics, getFBPostMetrics } from './metaClient'

// ── Update metrics for all published posts (last 30 days) ─────────────────

export async function updateAllPostMetrics(): Promise<{ updated: number; failed: number }> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabaseAdmin
    .from('social_posts')
    .select('id, platform, instagram_post_id, facebook_post_id')
    .eq('status', 'published')
    .gte('published_at', since)
    .limit(100)

  let updated = 0
  let failed = 0

  for (const post of posts ?? []) {
    try {
      const metrics: Record<string, number> = {}

      if (post.instagram_post_id) {
        const igMetrics = await getIGPostMetrics(post.instagram_post_id)
        Object.assign(metrics, {
          ig_likes:       igMetrics.likes,
          ig_comments:    igMetrics.comments,
          ig_reach:       igMetrics.reach,
          ig_impressions: igMetrics.impressions,
          ig_saved:       igMetrics.saved,
        })
      }

      if (post.facebook_post_id) {
        const fbMetrics = await getFBPostMetrics(post.facebook_post_id)
        Object.assign(metrics, {
          fb_likes:       fbMetrics.likes,
          fb_comments:    fbMetrics.comments,
          fb_shares:      fbMetrics.shares,
          fb_impressions: fbMetrics.impressions,
        })
      }

      await supabaseAdmin
        .from('social_posts')
        .update({
          metrics:            metrics,
          metrics_updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)

      updated++

      // 500ms delay between requests to avoid hitting rate limits
      await new Promise((r) => setTimeout(r, 500))
    } catch (err) {
      console.error('[Metrics] Failed for post:', post.id, err)
      failed++
    }
  }

  console.log(`[Metrics] Updated: ${updated}, Failed: ${failed}`)
  return { updated, failed }
}

// ── Get summary stats for admin dashboard ─────────────────────────────────

export type SocialStats = {
  totalPosts:      number
  publishedPosts:  number
  totalComments:   number
  unrepliedComments: number
  totalDMs:        number
  unrepliedDMs:    number
  postsThisWeek:   number
  commentsToday:   number
}

export async function getSocialStats(): Promise<SocialStats> {
  const weekAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    totalPostsRes,
    publishedPostsRes,
    totalCommentsRes,
    unrepliedCommentsRes,
    totalDMsRes,
    unrepliedDMsRes,
    postsThisWeekRes,
    commentsTodayRes,
  ] = await Promise.all([
    supabaseAdmin.from('social_posts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('social_posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabaseAdmin.from('social_comments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('social_comments').select('*', { count: 'exact', head: true }).eq('reply_sent', false).neq('comment_type', 'spam'),
    supabaseAdmin.from('social_dms').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('social_dms').select('*', { count: 'exact', head: true }).eq('reply_sent', false),
    supabaseAdmin.from('social_posts').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabaseAdmin.from('social_comments').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
  ])

  return {
    totalPosts:        totalPostsRes.count        ?? 0,
    publishedPosts:    publishedPostsRes.count     ?? 0,
    totalComments:     totalCommentsRes.count      ?? 0,
    unrepliedComments: unrepliedCommentsRes.count  ?? 0,
    totalDMs:          totalDMsRes.count           ?? 0,
    unrepliedDMs:      unrepliedDMsRes.count       ?? 0,
    postsThisWeek:     postsThisWeekRes.count      ?? 0,
    commentsToday:     commentsTodayRes.count      ?? 0,
  }
}
