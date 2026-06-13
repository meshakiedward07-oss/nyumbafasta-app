import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { handleWhatsAppMessage, PENDING_ACKNOWLEDGEMENT } from '@/lib/whatsapp/aminaHandler'
import { markAsRead, sendMultipartMessage, sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'
import { getWASession, saveWAMessage } from '@/lib/whatsapp/sessionManager'

function verifyWhatsAppSignature(rawBody: Buffer, sigHeader: string): boolean {
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) return false
  const [algo, sig] = sigHeader.split('=')
  if (algo !== 'sha256' || !sig) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return expected === sig
}

// Give the function enough headroom for detectIntent (Claude ~4s) + send (~1s)
// On Vercel Pro this raises the cap; on Hobby it's still 10s but declares intent.
export const maxDuration = 60

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
  // CRITICAL: Always return 200. Meta retries on any non-200 → duplicate messages.
  const t0 = Date.now()
  try {
    const rawBuffer = Buffer.from(await req.arrayBuffer())

    // Verify HMAC signature — Meta always sends X-Hub-Signature-256 on real events
    const sigHeader = req.headers.get('x-hub-signature-256') ?? ''
    if (!sigHeader || !verifyWhatsAppSignature(rawBuffer, sigHeader)) {
      console.warn('[WA webhook] Signature verification failed — ignoring request')
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const payload = JSON.parse(rawBuffer.toString()) as WAWebhookPayload

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    const entries = payload.entry ?? []
    const jobs: Array<Promise<void>> = []

    for (const entry of entries) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue

        const { messages, contacts } = change.value
        if (!messages?.length) continue

        for (const message of messages) {
          // Process synchronously so Vercel doesn't kill the task after response.
          // Meta waits up to 20 s; our chain typically takes 5-8 s.
          jobs.push(processMessage(message, contacts ?? []))
        }
      }
    }

    if (jobs.length > 0) {
      // Await all messages; allSettled ensures we never throw even if one fails.
      const results = await Promise.allSettled(jobs)
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[WA webhook] processMessage[${i}] failed:`, r.reason)
        }
      })
    }

    console.log(`[WA webhook] POST done in ${Date.now() - t0}ms, jobs=${jobs.length}`)
    return NextResponse.json({ status: 'ok' }, { status: 200 })

  } catch (err) {
    console.error('[WA webhook] POST error:', err)
    return NextResponse.json({ status: 'error' }, { status: 200 })
  }
}

// ── Message processor ─────────────────────────────────────────────────────

async function processMessage(message: WAMessage, contacts: WAContact[]): Promise<void> {
  const t0          = Date.now()
  const from        = formatPhoneNumber(message.from)
  const messageId   = message.id
  const profileName = contacts.find(c => c.wa_id === message.from)?.profile?.name
  const masked      = from.slice(0, 5) + '****'

  console.log(`[WA] → message from ${masked} type=${message.type} id=${messageId}`)

  // Mark read immediately (shows double-ticks in WhatsApp)
  await markAsRead(messageId)

  const text = extractText(message)
  if (!text) {
    console.log(`[WA] Non-text ignored: type=${message.type}`)
    return
  }

  // ── Check handoff status ────────────────────────────────────
  const waSession = await getWASession(from)

  if (waSession?.status === 'admin') {
    // Admin has taken over — save inbound message for admin panel, don't call Amina
    await saveWAMessage(from, 'inbound', 'user', text, messageId)
    console.log(`[WA] Admin mode — message saved, Amina silent for ${masked}`)
    return
  }

  if (waSession?.status === 'pending') {
    // Waiting for admin — acknowledge user, save message
    await saveWAMessage(from, 'inbound', 'user', text, messageId)
    await sendTextMessage(from, PENDING_ACKNOWLEDGEMENT)
    console.log(`[WA] Pending mode — ack sent to ${masked}`)
    return
  }

  // ── Amina handles ('amina' | 'resolved' | no session) ──────
  console.log(`[WA] text="${text.slice(0, 80)}"`)

  const t1 = Date.now()
  const response = await handleWhatsAppMessage(from, text, messageId, profileName)
  console.log(`[WA] Amina done (${Date.now() - t1}ms), reply=${response ? response.length + ' chars' : 'empty'}`)

  if (!response) return

  const t2 = Date.now()
  await sendMultipartMessage(from, response)
  console.log(`[WA] sent (${Date.now() - t2}ms), total=${Date.now() - t0}ms for ${masked}`)
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
