import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'
import { getIGPostMetrics } from './metaClient'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAY_NAMES_SW = ['Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi', 'Jumapili']

// ── Collect post metrics into post_performance ────────────────────────────

export async function collectPostPerformance(
  platform: 'instagram' | 'facebook',
): Promise<number> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const col   = platform === 'instagram' ? 'instagram_post_id' : 'facebook_post_id'

  const { data: posts } = await supabaseAdmin
    .from('social_posts')
    .select(`id, ${col}, media_type, published_at`)
    .eq('status', 'published')
    .gte('published_at', since)

  if (!posts || posts.length === 0) {
    console.log('[BestTime] No published posts found for', platform)
    return 0
  }

  console.log('[BestTime] Collecting metrics for', posts.length, platform, 'posts')
  let saved = 0

  for (const post of posts) {
    const platformPostId = post[col as keyof typeof post] as string | null
    if (!platformPostId) continue

    try {
      let likes = 0, comments = 0, reach = 0, impressions = 0, saves = 0

      if (platform === 'instagram') {
        const m = await getIGPostMetrics(platformPostId)
        likes = m.likes; comments = m.comments; reach = m.reach
        impressions = m.impressions; saves = m.saved
      }
      // FB metrics via page insights would go here — skipping for now,
      // engagement_rate stays 0 until FB insights API is integrated

      const postedAt  = new Date(post.published_at as string)
      // Shift UTC→EAT (+3) for Tanzania time
      const eatHour   = (postedAt.getUTCHours() + 3) % 24
      const jsDay     = postedAt.getDay()  // 0=Sunday
      const monFirst  = jsDay === 0 ? 6 : jsDay - 1

      const engRate = reach > 0
        ? parseFloat(((likes + comments + saves) / reach * 100).toFixed(2))
        : 0

      await supabaseAdmin.from('post_performance').upsert({
        platform,
        post_id:         platformPostId,
        post_type:       (post.media_type as string) ?? 'image',
        posted_at:       post.published_at,
        posted_hour:     eatHour,
        posted_day:      monFirst,
        likes,
        comments,
        reach,
        impressions,
        saves,
        engagement_rate: engRate,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'post_id' })

      saved++
    } catch (err) {
      console.error('[BestTime] Error collecting metrics for post', post.id, err)
    }

    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('[BestTime] Saved', saved, 'performance records')
  return saved
}

// ── Analyze best times from collected data ────────────────────────────────

export async function analyzeBestTimes(platform: 'instagram' | 'facebook') {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: perfs } = await supabaseAdmin
    .from('post_performance')
    .select('posted_hour, posted_day, engagement_rate')
    .eq('platform', platform)
    .gte('posted_at', since)
    .not('engagement_rate', 'is', null)

  if (!perfs || perfs.length < 5) {
    return getDefaultRecommendations()
  }

  // Aggregate by hour and day
  const hourMap: Record<number, number[]> = {}
  const dayMap:  Record<number, number[]> = {}

  for (const p of perfs) {
    const h = p.posted_hour as number
    const d = p.posted_day  as number
    const r = p.engagement_rate as number ?? 0
    ;(hourMap[h] ??= []).push(r)
    ;(dayMap[d]  ??= []).push(r)
  }

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

  const hourAvgs = Object.entries(hourMap)
    .map(([h, vals]) => ({ hour: +h, avg: avg(vals) }))
    .sort((a, b) => b.avg - a.avg)

  const dayAvgs = Object.entries(dayMap)
    .map(([d, vals]) => ({ day: +d, avg: avg(vals) }))
    .sort((a, b) => b.avg - a.avg)

  const bestHours  = hourAvgs.slice(0, 3).map(x => x.hour)
  const worstHours = hourAvgs.slice(-3).map(x => x.hour)
  const bestDays   = dayAvgs.slice(0, 3).map(x => x.day)
  const worstDays  = dayAvgs.slice(-3).map(x => x.day)

  const avgEngagement = parseFloat(avg(perfs.map(p => p.engagement_rate as number ?? 0)).toFixed(2))

  const recommendation = await generateRecommendationText({
    platform, bestHours, bestDays, worstHours, worstDays, dataPoints: perfs.length,
  })

  // Cache result
  await supabaseAdmin.from('posting_recommendations').upsert({
    platform,
    analysis_date:       new Date().toISOString().split('T')[0],
    best_hours:          bestHours,
    best_days:           bestDays,
    worst_hours:         worstHours,
    worst_days:          worstDays,
    recommendation_text: recommendation,
    data_points:         perfs.length,
    avg_engagement:      avgEngagement,
  }, { onConflict: 'platform,analysis_date' })

  return { bestHours, bestDays, worstHours, worstDays, recommendation, dataPoints: perfs.length }
}

