import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { handleIncomingMessage } from '@/lib/chat/aiAgent'
import { sanitiseForWhatsApp } from '@/lib/whatsapp/client'

// ── Deduplication ──────────────────────────────────────────────────────────

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

// ── Special command detection ──────────────────────────────────────────────

type SpecialCommand = 'reset' | 'help' | 'human_agent' | 'stop' | null

function detectSpecialCommand(text: string): SpecialCommand {
  const lower = text.toLowerCase().trim()
  if (['anza upya', 'reset', 'start over', 'anzisha'].includes(lower)) return 'reset'
  if (['msaada', 'help', '?'].includes(lower)) return 'help'
  if (['agent', 'mtu', 'binadamu', 'admin', 'human'].includes(lower)) return 'human_agent'
  if (['stop', 'unsubscribe', 'acha'].includes(lower)) return 'stop'
  return null
}

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

const HUMAN_AGENT_MESSAGE = `Sawa! Nitakuunganisha na timu yetu ya msaada. 🙏

Wasiliana nasi moja kwa moja:
📞 WhatsApp: +255665831694

Tunafanya kazi Jumatatu-Ijumaa, 8:00-18:00.

Kama ni dharura, tuma ujumbe hapa na tutajibu haraka iwezekanavyo! 😊`

const STOP_MESSAGE = `Umekusimamishwa kwa arifa za NyumbaFasta.

Ukitaka kuendelea kupata msaada, andika ujumbe wowote hapa.

Asante! 🙏`

// ── Clear session for reset ────────────────────────────────────────────────

async function resetSession(phoneNumber: string): Promise<void> {
  await supabaseAdmin
    .from('chat_sessions')
    .update({ flow_type: 'client', flow_step: 'greeting', flow_data: {} })
    .eq('platform', 'whatsapp')
    .eq('user_id', phoneNumber)
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function handleWhatsAppMessage(
  from: string,
  messageText: string,
  messageId: string,
  profileName?: string,
): Promise<string> {

  // 1. Deduplication — Meta delivers webhooks at least once
  if (await isMessageProcessed(messageId)) {
    console.log('[Amina] Duplicate message skipped:', messageId)
    return ''   // empty = caller should not reply again
  }

  // 2. Save user message for dedup + audit
  await saveConversationEntry(from, 'user', messageText, messageId)

  let response: string

  // 3. Check for special commands first
  const command = detectSpecialCommand(messageText)

  switch (command) {
    case 'reset': {
      await resetSession(from)
      response = RESET_MESSAGE
      break
    }
    case 'help': {
      response = HELP_MESSAGE
      break
    }
    case 'human_agent': {
      response = HUMAN_AGENT_MESSAGE
      // Notify admin (fire-and-forget)
      void Promise.resolve(supabaseAdmin.from('notifications').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        title:   'WhatsApp: Mteja anataka msaada wa mtu',
        body:    `Nambari: ${from}${profileName ? ` (${profileName})` : ''}. Ujumbe: "${messageText}"`,
        type:    'support_request',
        is_read: false,
        data:    { phone: from, message: messageText },
      }))
      break
    }
    case 'stop': {
      response = STOP_MESSAGE
      break
    }
    default: {
      // 4. Route through Amina's full AI flow
      response = await handleIncomingMessage(
        'whatsapp',
        from,              // userId = phone number
        messageText,
        from,              // phone
        profileName,       // name (from WhatsApp profile)
      )
    }
  }

  // 5. Sanitise markdown for WhatsApp rendering
  const clean = sanitiseForWhatsApp(response)

  // 6. Save assistant response to audit log
  await saveConversationEntry(from, 'assistant', clean)

  return clean
}
