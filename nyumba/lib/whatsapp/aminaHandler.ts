import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { handleIncomingMessage } from '@/lib/chat/aiAgent'
import { sanitiseForWhatsApp } from '@/lib/whatsapp/client'
import {
  getOrCreateWASession,
  updateWASession,
  saveWAMessage,
  getAminaInstructions,
  detectEscalation,
} from '@/lib/whatsapp/sessionManager'
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

// Returns true when the user is mid-way through a guided multi-step flow
// (dalali registration or listing submission). The cascade must not
// intercept these flows — every step needs Amina's deterministic handlers.
async function isInGuidedFlow(phone: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('chat_sessions')
    .select('flow_type, flow_step')
    .eq('platform', 'whatsapp')
    .eq('user_id', phone)
    .maybeSingle()
  if (!data) return false
  return (
    data.flow_type === 'dalali_register' ||
    data.flow_type === 'dalali_listing'
  )
}

// ── Deduplication (uses existing whatsapp_conversations for dedup key) ────────

export async function isMessageProcessed(messageId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle()
  return !!data
}

async function saveConversationEntry(
  phoneNumber: string,
  role: 'user' | 'assistant',
  content: string,
  messageId?: string,
): Promise<void> {
  await supabaseAdmin.from('whatsapp_conversations').insert({
    phone_number: phoneNumber,
    role,
    content,
    message_id: messageId ?? null,
  })
}

// ── Special command detection ──────────────────────────────────────────────────

type SpecialCommand = 'reset' | 'help' | 'human_agent' | 'stop' | null

function detectSpecialCommand(text: string): SpecialCommand {
  const lower = text.toLowerCase().trim()
  if (['anza upya', 'reset', 'start over', 'anzisha'].includes(lower)) return 'reset'
  if (['msaada', 'help', '?'].includes(lower)) return 'help'
  if (['agent', 'mtu', 'binadamu', 'admin', 'human'].includes(lower)) return 'human_agent'
  if (['stop', 'unsubscribe', 'acha'].includes(lower)) return 'stop'
  return null
}

// ── Static responses ───────────────────────────────────────────────────────────

const HELP_MESSAGE = `Habari! Mimi ni *Amina* msaidizi wa NyumbaFasta 🏠

Ninaweza kukusaidia na:

1 - Tafuta Nyumba/Chumba
2 - Jiunge kama Dalali
3 - Post Nyumba yako
4 - Msaada wa Akaunti au Malipo

Andika namba moja ya chaguo lako, au niambie tu unachohitaji!

_Mfano: "Natafuta chumba Kinondoni" au "Nataka kupost listing"_`

const RESET_MESSAGE = `Sawa! Tunaanza upya. 🔄

Habari! Mimi ni *Amina* msaidizi wa NyumbaFasta.

Ninaweza kukusaidia:
1 - Tafuta Nyumba/Chumba
2 - Jiunge kama Dalali
3 - Post Nyumba yako
4 - Msaada/Maswali

Unahitaji nini leo?`

const ESCALATION_MESSAGE = `Naelewa tatizo lako na ninaomba msamaha kwa usumbufu. 🙏

Ninakuunganisha na msaada wa moja kwa moja sasa hivi.

Admin wa NyumbaFasta atawasiliana nawe hivi karibuni.
Wakati wa kujibu: Ndani ya saa 1 (saa za kazi: 8am — 8pm)

Asante kwa uvumilivu wako. 🙏`

// Note: HUMAN_AGENT_MESSAGE superseded by ESCALATION_MESSAGE for command='human_agent'

const STOP_MESSAGE = `Umekusimamishwa kwa arifa za NyumbaFasta.

Ukitaka kuendelea kupata msaada, andika ujumbe wowote hapa.

Asante! 🙏`

const PENDING_ACKNOWLEDGEMENT = `Ujumbe wako umepokewa. Admin atawasiliana nawe hivi karibuni. 🙏`

// ── Session reset ─────────────────────────────────────────────────────────────

async function resetSession(phoneNumber: string): Promise<void> {
  await supabaseAdmin
    .from('chat_sessions')
    .update({ flow_type: 'client', flow_step: 'greeting', flow_data: {} })
    .eq('platform', 'whatsapp')
    .eq('user_id', phoneNumber)
}

// ── Escalate to admin ─────────────────────────────────────────────────────────

