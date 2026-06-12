import { NextRequest, NextResponse } from 'next/server'
import { handleWhatsAppMessage } from '@/lib/whatsapp/aminaHandler'
import { markAsRead, sendMultipartMessage, formatPhoneNumber } from '@/lib/whatsapp/client'

// ── Types ─────────────────────────────────────────────────────────────────

interface WATextMessage {
  id: string
  from: string
  timestamp: string
  type: 'text'
  text: { body: string }
}

interface WAMediaMessage {
  id: string
  from: string
  timestamp: string
  type: 'image' | 'audio' | 'video' | 'document'
  image?:    { caption?: string; mime_type: string; sha256: string; id: string }
  audio?:    { mime_type: string; sha256: string; id: string; voice: boolean }
  video?:    { caption?: string; mime_type: string; sha256: string; id: string }
  document?: { caption?: string; mime_type: string; sha256: string; id: string }
}

interface WALocationMessage {
  id: string
  from: string
  timestamp: string
  type: 'location'
  location: { latitude: number; longitude: number; name?: string; address?: string }
}

interface WAInteractiveMessage {
  id: string
  from: string
  timestamp: string
  type: 'interactive'
  interactive: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?:   { id: string; title: string; description?: string }
  }
}

type WAMessage = WATextMessage | WAMediaMessage | WALocationMessage | WAInteractiveMessage

interface WAContact {
  profile: { name: string }
  wa_id: string
}

interface WAChange {
  value: {
    messaging_product: string
    metadata: { display_phone_number: string; phone_number_id: string }
    contacts?: WAContact[]
    messages?: WAMessage[]
    statuses?: unknown[]
    errors?:   unknown[]
  }
  field: string
}

interface WAWebhookPayload {
  object: string
  entry?: Array<{
    id: string
    changes: WAChange[]
  }>
}

// ── GET — Meta webhook verification ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode      = params.get('hub.mode')
  const token     = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[WA webhook] WHATSAPP_VERIFY_TOKEN haijawekwa')
    return new NextResponse('Server error', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WA webhook] Verification OK')
    return new NextResponse(challenge, { status: 200 })
  }

  // Log full received token so we can diagnose mismatches
  console.warn('[WA webhook] Verification FAILED', {
    mode,
    received_token: token ?? '(empty)',
    expected_prefix: verifyToken.slice(0, 10) + '…',
    match: token === verifyToken,
  })
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST — Incoming messages ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // CRITICAL: Always return 200. Meta will retry on any non-200 → infinite loop.
  try {
    const payload = await req.json() as WAWebhookPayload

    // Ignore non-WhatsApp objects (safety check)
    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const entries = payload.entry ?? []

    for (const entry of entries) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue

        const { messages, contacts } = change.value
        if (!messages?.length) continue

        for (const message of messages) {
          // Process fire-and-forget — don't await entire chain before returning 200
          processMessage(message, contacts ?? []).catch(err => {
            console.error('[WA webhook] processMessage error:', err)
          })
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 })

  } catch (err) {
    // Log but always return 200 so Meta doesn't retry
    console.error('[WA webhook] POST error:', err)
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}

// ── Message processor (runs async, after 200 is returned) ─────────────────

async function processMessage(message: WAMessage, contacts: WAContact[]): Promise<void> {
  const from        = formatPhoneNumber(message.from)
  const messageId   = message.id
  const profileName = contacts.find(c => c.wa_id === message.from)?.profile?.name

  // Acknowledge receipt immediately (shows ticks in WhatsApp)
  await markAsRead(messageId)

  // Extract text from the message based on type
  const text = extractText(message)

  if (!text) {
    console.log('[WA webhook] Non-text message type ignored:', message.type, from)
    return
  }

  console.log('[WA webhook] Processing message from', from.slice(0, 6) + '****:', text.slice(0, 80))

  const response = await handleWhatsAppMessage(from, text, messageId, profileName)

  // Empty response = duplicate message or stop command with no reply needed
  if (!response) return

  await sendMultipartMessage(from, response)
}

// ── Extract text from any message type ───────────────────────────────────

function extractText(message: WAMessage): string {
  switch (message.type) {
    case 'text':
      return message.text.body.trim()

    case 'interactive': {
      const m = message as WAInteractiveMessage
      const btn  = m.interactive.button_reply
      const list = m.interactive.list_reply
      if (btn)  return btn.title
      if (list) return list.title
      return ''
    }

    case 'location': {
      const m   = message as WALocationMessage
      const loc = m.location
      const name = loc.name ? ` (${loc.name})` : ''
      return `[Location] ${loc.latitude},${loc.longitude}${name}`
    }

    case 'image': {
      const m = message as WAMediaMessage
      const caption = m.image?.caption
      return caption ? `[Picha] ${caption}` : '[Picha imetumwa]'
    }

    case 'audio':
      return '[Sauti imetumwa — tafadhali andika ujumbe wako kwa maandishi]'

    case 'video': {
      const m = message as WAMediaMessage
      const caption = m.video?.caption
      return caption ? `[Video] ${caption}` : '[Video imetumwa]'
    }

    case 'document': {
      const m = message as WAMediaMessage
      const caption = m.document?.caption
      return caption ? `[Faili] ${caption}` : '[Faili imetumwa]'
    }

    default:
      return ''
  }
}
