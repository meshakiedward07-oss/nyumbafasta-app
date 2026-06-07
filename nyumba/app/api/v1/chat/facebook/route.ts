import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage, Platform } from '@/lib/chat/aiAgent'

export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN ?? 'nyumbafasta-fb-2026'
const HOUSE_RE = /nyumba|chumba|apartment|inapangishwa|rent|bei|location|mtaa/i

// ── Facebook webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json()

    if (body.object !== 'page' && body.object !== 'instagram') {
      return NextResponse.json({ status: 'ok' })
    }

    const platform: Platform = body.object === 'instagram' ? 'instagram' : 'facebook'

    for (const entry of body.entry ?? []) {
      // DMs
      for (const event of entry.messaging ?? []) {
        if (!event.message) continue
        const senderId = event.sender?.id as string | undefined
        const text = (event.message?.text as string) ?? ''

        const mediaUrls: string[] = []
        for (const att of event.message?.attachments ?? []) {
          const url = (att as { payload?: { url?: string } }).payload?.url
          if (url) mediaUrls.push(url)
        }

        if (senderId && text) {
          const response = await handleIncomingMessage(
            platform, senderId, text,
            undefined, undefined,
            mediaUrls.length > 0 ? mediaUrls : undefined,
          )
          await sendFBMessage(senderId, response)
        }
      }

      // Page comments
      for (const change of entry.changes ?? []) {
        if (change.field !== 'feed') continue
        const val = change.value as Record<string, unknown>
        if (val?.item !== 'comment') continue

        const commenterId = val.sender_id as string | undefined
        const commentText = (val.message as string) ?? ''
        const commentId = val.comment_id as string | undefined

        if (!commenterId || !commentText) continue

        if (HOUSE_RE.test(commentText)) {
          const response = await handleIncomingMessage('facebook', commenterId, commentText)

          // Short reply on the comment itself
          if (commentId) {
            const firstLine = response.split('\n')[0]
            await sendFBCommentReply(commentId, firstLine)
          }

          // Full details in DM
          await sendFBMessage(
            commenterId,
            `Habari! Nimekuona unatafuta nyumba 🏠 Ninatuma details kwenye DM yako...`,
          )
        }
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('Facebook webhook error:', err)
    return NextResponse.json({ status: 'ok' })
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function sendFBMessage(recipientId: string, message: string) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN
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
  const token = process.env.FACEBOOK_ACCESS_TOKEN
  if (!token) return

  await fetch(`https://graph.facebook.com/v18.0/${commentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: token }),
  })
}
