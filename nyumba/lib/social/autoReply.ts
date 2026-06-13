import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { handleIncomingMessage } from '@/lib/chat/aiAgent'
import { replyToIGComment, replyToFBComment, sendIGDM, sendFBMessage } from './metaClient'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type CommentType = 'inquiry' | 'interest' | 'negative' | 'spam' | 'question' | 'praise' | 'unknown'
type Platform = 'instagram' | 'facebook'

// ── Comment classification ─────────────────────────────────────────────────

export async function classifyComment(text: string): Promise<CommentType> {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      system: `Classify this comment into ONE of these categories (reply with the word only):
- inquiry: asking for contact/price/details about renting
- interest: expressing interest like "nice", "I want this"
- negative: complaint, bad experience, criticism
- spam: advertisement, unrelated, bots, scam
- question: asking general housing questions
- praise: complimenting the listing/platform
- unknown: anything else

Reply with only the category word.`,
      messages: [{ role: 'user', content: text.slice(0, 500) }],
    })

    const category = (res.content[0] as { type: 'text'; text: string }).text.trim().toLowerCase()
    const valid: CommentType[] = ['inquiry', 'interest', 'negative', 'spam', 'question', 'praise', 'unknown']
    return valid.includes(category as CommentType) ? (category as CommentType) : 'unknown'
  } catch {
    return 'unknown'
  }
}

// ── Auto-reply templates ───────────────────────────────────────────────────

const REPLY_TEMPLATES: Record<CommentType, string | null> = {
  inquiry:  `Asante kwa maslahi yako! 🏠 Tuma DM yako au tembelea profile yetu upate maelezo zaidi na nambari ya dalali. Tunakusubiri! 😊`,
  interest: `Shwari sana! 🙌 Nyumba hii bado inapatikana. Tuma DM upate maelezo zaidi au angalia link kwenye bio yetu.`,
  negative: `Pole sana kwa hilo. 🙏 Tuma DM yako ili tuweze kukusaidia haraka zaidi. Tutaangalia tatizo lako moja kwa moja.`,
  spam:     null, // Never reply to spam
  question: `Maswali yako ni mazuri! 😊 Tuma DM yetu au tembelea nyumbafasta.co.tz kwa maelezo zaidi kuhusu nyumba zinazobpatikana.`,
  praise:   `Asante sana! 🙏❤️ Tunafurahi kusikia hivyo. Kama unatafuta nyumba, tuma DM yetu au angalia listings kwenye bio.`,
  unknown:  null, // Don't reply to unclear comments
}

export function getAutoReply(type: CommentType): string | null {
  return REPLY_TEMPLATES[type]
}

// ── Handle new incoming comment ────────────────────────────────────────────

type CommentData = {
  commentId:    string
  commenterId:  string
  commenterName?: string
  commentText:  string
  igPostId?:    string   // Instagram media ID
  fbPostId?:    string   // Facebook post ID
}

export async function handleNewComment(
  data: CommentData,
  platform: Platform,
): Promise<void> {
  // Resolve social_post.id from platform post ID
  let postDbId: string | null = null
  if (data.igPostId || data.fbPostId) {
    const col = platform === 'instagram' ? 'instagram_post_id' : 'facebook_post_id'
    const val = platform === 'instagram' ? data.igPostId : data.fbPostId
    const { data: found } = await supabaseAdmin
      .from('social_posts')
      .select('id')
      .eq(col, val)
      .maybeSingle()
    postDbId = found?.id ?? null
  }

  // Classify the comment
  const commentType = await classifyComment(data.commentText)

  // Save to DB
  await supabaseAdmin.from('social_comments').upsert({
    post_id:        postDbId,
    platform,
    comment_id:     data.commentId,
    commenter_id:   data.commenterId,
    commenter_name: data.commenterName ?? null,
    comment_text:   data.commentText,
    comment_type:   commentType,
    reply_sent:     false,
  }, { onConflict: 'comment_id' })

  // Never reply to spam
  if (commentType === 'spam') {
    console.log(`[Social] Spam comment skipped: ${data.commentId}`)
    return
  }

  const replyText = getAutoReply(commentType)
  if (!replyText) return

  // Send reply on the platform (with 500ms delay to be safe)
  await new Promise((r) => setTimeout(r, 500))
  try {
    if (platform === 'instagram') {
      await replyToIGComment(data.commentId, replyText)
    } else {
      await replyToFBComment(data.commentId, replyText)
    }

    await supabaseAdmin
      .from('social_comments')
      .update({
        reply_sent: true,
        reply_text: replyText,
        replied_at: new Date().toISOString(),
      })
      .eq('comment_id', data.commentId)

    console.log(`[Social] Replied to ${platform} comment type=${commentType}`)
  } catch (err) {
    console.error('[Social] Reply failed:', err)
  }
}

// ── Handle incoming DM ─────────────────────────────────────────────────────

type DMData = {
  senderId:    string
  senderName?: string
  messageId?:  string
  messageText: string
}

export async function handleSocialDM(
  data: DMData,
  platform: Platform,
): Promise<void> {
  // Dedup by message ID
  if (data.messageId) {
    const { data: existing } = await supabaseAdmin
      .from('social_dms')
      .select('id')
      .eq('message_id', data.messageId)
      .maybeSingle()
    if (existing) return
  }

  // Save incoming DM
  await supabaseAdmin.from('social_dms').insert({
    platform,
    sender_id:   data.senderId,
    sender_name: data.senderName ?? null,
    message_id:  data.messageId ?? null,
    message_text: data.messageText,
    reply_sent:  false,
  })

  // Route through Amina
  let replyText: string
  try {
    replyText = await handleIncomingMessage(
      platform,
      data.senderId,
      data.messageText,
      undefined,
      data.senderName,
    )
  } catch (err) {
    console.error('[Social] Amina DM reply failed:', err)
    return
  }

  if (!replyText?.trim()) return

  // Send reply
  try {
    if (platform === 'instagram') {
      await sendIGDM(data.senderId, replyText)
    } else {
      await sendFBMessage(data.senderId, replyText)
    }

    await supabaseAdmin
      .from('social_dms')
      .update({
        reply_sent: true,
        reply_text: replyText,
        replied_at: new Date().toISOString(),
      })
      .eq('message_id', data.messageId ?? '')

    console.log(`[Social] DM replied on ${platform} to ${data.senderId.slice(0, 6)}***`)
  } catch (err) {
    console.error('[Social] DM send failed:', err)
  }
}
