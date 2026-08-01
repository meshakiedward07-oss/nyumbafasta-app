import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'
import { deleteIGComment, hideIGComment, deleteFBComment } from './metaClient'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type SpamAction = 'delete' | 'hide' | 'flag' | 'allow'

export type SpamCheckResult = {
  isSpam: boolean
  reason: string
  score:  number    // 0-100
  action: SpamAction
}

// ── Keyword + pattern check (fast, no AI) ──────────────────────────────────

export async function checkIfSpam(
  commentText: string,
  commenterId: string,
  platform:    'instagram' | 'facebook',
): Promise<SpamCheckResult> {
  const text = commentText.toLowerCase().trim()
  let score  = 0
  let reason = ''

  // ── 1. Keyword matching ──────────────────────────────────────────────────
  const { data: keywords } = await supabaseAdmin
    .from('spam_keywords')
    .select('keyword, category')
    .eq('is_active', true)

  const matched: string[] = []
  for (const kw of keywords ?? []) {
    if (text.includes(kw.keyword.toLowerCase())) {
      matched.push(kw.keyword)
      score += kw.category === 'offensive' ? 80
             : kw.category === 'adult'     ? 90
             : kw.category === 'scam'      ? 70
             : 40
    }
  }
  if (matched.length > 0) {
    reason = `keyword_match: ${matched.slice(0, 3).join(', ')}`
    // Increment match counts in background (non-blocking, best-effort)
    void Promise.resolve(supabaseAdmin.rpc('increment_keyword_matches', { keywords: matched })).catch(() => null)
  }

  // ── 2. Known spammer / blocked account ──────────────────────────────────
  const { data: spamAcct } = await supabaseAdmin
    .from('spam_accounts')
    .select('spam_count, is_blocked')
    .eq('platform', platform)
    .eq('account_id', commenterId)
    .maybeSingle()

  if (spamAcct?.is_blocked) {
    score  = 100
    reason = 'blocked_account'
  } else if ((spamAcct?.spam_count ?? 0) >= 3) {
    score += 50
    reason = reason || 'repeat_spammer'
  }

  // ── 3. Pattern detection ─────────────────────────────────────────────────
  // All-caps (≥10 chars) is shouting / spam
  if (commentText.length >= 10 && commentText === commentText.toUpperCase()) {
    score += 20
    reason = reason || 'all_caps'
  }

  // Excessive emojis (>10)
  const emojiCount = (commentText.match(/\p{Emoji}/gu) ?? []).length
  if (emojiCount > 10) {
    score += 15
    reason = reason || 'excessive_emojis'
  }

  // External URL (not nyumbafasta.co)
  if (/https?:\/\/(?!nyumbafasta\.co)[^\s]+/i.test(commentText)) {
    score += 35
    reason = reason || 'external_url'
  }

  // Trivially short (likely bot ping)
  if (text.length < 5) {
    score += 10
  }

  // ── 4. AI verification for borderline (30-69 score only) ─────────────────
  if (score >= 30 && score < 70) {
    const aiScore = await checkSpamWithAI(commentText)
    score  = Math.round((score + aiScore) / 2)
    if (aiScore > 60) reason = reason || 'ai_detected'
  }

  score = Math.min(100, score)

  let action: SpamAction
  let isSpam: boolean
  if (score >= 70) {
    action = 'delete'; isSpam = true
  } else if (score >= 50) {
    action = 'hide';   isSpam = true
  } else if (score >= 30) {
    action = 'flag';   isSpam = false  // let admin decide
  } else {
    action = 'allow';  isSpam = false
  }

  return { isSpam, reason, score, action }
}

// ── AI spam check (Claude Haiku — fast + cheap) ───────────────────────────

async function checkSpamWithAI(text: string): Promise<number> {
  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages:   [{
        role:    'user',
        content: `Angalia comment hii kutoka page ya real estate Tanzania. Je, ni spam? Jibu kwa namba 0-100 tu (0=si spam, 100=spam kabisa).

Comment: "${text.slice(0, 400)}"

Namba moja tu:`,
      }],
    })
    const raw   = (res.content[0] as { type: 'text'; text: string }).text.trim()
    const score = parseInt(raw.match(/\d+/)?.[0] ?? '0', 10)
    return Math.min(100, Math.max(0, score))
  } catch {
    return 0   // fail-safe: don't delete on AI failure
  }
}