// ── AI recommendation text ────────────────────────────────────────────────

async function generateRecommendationText(data: {
  platform:   string
  bestHours:  number[]
  bestDays:   number[]
  worstHours: number[]
  worstDays:  number[]
  dataPoints: number
}): Promise<string> {
  try {
    const fmtHours = (hs: number[]) =>
      hs.map(h => `${h}:00 ${h < 12 ? 'AM' : 'PM'} (EAT)`).join(', ')

    const fmtDays = (ds: number[]) =>
      ds.map(d => DAY_NAMES_SW[d] ?? d).join(', ')

    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 350,
      messages:   [{
        role:    'user',
        content: `Wewe ni mtaalamu wa social media Tanzania.
Changanua data hii ya ${data.platform} ya NyumbaFasta (posts ${data.dataPoints}) na toa ushauri mfupi kwa Kiswahili.

Masaa bora: ${fmtHours(data.bestHours)}
Siku bora: ${fmtDays(data.bestDays)}
Masaa mabaya: ${fmtHours(data.worstHours)}
Siku mbaya: ${fmtDays(data.worstDays)}

Toa ushauri (mistari 5-7) ukieleza wakati bora, sababu fupi, na ushauri 1-2 wa ziada kwa real estate Tanzania. Jibu kwa Kiswahili cha kawaida.`,
      }],
    })
    return (res.content[0] as { type: 'text'; text: string }).text.trim()
  } catch {
    return getDefaultRecommendations().recommendation
  }
}

// ── Default Tanzania-based recommendations ────────────────────────────────

export function getDefaultRecommendations() {
  return {
    bestHours:   [8, 13, 19],
    bestDays:    [1, 3, 4],
    worstHours:  [2, 3, 4],
    worstDays:   [6],
    recommendation: `Kulingana na mwelekeo wa Tanzania, wakati bora wa kupost ni:
📅 Siku: Jumanne, Alhamisi, na Ijumaa
⏰ Asubuhi: 8:00 AM (watu wanaanza safari ya kwenda kazi)
⏰ Mchana: 1:00 PM (mapumziko ya chakula)
⏰ Jioni: 7:00 PM (nyumbani baada ya kazi)

📊 Takwimu hizi zitathibitishwa ukiwa na posts 5+ zilizochapishwa.`,
    dataPoints:  0,
  }
}

// ── Get cached recommendation (or generate fresh if none) ─────────────────

export async function getCachedRecommendation(platform: 'instagram' | 'facebook') {
  const { data } = await supabaseAdmin
    .from('posting_recommendations')
    .select('*')
    .eq('platform', platform)
    .order('analysis_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? getDefaultRecommendations()
}

// ── Heatmap data: 7 days × 24 hours engagement averages ──────────────────

export async function getHeatmapData(
  platform: 'instagram' | 'facebook',
): Promise<number[][]> {
  const { data: perfs } = await supabaseAdmin
    .from('post_performance')
    .select('posted_hour, posted_day, engagement_rate')
    .eq('platform', platform)
    .not('engagement_rate', 'is', null)

  // Initialize 7×24 grid with zeros
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))

  for (const p of perfs ?? []) {
    const d = p.posted_day  as number
    const h = p.posted_hour as number
    const r = p.engagement_rate as number ?? 0
    if (d >= 0 && d < 7 && h >= 0 && h < 24) {
      grid[d][h] += r
      counts[d][h]++
    }
  }

  // Return averages
  return grid.map((row, d) =>
    row.map((total, h) => counts[d][h] > 0 ? parseFloat((total / counts[d][h]).toFixed(2)) : 0),
  )
}
