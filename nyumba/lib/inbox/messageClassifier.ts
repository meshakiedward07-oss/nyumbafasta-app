import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface MessageContext {
  messageId:    string
  platform:     'whatsapp' | 'instagram' | 'facebook' | 'tiktok'
  senderPhone?: string
  senderName?:  string
  senderId?:    string
  messageText:  string
  messageType?: string
  rawWebhook?:  Record<string, unknown>
}

export interface ClassificationResult {
  category:           'nyumbafasta' | 'personal' | 'spam' | 'unclear'
  confidence:         number  // 0.0 – 1.0
  reason:             string
  subCategory:        string
  shouldAutoReply:    boolean
  shouldNotifyOwner:  boolean
}

// ── AI classifier ─────────────────────────────────────────────────────────────

export async function classifyMessage(
  ctx: MessageContext,
): Promise<ClassificationResult> {
  const prompt = `Wewe ni msaidizi wa kuchunguza ujumbe wa WhatsApp na social media kwa biashara ya NyumbaFasta Tanzania (nyumbafasta.co).

Biashara hii ni mfumo wa mtandaoni wa mali isiyohamia Tanzania — unaowasiliana na madalali (real estate agents), wateja wanaotafuta nyumba, na watu wanaopenda kujisajili.

Ujumbe ulioingia:
Platform: ${ctx.platform}
Mtumaji: ${ctx.senderName ?? 'Haijulikani'}
Ujumbe: "${ctx.messageText}"

Chunguza ujumbe huu na uamue:

1. KATEGORIA (chagua moja tu):
   - "nyumbafasta" = ujumbe unaohusiana na biashara:
     * Kutafuta nyumba, apartment, chumba
     * Kutaka kujisajili kama dalali
     * Kuuliza bei, mahali, au listing
     * Malalamiko au maswali ya huduma
     * Malipo au subscription
     * Kutaka kuona listing
     * Maswali ya jinsi mfumo unavyofanya kazi
     * Uthibitisho wa listing iliyoidhinishwa

   - "personal" = ujumbe wa kibinafsi kwa mmiliki wa biashara:
     * Salamu za kibinafsi (jamaa, marafiki)
     * Mazungumzo ya familia au ndugu
     * Mialiko ya harusi, sherehe, matukio
     * Ujumbe kutoka kwa marafiki wa karibu
     * Mambo ya kibinafsi yasiyohusiana na biashara
     * Ujumbe kwa jina la mmiliki moja kwa moja (Mesha, nk)
     * Maswali ya kibinafsi yasiyohusiana na nyumba
     * Pongezi za kibinafsi, siku ya kuzaliwa, nk

   - "spam" = ujumbe wa spam au matangazo:
     * Matangazo yasiyohusiana na nyumba
     * Ujumbe wa ulaghai au scam
     * Mauzo ya vitu visivyohusiana (dawa, nguo, nk)
     * Forward messages za kawaida za WhatsApp
     * Ujumbe wa kisiasa au dini usiohusiana

   - "unclear" = haiwezekani kujua bila habari zaidi
     * Neno moja tu bila muktadha
     * Salamu fupi ambazo zinaweza kuwa biashara au kibinafsi

2. CONFIDENCE (0.0 hadi 1.0):
   Uwezekano wa uhakika wa uamuzi wako

3. REASON: Kwa nini umechagua kategoria hii (Kiswahili, sentensi moja fupi)

4. SUB_CATEGORY:
   Kwa "nyumbafasta": listing_inquiry | registration | payment | complaint | greeting_business | listing_approval | general_inquiry
   Kwa "personal": family | friend | social_event | personal_greeting | other_personal
   Kwa "spam": advertisement | scam | forward | other_spam
   Kwa "unclear": needs_more_info

Jibu kwa JSON PEKE YAKE bila maelezo mengine:
{"category":"nyumbafasta","confidence":0.95,"reason":"Mtumiaji anauliza kuhusu listing ya nyumba","sub_category":"listing_inquiry"}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const result = JSON.parse(clean) as {
      category: ClassificationResult['category']
      confidence: number
      reason: string
      sub_category: string
    }

    const category   = result.category
    const confidence = Math.min(1, Math.max(0, parseFloat(String(result.confidence)) || 0.8))

    return {
      category,
      confidence,
      reason:            result.reason ?? '',
      subCategory:       result.sub_category ?? '',
      shouldAutoReply:   category === 'nyumbafasta' && confidence >= 0.6,
      shouldNotifyOwner: category === 'personal'    && confidence >= 0.5,
    }
  } catch (err) {
    console.error('[Classifier] AI error:', err)
    // Fail open: let Amina handle unclear cases, don't block business messages
    return {
      category:          'nyumbafasta',
      confidence:        0.0,
      reason:            'AI imeshindwa kuchunguza — kuendelea kwa Amina',
      subCategory:       'general_inquiry',
      shouldAutoReply:   true,
      shouldNotifyOwner: false,
    }
  }
}

// ── Save classification to DB ─────────────────────────────────────────────────

export async function saveClassification(
  ctx:            MessageContext,
  result:         ClassificationResult,
  action:         string,
  autoReplySent?: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('message_classifications')
      .insert({
        message_id:       ctx.messageId,
        platform:         ctx.platform,
        sender_phone:     ctx.senderPhone   ?? null,
        sender_name:      ctx.senderName    ?? null,
        sender_id:        ctx.senderId      ?? null,
        message_text:     ctx.messageText,
        message_type:     ctx.messageType   ?? 'text',
        category:         result.category,
        confidence:       result.confidence,
        reason:           result.reason,
        sub_category:     result.subCategory,
        action,
        auto_reply_sent:  autoReplySent     ?? null,
        flagged_at:       result.shouldNotifyOwner ? new Date().toISOString() : null,
        raw_webhook:      ctx.rawWebhook    ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Classifier] DB save error:', error.message)
      return null
    }
    return (data?.id as string) ?? null
  } catch (err) {
    console.error('[Classifier] DB save exception:', err)
    return null
  }
}

// ── Notify owner about personal message ──────────────────────────────────────

export async function notifyOwnerPersonalMessage(
  ctx:              MessageContext,
  result:           ClassificationResult,
  classificationId: string,
): Promise<void> {
  const rawOwnerPhone = process.env.ADMIN_WHATSAPP_NUMBER
  if (!rawOwnerPhone) {
    console.error('[Classifier] ADMIN_WHATSAPP_NUMBER haijawekwa')
    return
  }

  try {
    const { sendTextMessage, formatPhoneNumber } = await import('@/lib/whatsapp/client')
    const ownerPhone = formatPhoneNumber(rawOwnerPhone)

    const platformEmoji: Record<string, string> = {
      whatsapp:  '💬',
      instagram: '📸',
      facebook:  '👥',
      tiktok:    '🎵',
    }
    const emoji = platformEmoji[ctx.platform] ?? '💬'
    const phoneInfo = ctx.senderPhone ? `\n📞 Namba: ${ctx.senderPhone}` : ''
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

    const notification = `${emoji} *Ujumbe wa Kibinafsi Umeingia*

👤 Mtumaji: ${ctx.senderName ?? 'Haijulikani'}${phoneInfo}
📱 Platform: ${ctx.platform}

💬 Ujumbe:
"${ctx.messageText.slice(0, 300)}"

🤖 _Amina hakujibu — ujumbe huu ni wa kibinafsi_
💡 Sababu: ${result.reason}

👉 *Jibu mwenyewe kupitia inbox:*
${appUrl}/admin/inbox`

    await sendTextMessage(ownerPhone, notification)

    // Mark as owner notified in DB
    await supabaseAdmin
      .from('message_classifications')
      .update({ owner_notified_at: new Date().toISOString() })
      .eq('id', classificationId)

    console.log('[Classifier] Owner notified for personal msg from:', ctx.senderName ?? ctx.senderPhone ?? ctx.senderId)
  } catch (err) {
    console.error('[Classifier] Owner notification failed (non-fatal):', err)
  }
}
