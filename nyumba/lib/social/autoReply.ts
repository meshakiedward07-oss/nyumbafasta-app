import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { handleIncomingMessage, getOrCreateSession, updateSession } from '@/lib/chat/aiAgent'
import { replyToIGComment, replyToFBComment, sendIGDM, sendFBMessage } from './metaClient'
import { detectDalaliIntent } from '@/lib/leads/dalaliDetection'
import { captureDalaliLead } from '@/lib/leads/captureFromWhatsApp'
import {
  classifyMessage,
  saveClassification,
  notifyOwnerPersonalMessage,
} from '@/lib/inbox/messageClassifier'
import { runCascade, cacheAminaAnswer, formatKBContext } from '@/lib/knowledge/cascade'
import { logMiss } from '@/lib/knowledge/missLog'
import { checkRateLimit } from '@/lib/knowledge/rateLimiter'
import {
  getOrCreateSocialSession,
  detectSocialEscalation,
  escalateSocialToAdmin,
} from './socialHandover'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type CommentType = 'inquiry' | 'interest' | 'negative' | 'spam' | 'question' | 'praise' | 'unknown'
type Platform = 'instagram' | 'facebook'

// ── Comment classification ─────────────────────────────────────────────────

export async function classifyComment(text: string): Promise<CommentType> {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
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
  question: `Maswali yako ni mazuri! 😊 Tuma DM yetu au tembelea nyumbafasta.co kwa maelezo zaidi kuhusu nyumba zinazopatikana.`,
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
  // ── Spam check FIRST — delete/hide before any reply ─────────────────────
  const platformPostId = platform === 'instagram' ? data.igPostId : data.fbPostId
  try {
    const { processCommentForSpam } = await import('./spamDetector')
    const spam = await processCommentForSpam({
      platform,
      commentId:     data.commentId,
      postId:        platformPostId ?? '',
      commenterId:   data.commenterId,
      commenterName: data.commenterName ?? '',
      commentText:   data.commentText,
    })
    if (spam.wasSpam) {
      console.log(`[AutoReply] Spam deleted/hidden — skipping reply. Action: ${spam.action}`)
      return
    }
  } catch (err) {
    console.error('[AutoReply] Spam check error (non-fatal, continuing):', err)
  }

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

  // For question/inquiry comments: try cascade first for a factual short answer.
  // Comments must be concise — truncate to 200 chars and always invite to DM.
  let replyText: string | null = null

  if (commentType === 'question' || commentType === 'inquiry') {
    try {
      const cascade = await runCascade(data.commentText, {
        sessionId: `${platform}-comment-${data.commentId}`,
        flowType:  commentType,
      })
      if (cascade.answered && cascade.answer) {
        // Strip WhatsApp-specific markdown (*bold*, _italic_) for IG/FB comments
        const stripped = cascade.answer.replace(/[*_]/g, '').trim()
        // Truncate to 180 chars, add DM invite
        const short = stripped.length > 180
          ? stripped.slice(0, 177) + '...'
          : stripped
        replyText = `${short}\n\n👉 Tuma DM kwa maelezo zaidi!`
        console.log(`[Social] Comment answered by cascade layer=${cascade.layerAnswered}`)
      }
    } catch (err) {
      console.error('[Social] Cascade for comment failed (non-fatal):', err)
    }
  }

  // Fallback to template if cascade didn't answer (or not question/inquiry type)
  if (!replyText) {
    replyText = getAutoReply(commentType)
  }

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
  // ── Rate limit check — 15 messages per 60 seconds per sender ─────────────
  const rl = await checkRateLimit(data.senderId, platform)
  if (!rl.allowed) {
    console.warn(`[Social] Rate limited: ${platform}:${data.senderId.slice(0, 6)}*** (${rl.currentCount} msgs/min)`)
    return
  }

  // ── Dedup by message ID ───────────────────────────────────────────────────
  if (data.messageId) {
    const { data: existing } = await supabaseAdmin
      .from('social_dms')
      .select('id')
      .eq('message_id', data.messageId)
      .maybeSingle()
    if (existing) return
  }

  // ── Check session status — skip Amina when admin has taken over ───────────
  const session = await getOrCreateSocialSession(platform, data.senderId, data.senderName)
  if (session.status === 'admin') {
    console.log(`[Social] Session in admin mode — Amina silent for ${platform}:${data.senderId.slice(0, 6)}***`)
    // Still save the incoming message for admin context
    await supabaseAdmin.from('social_dms').insert({
      platform,
      sender_id:   data.senderId,
      sender_name: data.senderName ?? null,
      message_id:  data.messageId ?? null,
      message_text: data.messageText,
      reply_sent:  false,
    }).select('id').single()
    return
  }
  if (session.status === 'resolved') {
    // Reopen the session on new message
    await supabaseAdmin
      .from('social_sessions')
      .update({ status: 'amina', resolved_at: null, updated_at: new Date().toISOString() })
      .eq('platform', platform)
      .eq('sender_id', data.senderId)
    console.log(`[Social] Reopened resolved session for ${platform}:${data.senderId.slice(0, 6)}***`)
  }

  // ── Escalation detection before classification ────────────────────────────
  const escalationReason = detectSocialEscalation(data.messageText)
  if (escalationReason) {
    await escalateSocialToAdmin(platform, data.senderId, data.senderName, escalationReason)
    console.log(`[Social] Escalated to pending: ${escalationReason}`)
    // Send acknowledgement
    try {
      const ack = `Naelewa tatizo lako. 🙏 Mfanyakazi wetu atawasiliana nawe hivi karibuni. Asante kwa uvumilivu wako.`
      if (platform === 'instagram') {
        const { sendIGDM } = await import('./metaClient')
        await sendIGDM(data.senderId, ack)
      } else {
        const { sendFBMessage } = await import('./metaClient')
        await sendFBMessage(data.senderId, ack)
      }
    } catch { /* non-fatal */ }
    return
  }

  // Save incoming DM — capture id for reliable update later
  const { data: inserted } = await supabaseAdmin.from('social_dms').insert({
    platform,
    sender_id:   data.senderId,
    sender_name: data.senderName ?? null,
    message_id:  data.messageId ?? null,
    message_text: data.messageText,
    reply_sent:  false,
  }).select('id').single()
  const dmId = inserted?.id as string | undefined

  // ── AI classification gate — runs before Amina ───────────────────────────
  const classCtx = {
    messageId:   data.messageId  ?? `${platform}-${data.senderId}-${Date.now()}`,
    platform,
    senderId:    data.senderId,
    senderName:  data.senderName,
    messageText: data.messageText,
    messageType: 'text',
  }
  const classification = await classifyMessage(classCtx)
  console.log(`[Social] classify=${classification.category} conf=${classification.confidence.toFixed(2)} on ${platform}`)

  if (classification.category === 'spam') {
    await saveClassification(classCtx, classification, 'ignored')
    return
  }

  if (classification.category === 'personal' && classification.shouldNotifyOwner) {
    const classId = await saveClassification(classCtx, classification, 'flagged')
    if (classId) await notifyOwnerPersonalMessage(classCtx, classification, classId)
    console.log('[Social] Personal msg — owner notified, Amina silent')
    return
  }

  if (classification.category === 'unclear' && classification.confidence >= 0.7) {
    const classId = await saveClassification(classCtx, classification, 'flagged')
    if (classId) await notifyOwnerPersonalMessage(classCtx, classification, classId)
    console.log('[Social] Unclear msg — owner notified, Amina silent')
    return
  }

  // Dalali lead detection — fire-and-forget, does not affect reply
  detectDalaliIntent(data.messageText, []).then(signal => {
    if (signal.isDalaliProspect && signal.confidence >= 60) {
      console.log(`[Social] Dalali signal on ${platform}: ${signal.signal} (${signal.confidence}%)`)
      captureDalaliLead({
        socialId: data.senderId,
        name: data.senderName,
        conversationSummary: data.messageText,
        signal: `${platform}: ${signal.signal}`,
        confidence: signal.confidence,
        source: platform === 'instagram' ? 'instagram_amina' : 'facebook_amina',
      }).catch(err => console.error('[Social] Lead capture failed:', err))
    }
  }).catch(() => { /* non-fatal */ })

  // ── Knowledge cascade (same layers as WhatsApp) ───────────────────────────
  // Social DMs have no phone number, so maintenance actions won't fire,
  // but cache, KB, search, viewing, and subscription layers all work.
  let replyText: string
  try {
    const cascade = await runCascade(data.messageText, {
      sessionId: `${platform}-${data.senderId}`,
      flowType:  classification.subCategory,
    })
    console.log(`[Social] cascade answered=${cascade.answered} conf=${cascade.confidence.toFixed(3)} layer=${cascade.layerAnswered}`)

    if (cascade.answered) {
      replyText = cascade.answer
      // Cache for future identical DMs on any platform
      cacheAminaAnswer(data.messageText, replyText)
      void saveClassification(classCtx, classification, 'kb_answered', replyText).catch(() => null)
    } else {
      // Pass KB context to Amina so she has factual grounding
      const kbContext = formatKBContext(cascade.retrieved)

      // Force social DMs into customer_care flow — never show the guided menu
      const chatSession = await getOrCreateSession(platform, data.senderId, undefined, data.senderName)
      if (chatSession.flow_type !== 'customer_care') {
        await updateSession(chatSession.id, {
          flow_type: 'customer_care',
          flow_step:  'care_active',
          flow_data:  {},
        })
      }

      replyText = await handleIncomingMessage(
        platform,
        data.senderId,
        data.messageText,
        undefined,
        data.senderName,
        undefined,
        undefined,
        kbContext,
      )

      // Cache and log Amina's response
      cacheAminaAnswer(data.messageText, replyText)
      void logMiss(data.messageText, 'amina', {
        sessionId:    `${platform}-${data.senderId}`,
        invokedAmina: true,
        aminaResponse: replyText.slice(0, 500),
      }).catch(() => null)
      void saveClassification(classCtx, classification, 'auto_replied', replyText).catch(() => null)
    }
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

    // Update by DB id (most reliable) or message_id fallback
    if (dmId) {
      await supabaseAdmin
        .from('social_dms')
        .update({ reply_sent: true, reply_text: replyText, replied_at: new Date().toISOString() })
        .eq('id', dmId)
    } else if (data.messageId) {
      await supabaseAdmin
        .from('social_dms')
        .update({ reply_sent: true, reply_text: replyText, replied_at: new Date().toISOString() })
        .eq('message_id', data.messageId)
    }

    console.log(`[Social] DM replied on ${platform} to ${data.senderId.slice(0, 6)}***`)
  } catch (err) {
    console.error('[Social] DM send failed:', err)
  }
}
