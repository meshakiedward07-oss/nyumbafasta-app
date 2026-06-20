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
      data:    { phone, reason, escalated_at: new Date().toISOString() },
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

  // 1. Deduplication — Meta delivers webhooks at least once
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
    response = ESCALATION_MESSAGE

  } else if (command === 'stop') {
    response = STOP_MESSAGE

  } else {
    // 5. Check for escalation keywords
    const escalationReason = detectEscalation(messageText)
    if (escalationReason) {
      await escalateToAdmin(from, profileName, escalationReason)
      response = ESCALATION_MESSAGE
    } else {
      // 6. Fetch any admin instructions for this conversation
      const adminInstructions = await getAminaInstructions(from)
      console.log(`[Amina] instructions fetched (${Date.now() - t0}ms), has=${!!adminInstructions}`)

      // 6b. Dalali lead detection — runs before Amina replies, capture is fire-and-forget
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

      // 7. Route through Amina's full AI flow
      console.log(`[Amina] calling handleIncomingMessage (${Date.now() - t0}ms)`)
      response = await handleIncomingMessage(
        'whatsapp',
        from,
        messageText,
        from,
        profileName,
        undefined,
        adminInstructions || undefined,
      )
      console.log(`[Amina] AI done (${Date.now() - t0}ms)`)
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
