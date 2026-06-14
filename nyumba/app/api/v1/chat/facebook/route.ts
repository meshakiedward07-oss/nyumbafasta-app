import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage, Platform } from '@/lib/chat/aiAgent'

export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN ?? process.env.META_WEBHOOK_VERIFY_TOKEN
const HOUSE_RE = /nyumba|chumba|apartment|inapangishwa|rent|bei|location|mtaa/i

function verifySignature(rawBody: Buffer, sigHeader: string): boolean {
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) return false
  const [algo, sig] = sigHeader.split('=')
  if (algo !== 'sha256' || !sig) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return expected === sig
}

// ── Facebook webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!VERIFY_TOKEN) {
    console.error('[FBWebhook] FB_VERIFY_TOKEN haijawekwa')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── Incoming events ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBuffer = Buffer.from(await req.arrayBuffer())
  const sigHeader = req.headers.get('x-hub-signature-256') ?? ''

  if (!sigHeader || !verifySignature(rawBuffer, sigHeader)) {
    console.warn('[FBWebhook] Signature verification failed — ignoring request')
    return NextResponse.json({ status: 'ok' })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBuffer.toString())
  } catch {
    return NextResponse.json({ status: 'ok' })
  }

  if (body.object !== 'page' && body.object !== 'instagram') {
    return NextResponse.json({ status: 'ok' })
  }

  // Return 200 IMMEDIATELY — process in background
  void processEvents(body).catch(err =>
    console.error('[FBWebhook] Processing error:', err),
  )
  return NextResponse.json({ status: 'ok' })
}

async function processEvents(body: Record<string, unknown>) {
  const platform: Platform = body.object === 'instagram' ? 'instagram' : 'facebook'

  for (const entry of (body.entry as Record<string, unknown>[]) ?? []) {
    // DMs
    for (const event of (entry.messaging as Record<string, unknown>[]) ?? []) {
      const message = event.message as Record<string, unknown> | undefined
      if (!message) continue
      const senderId = (event.sender as { id?: string })?.id
      const text = (message.text as string) ?? ''

      const mediaUrls: string[] = []
      for (const att of (message.attachments as { payload?: { url?: string } }[]) ?? []) {
        if (att?.payload?.url) mediaUrls.push(att.payload.url)
      }

      if (senderId && text) {
        void handleIncomingMessage(
          platform, senderId, text,
          undefined, undefined,
          mediaUrls.length > 0 ? mediaUrls : undefined,
        ).then(response => sendFBMessage(senderId, response)).catch(err =>
          console.error('[FBWebhook] DM handler error:', err),
        )
      }
    }

    // Page comments
    for (const change of (entry.changes as Record<string, unknown>[]) ?? []) {
      if (change.field !== 'feed') continue
      const val = change.value as Record<string, unknown>
      if (val?.item !== 'comment') continue

      const commenterId = val.sender_id as string | undefined
      const commentText = (val.message as string) ?? ''
      const commentId = val.comment_id as string | undefined

      if (!commenterId || !commentText) continue

      if (HOUSE_RE.test(commentText)) {
        void handleIncomingMessage('facebook', commenterId, commentText).then(async response => {
          if (commentId) {
            await sendFBCommentReply(commentId, response.split('\n')[0])
          }
          await sendFBMessage(commenterId, `Habari! Nimekuona unatafuta nyumba 🏠 Ninatuma details kwenye DM yako...`)
        }).catch(err => console.error('[FBWebhook] Comment handler error:', err))
      }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function sendFBMessage(recipientId: string, message: string) {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN
  if (!token) return

  await fetch('https://graph.facebook.com/v18.0/me/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message.slice(0, 2000) },
    }),
  })
}

async function sendFBCommentReply(commentId: string, message: string) {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN
  if (!token) return

  await fetch(`https://graph.facebook.com/v18.0/${commentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: token }),
  })
}