// ── Check + act + log ─────────────────────────────────────────────────────

export async function processCommentForSpam(params: {
  platform:      'instagram' | 'facebook'
  commentId:     string
  postId:        string
  commenterId:   string
  commenterName: string
  commentText:   string
}): Promise<{ wasSpam: boolean; action: SpamAction }> {
  console.log('[Spam] Checking comment:', params.commentId)

  const result = await checkIfSpam(params.commentText, params.commenterId, params.platform)

  if (!result.isSpam && result.action !== 'flag') {
    return { wasSpam: false, action: 'allow' }
  }

  console.log('[Spam] Detected! Score:', result.score, 'Action:', result.action, 'Reason:', result.reason)

  // ── Take action on platform ───────────────────────────────────────────────
  let actionTaken: SpamAction = result.action

  if (result.action === 'delete') {
    const deleted = params.platform === 'instagram'
      ? await deleteIGComment(params.commentId)
      : await deleteFBComment(params.commentId)

    if (!deleted && params.platform === 'instagram') {
      // Fallback to hide if delete fails (permissions issue)
      await hideIGComment(params.commentId, true)
      actionTaken = 'hide'
    } else if (!deleted) {
      actionTaken = 'flag'
    }
  } else if (result.action === 'hide' && params.platform === 'instagram') {
    await hideIGComment(params.commentId, true)
  }

  // ── Log to spam_comments ─────────────────────────────────────────────────
  await supabaseAdmin.from('spam_comments').upsert({
    platform:       params.platform,
    comment_id:     params.commentId,
    post_id:        params.postId,
    commenter_id:   params.commenterId,
    commenter_name: params.commenterName,
    comment_text:   params.commentText,
    spam_reason:    result.reason || 'detected',
    spam_score:     result.score,
    action_taken:   actionTaken === 'delete' ? 'deleted' : actionTaken === 'hide' ? 'hidden' : actionTaken === 'flag' ? 'flagged' : 'ignored',
    deleted_at:     new Date().toISOString(),
  }, { onConflict: 'comment_id' })

  // ── Update spam accounts tracker ──────────────────────────────────────────
  await Promise.resolve(supabaseAdmin.rpc('upsert_spam_account', {
    p_platform:     params.platform,
    p_account_id:   params.commenterId,
    p_account_name: params.commenterName,
  })).catch(err => console.error('[Spam] upsert_spam_account failed:', err))

  console.log('[Spam] Action taken:', actionTaken)
  return { wasSpam: result.isSpam, action: actionTaken }
}

// ── Spam stats for dashboard ──────────────────────────────────────────────

export async function getSpamStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    { count: deletedCount },
    { count: hiddenCount },
    { count: flaggedCount },
    { count: todayCount },
    { count: weekCount },
    { data: recent },
    { data: topSpammerRow },
    { data: topKeywordRow },
  ] = await Promise.all([
    supabaseAdmin.from('spam_comments').select('*', { count: 'exact', head: true }).eq('action_taken', 'deleted'),
    supabaseAdmin.from('spam_comments').select('*', { count: 'exact', head: true }).eq('action_taken', 'hidden'),
    supabaseAdmin.from('spam_comments').select('*', { count: 'exact', head: true }).eq('action_taken', 'flagged'),
    supabaseAdmin.from('spam_comments').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabaseAdmin.from('spam_comments').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
    supabaseAdmin.from('spam_comments').select('*').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('spam_accounts').select('account_name, spam_count').order('spam_count', { ascending: false }).limit(1),
    supabaseAdmin.from('spam_keywords').select('keyword, match_count').order('match_count', { ascending: false }).limit(1),
  ])

  return {
    totalDeleted:  deletedCount  ?? 0,
    totalHidden:   hiddenCount   ?? 0,
    totalFlagged:  flaggedCount  ?? 0,
    spamToday:     todayCount    ?? 0,
    spamThisWeek:  weekCount     ?? 0,
    topSpammer:    topSpammerRow?.[0]?.account_name ?? null,
    topKeyword:    topKeywordRow?.[0]?.keyword      ?? null,
    recentSpam:    recent ?? [],
  }
}