async function escalateToAdmin(
  phone: string,
  profileName: string | undefined,
  reason: string,
): Promise<void> {
  await updateWASession(phone, {
    status: 'pending',
    escalation_reason: reason,
    escalated_at: new Date().toISOString(),
  })

  const nameLabel = profileName ? ` (${profileName})` : ''
  console.log(`[Amina] Escalated ${phone.slice(0, 5)}****${nameLabel} → reason: ${reason}`)

  // System message recorded in the admin panel for context
  await saveWAMessage(
    phone,
    'outbound',
    'system',
    `Mazungumzo yameandikishwa kwa msaada wa mtu. Sababu: ${reason}`,
  )

  // Notify admin via notifications table
  void Promise.resolve(
    supabaseAdmin.from('notifications').insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      title:   'WhatsApp: Mteja anahitaji msaada wa mtu',
      body:    `Nambari: ${phone.slice(0, 5)}****${nameLabel}. Sababu: "${reason}"`,
      type:    'support_request',
      is_read: false,
    }),
  )
}

// ── Main handler (called from webhook for 'amina' status sessions) ────────────

export async function handleWhatsAppMessage(
  from: string,
  messageText: string,
  messageId: string,
  profileName?: string,
): Promise<string> {
  const t0 = Date.now()

  // 1. Rate limiting — 15 messages per 60 seconds per number
  const rl = await checkRateLimit(from, 'whatsapp')
  if (!rl.allowed) {
    console.warn(`[Amina] Rate limited: ${from.slice(0, 5)}**** (${rl.currentCount} msgs/min)`)
    return ''
  }

  // 2. Deduplication — Meta delivers webhooks at least once
  if (await isMessageProcessed(messageId)) {
    console.log('[Amina] Duplicate skipped:', messageId)
    return ''
  }
  console.log(`[Amina] dedup done (${Date.now() - t0}ms)`)

  // 2. Ensure WA session exists and update last_message_at
  await getOrCreateWASession(from)

  // 3. Save user message to both tables in parallel
  await Promise.all([
    saveConversationEntry(from, 'user', messageText, messageId),
    saveWAMessage(from, 'inbound', 'user', messageText, messageId),
  ])
  console.log(`[Amina] user saved (${Date.now() - t0}ms)`)

  let response: string

  // 4. Special commands take priority
  const command = detectSpecialCommand(messageText)

  if (command === 'reset') {
    await resetSession(from)
    response = RESET_MESSAGE

  } else if (command === 'help') {
    response = HELP_MESSAGE

  } else if (command === 'human_agent') {
    await escalateToAdmin(from, profileName, 'Mteja aliomba msaada wa mtu moja kwa moja')
    void logMiss(messageText, 'handover', { phoneNumber: from, handoverTriggered: true })
    response = ESCALATION_MESSAGE

  } else if (command === 'stop') {
    response = STOP_MESSAGE

  } else {
    // 5. Check for escalation keywords
    const escalationReason = detectEscalation(messageText)
    if (escalationReason) {
      await escalateToAdmin(from, profileName, escalationReason)
      void logMiss(messageText, 'handover', { phoneNumber: from, handoverTriggered: true })
      response = ESCALATION_MESSAGE
    } else {
      // 5b. AI message classification — gate before Amina
      const classCtx = {
        messageId:   messageId,
        platform:    'whatsapp' as const,
        senderPhone: from,
        senderName:  profileName,
        messageText,
        messageType: 'text',
      }
      const classification = await classifyMessage(classCtx)
      console.log(`[Amina] classify=${classification.category} conf=${classification.confidence.toFixed(2)}`)

      if (classification.category === 'spam') {
        await saveClassification(classCtx, classification, 'ignored')
        console.log('[Amina] Spam ignored:', from.slice(0, 5) + '****')
        return ''
      }

      if (classification.category === 'personal' && classification.shouldNotifyOwner) {
        const classId = await saveClassification(classCtx, classification, 'flagged')
        if (classId) await notifyOwnerPersonalMessage(classCtx, classification, classId)
        console.log('[Amina] Personal msg — owner notified, Amina silent')
        return ''
      }

      if (classification.category === 'unclear' && classification.confidence >= 0.7) {
        // High-confidence unclear means it's likely NOT a business message
        const classId = await saveClassification(classCtx, classification, 'flagged')
        if (classId) await notifyOwnerPersonalMessage(classCtx, classification, classId)
        console.log('[Amina] Unclear (high conf) — owner notified, Amina silent')
        return ''
      }

      // category === 'nyumbafasta' (or unclear with low confidence) → try cascade first
      // 6. Guard: skip cascade when user is mid guided flow (dalali_register / dalali_listing)
      const guidedFlow = await isInGuidedFlow(from)
      console.log(`[Amina] guidedFlow=${guidedFlow} (${Date.now() - t0}ms)`)

      let kbContextForAmina: string | undefined

      if (!guidedFlow) {
        // Resolve org_id from active lease for vendor search context
        let tenantOrgId: string | undefined
        try {
          const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('id')
            .ilike('phone', `%${from.replace(/^\+/, '').slice(-9)}%`)
            .maybeSingle()
          if (userRow?.id) {
            const { data: lease } = await supabaseAdmin
              .from('leases')
              .select('org_id')
              .eq('user_id', userRow.id)
              .eq('status', 'active')
              .maybeSingle()
            tenantOrgId = lease?.org_id ?? undefined
          }
        } catch { /* non-fatal — vendor search works without org_id */ }

        // 6a. Run knowledge cascade: cache → search → action → knowledge_base
        const cascade = await runCascade(messageText, {
          phoneNumber: from,
          flowType:    classification.subCategory,
          orgId:       tenantOrgId,
        })
        console.log(`[Amina] cascade answered=${cascade.answered} conf=${cascade.confidence.toFixed(3)} layer=${cascade.layerAnswered}`)

        if (cascade.answered) {
          response = cascade.answer
          void saveClassification(classCtx, classification, 'kb_answered', response).catch(() => null)
          // Skip straight to sanitise + save — no Amina call needed
          const clean = sanitiseForWhatsApp(response)
          await Promise.all([
            saveConversationEntry(from, 'assistant', clean),
            saveWAMessage(from, 'outbound', 'amina', clean),
          ])
          console.log(`[Amina] KB answered total=${Date.now() - t0}ms`)
          return clean
        }

        // Cascade didn't answer — pass retrieved KB snippets to Amina as context
        kbContextForAmina = formatKBContext(cascade.retrieved)
        if (kbContextForAmina) {
          console.log(`[Amina] KB context injected (${cascade.retrieved.length} items)`)
        }
      }

      // 7. Fetch any admin instructions for this conversation
      const adminInstructions = await getAminaInstructions(from)
      console.log(`[Amina] instructions fetched (${Date.now() - t0}ms), has=${!!adminInstructions}`)

      // 7b. Dalali lead detection — fire-and-forget
      detectDalaliIntent(messageText, []).then(signal => {
        if (signal.isDalaliProspect && signal.confidence >= 60) {
          console.log(`[Amina] Dalali signal detected: ${signal.signal} (${signal.confidence}%)`)
          captureDalaliLead({
            phoneNumber: from,
            name: profileName,
            conversationSummary: messageText,
            signal: signal.signal,
            confidence: signal.confidence,
            source: 'whatsapp_amina',
          }).catch(err => console.error('[Amina] Lead capture failed:', err))
        }
      }).catch(() => { /* non-fatal */ })

      // 8. Route through Amina's full AI flow (with KB context injected)
      console.log(`[Amina] calling handleIncomingMessage (${Date.now() - t0}ms)`)
      response = await handleIncomingMessage(
        'whatsapp',
        from,
        messageText,
        from,
        profileName,
        undefined,
        adminInstructions || undefined,
        kbContextForAmina,
      )
      console.log(`[Amina] AI done (${Date.now() - t0}ms)`)

      // Cache Amina's answer so the same question is answered from KB next time
      cacheAminaAnswer(messageText, response)

      // Log that Amina was invoked (updates cascade analytics)
      void logMiss(messageText, 'amina', {
        phoneNumber:      from,
        invokedAmina:     true,
        aminaResponse:    response.slice(0, 500),
        handoverTriggered: false,
      }).catch(() => null)

      // Save classification record for analytics (fire-and-forget)
      void saveClassification(classCtx, classification, 'auto_replied', response).catch(() => null)
    }
  }

  // 8. Sanitise markdown for WhatsApp
  const clean = sanitiseForWhatsApp(response)

  // 9. Save assistant response to both tables
  await Promise.all([
    saveConversationEntry(from, 'assistant', clean),
    saveWAMessage(from, 'outbound', 'amina', clean),
  ])
  console.log(`[Amina] done total=${Date.now() - t0}ms`)

  return clean
}

// ── Acknowledgement for 'pending' sessions ────────────────────────────────────
// Called from webhook when session.status === 'pending'
export { PENDING_ACKNOWLEDGEMENT }
