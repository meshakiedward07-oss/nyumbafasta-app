/**
 * Refresh social media stats from platform APIs into social_posts / tiktok_posts tables.
 * Called by the cron/social/refresh-stats route.
 */
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export async function refreshAllStats(): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = []
  let updated = 0

  const results = await Promise.allSettled([
    refreshInstagramStats(),
    refreshFacebookStats(),
    refreshTikTokStats(),
  ])

  for (const r of results) {
    if (r.status === 'fulfilled') updated += r.value
    else errors.push((r.reason as Error)?.message ?? 'Unknown error')
  }

  return { updated, errors }
}

async function refreshInstagramStats(): Promise<number> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return 0

  const { data: posts } = await supabaseAdmin
    .from('social_posts')
    .select('id, instagram_post_id')
    .eq('platform', 'instagram')
    .eq('status', 'published')
    .not('instagram_post_id', 'is', null)
    .limit(50)

  let updated = 0
  for (const post of posts ?? []) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${post.instagram_post_id}?fields=like_count,comments_count,reach,saved,video_views&access_token=${token}`,
      )
      const data = await res.json() as Record<string, unknown>
      if (data.error) continue

      const metrics: Record<string, number> = {
        ig_likes:    (data.like_count     as number) || 0,
        ig_comments: (data.comments_count as number) || 0,
        ig_reach:    (data.reach          as number) || 0,
        ig_saved:    (data.saved          as number) || 0,
        ig_views:    (data.video_views    as number) || 0,
      }

      await supabaseAdmin
        .from('social_posts')
        .update({ metrics, metrics_updated_at: new Date().toISOString() })
        .eq('id', post.id)

      updated++
    } catch (err) {
      console.error('[StatsRefresher] IG post', post.id, 'refresh failed:', err instanceof Error ? err.message : err)
    }
  }
  return updated
}

async function refreshFacebookStats(): Promise<number> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!token) return 0

  const { data: posts } = await supabaseAdmin
    .from('social_posts')
    .select('id, facebook_post_id')
    .eq('platform', 'facebook')
    .eq('status', 'published')
    .not('facebook_post_id', 'is', null)
    .limit(50)

  let updated = 0
  for (const post of posts ?? []) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${post.facebook_post_id}?fields=reactions.summary(total_count),comments.summary(total_count),shares,video_views&access_token=${token}`,
      )
      const data = await res.json() as Record<string, unknown>
      if (data.error) continue

      type CountSummary = { summary?: { total_count?: number } }
      type SharesData = { count?: number }

      const metrics: Record<string, number> = {
        fb_likes:    ((data.reactions as CountSummary)?.summary?.total_count) ?? 0,
        fb_comments: ((data.comments  as CountSummary)?.summary?.total_count) ?? 0,
        fb_shares:   ((data.shares    as SharesData)?.count) ?? 0,
        fb_views:    (data.video_views as number) || 0,
      }

      await supabaseAdmin
        .from('social_posts')
        .update({ metrics, metrics_updated_at: new Date().toISOString() })
        .eq('id', post.id)

      updated++
    } catch (err) {
      console.error('[StatsRefresher] FB post', post.id, 'refresh failed:', err instanceof Error ? err.message : err)
    }
  }
  return updated
}

async function refreshTikTokStats(): Promise<number> {
  try {
    const { getValidToken } = await import('./tiktok')
    const token = await getValidToken()
    if (!token) return 0

    const { data: posts } = await supabaseAdmin
      .from('tiktok_posts')
      .select('id, publish_id, video_id')
      .eq('status', 'published')
      .not('publish_id', 'is', null)
      .limit(50)

    if (!posts?.length) return 0

    const videoIds = posts.map(p => (p.video_id ?? p.publish_id) as string).filter(Boolean)

    const res = await fetch('https://open.tiktokapis.com/v2/video/list/?fields=id,statistics', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filters: { video_ids: videoIds } }),
    })

    type TikTokVideo = {
      id: string
      statistics: {
        play_count?: number
        like_count?: number
        comment_count?: number
        share_count?: number
      }
    }
    const data = await res.json() as { data?: { videos?: TikTokVideo[] } }

    let updated = 0
    for (const video of data.data?.videos ?? []) {
      const post = posts.find(p => p.video_id === video.id || p.publish_id === video.id)
      if (!post) continue

      await supabaseAdmin
        .from('tiktok_posts')
        .update({
          views_count:    video.statistics?.play_count    ?? 0,
          likes_count:    video.statistics?.like_count    ?? 0,
          comments_count: video.statistics?.comment_count ?? 0,
          updated_at:     new Date().toISOString(),
        })
        .eq('id', post.id)

      updated++
    }
    return updated
  } catch (err) {
    console.error('[StatsRefresher] TikTok refresh failed:', err instanceof Error ? err.message : err)
    return 0
  }
}
