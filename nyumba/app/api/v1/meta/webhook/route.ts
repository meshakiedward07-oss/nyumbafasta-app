import { NextRequest, NextResponse } from 'next/server'
import { verifyMetaSignature } from '@/lib/social/metaClient'
import { handleNewComment, handleSocialDM } from '@/lib/social/autoReply'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN

// ── Webhook verification (GET) ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (!VERIFY_TOKEN) {
    console.error('[MetaWebhook] META_WEBHOOK_VERIFY_TOKEN haijawekwa')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── Incoming events (POST) ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Always return 200 first — Meta retries on non-200 causing duplicate events
  const rawBuffer = Buffer.from(await req.arrayBuffer())

  // ── Signature verification — mandatory on every POST ──────────────────
  const sigHeader = req.headers.get('x-hub-signature-256') ?? ''
  const igSecret  = process.env.INSTAGRAM_APP_SECRET ?? ''
  const fbSecret  = process.env.FACEBOOK_APP_SECRET  ?? ''

  if (!sigHeader) {
    console.warn('[MetaWebhook] Missing X-Hub-Signature-256 — rejecting unsigned request')
    return NextResponse.json({ status: 'ok' })
  }

  const validIG = igSecret && verifyMetaSignature(rawBuffer, sigHeader, igSecret)
  const validFB = fbSecret && verifyMetaSignature(rawBuffer, sigHeader, fbSecret)

  if (!validIG && !validFB) {
    console.warn('[MetaWebhook] Signature verification failed — rejecting')
    return NextResponse.json({ status: 'ok' })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBuffer.toString())
  } catch {
    return NextResponse.json({ status: 'ok' })
  }

  const objectType = body.object as string

  // Return 200 IMMEDIATELY — Meta retries on timeout; process in background
  if (objectType === 'instagram') {
    void handleInstagramEvents(body).catch(err =>
      console.error('[MetaWebhook] IG handler error:', err),
    )
  } else if (objectType === 'page') {
    void handleFacebookEvents(body).catch(err =>
      console.error('[MetaWebhook] FB handler error:', err),
    )
  }

  return NextResponse.json({ status: 'ok' })
}

// ── Instagram event handler ────────────────────────────────────────────────

async function handleInstagramEvents(body: Record<string, unknown>) {
  for (const entry of (body.entry as Record<string, unknown>[]) ?? []) {
    // ── Instagram DMs ──────────────────────────────────────────────────────
    for (const event of (entry.messaging as Record<string, unknown>[]) ?? []) {
      const message = event.message as Record<string, unknown> | undefined
      if (!message) continue

      const senderId = (event.sender as { id?: string })?.id
      const text     = (message.text as string) ?? ''
      const mid      = (message.mid as string) ?? undefined

      if (senderId && text) {
        void handleSocialDM(
          { senderId, messageId: mid, messageText: text },
          'instagram',
        )
      }
    }

    // ── Instagram Comments ─────────────────────────────────────────────────
    for (const change of (entry.changes as Record<string, unknown>[]) ?? []) {
      if (change.field !== 'comments') continue
      const val = change.value as Record<string, unknown>

      const commentId   = val.id as string | undefined
      const commentText = (val.text as string) ?? ''
      const commenterId = (val.from as { id?: string } | undefined)?.id
      const mediaId     = (val.media as { id?: string } | undefined)?.id

      if (!commentId || !commentText || !commenterId) continue

      void handleNewComment(
        {
          commentId,
          commenterId,
          commenterName: (val.from as { username?: string } | undefined)?.username,
          commentText,
          igPostId: mediaId,
        },
        'instagram',
      )
    }
  }
}

// ── Facebook event handler ─────────────────────────────────────────────────

async function handleFacebookEvents(body: Record<string, unknown>) {
  for (const entry of (body.entry as Record<string, unknown>[]) ?? []) {
    // ── Facebook Messenger DMs ────────────────────────────────────────────
    for (const event of (entry.messaging as Record<string, unknown>[]) ?? []) {
      const message = event.message as Record<string, unknown> | undefined
      if (!message) continue

      const senderId = (event.sender as { id?: string })?.id
      const text     = (message.text as string) ?? ''
      const mid      = (message.mid as string) ?? undefined

      if (senderId && text) {
        void handleSocialDM(
          { senderId, messageId: mid, messageText: text },
          'facebook',
        )
      }
    }

    // ── Facebook Page Feed Comments ───────────────────────────────────────
    for (const change of (entry.changes as Record<string, unknown>[]) ?? []) {
      if (change.field !== 'feed') continue
      const val = change.value as Record<string, unknown>
      if (val?.item !== 'comment') continue

      const commentId   = val.comment_id as string | undefined
      const commentText = (val.message as string) ?? ''
      const commenterId = val.sender_id as string | undefined
      const fbPostId    = val.post_id as string | undefined

      if (!commentId || !commentText || !commenterId) continue

      void handleNewComment(
        {
          commentId,
          commenterId,
          commenterName: (val.sender_name as string) ?? undefined,
          commentText,
          fbPostId,
        },
        'facebook',
      )
    }
  }
}
