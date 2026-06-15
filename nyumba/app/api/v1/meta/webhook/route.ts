import { NextRequest, NextResponse } from 'next/server'
import { verifyMetaSignature } from '@/lib/social/metaClient'
import { handleNewComment, handleSocialDM } from '@/lib/social/autoReply'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

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

      const senderId  = (event.sender as { id?: string })?.id
      const text      = (message.text as string) ?? ''
      const mid       = (message.mid as string) ?? undefined
      const referral  = event.referral as Record<string, unknown> | undefined

      if (!senderId || !text) continue

      // Detect marketplace inquiry (has referral.source === 'MARKETPLACE')
      const isMarketplace    = referral?.source === 'MARKETPLACE'
      const mItemId          = (referral?.product as { id?: string } | undefined)?.id

      if (isMarketplace && mItemId) {
        void handleMarketplaceInquiry(senderId, text, mid, mItemId)
      } else {
        void handleSocialDM({ senderId, messageId: mid, messageText: text }, 'facebook')
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

// ── Marketplace Inquiry Handler ────────────────────────────────────────────

async function handleMarketplaceInquiry(
  senderId:   string,
  text:       string,
  messageId:  string | undefined,
  mItemId:    string,
) {
  try {
    // Resolve listing from marketplace_listings
    const { data: ml } = await supabaseAdmin
      .from('marketplace_listings')
      .select('id, listing_id, title, listings(title, price_monthly, district, region, bedrooms, id)')
      .eq('marketplace_item_id', mItemId)
      .maybeSingle()

    const listingId = ml?.listing_id as string | null
    const listingData = ml?.listings as unknown as Record<string, unknown> | null

    // Save inquiry to DB
    if (ml?.id) {
      await supabaseAdmin.from('marketplace_inquiries').insert({
        marketplace_listing_id: ml.id,
        listing_id:             listingId,
        sender_fb_id:           senderId,
        message:                text,
      })
      // Increment inquiry count
      void Promise.resolve(
        supabaseAdmin
          .from('marketplace_listings')
          .update({ inquiries: ((ml as Record<string, unknown>).inquiries as number ?? 0) + 1 })
          .eq('id', ml.id)
      ).catch(() => null)
    }

    // Build listing context for Amina
    const price      = listingData?.price_monthly
      ? Number(listingData.price_monthly).toLocaleString('sw-TZ')
      : 'N/A'
    const district   = String(listingData?.district ?? '')
    const region     = String(listingData?.region ?? '')
    const bedrooms   = listingData?.bedrooms ?? 'N/A'
    const listTitle  = String(listingData?.title ?? ml?.title ?? 'nyumba')
    const lid        = String(listingData?.id ?? listingId ?? '')

    const listingContext = listingData
      ? `Mtu huyu anawasiliana kupitia Facebook Marketplace.
Anauliza kuhusu listing hii hasa:
- Kichwa: ${listTitle}
- Bei: TZS ${price}/mwezi
- Mahali: ${district}, ${region}
- Vyumba: ${bedrooms}
- Link: nyumbafasta.co/listings/${lid}
Jibu maswali yake kuhusu listing hii specifically. Mweleze bei, mahali, na jinsi ya kuwasiliana.`
      : undefined

    // Route through Amina with listing context
    const { handleIncomingMessage } = await import('@/lib/chat/aiAgent')
    const { sendFBMessage } = await import('@/lib/social/metaClient')

    const reply = await handleIncomingMessage(
      'facebook',
      senderId,
      text,
      undefined,
      undefined,
      undefined,
      listingContext,
    )

    if (reply?.trim()) {
      await sendFBMessage(senderId, reply)

      // Mark inquiry as replied
      if (ml?.id) {
        await supabaseAdmin
          .from('marketplace_inquiries')
          .update({ replied: true, reply_text: reply, replied_at: new Date().toISOString() })
          .eq('marketplace_listing_id', ml.id)
          .eq('sender_fb_id', senderId)
          .eq('replied', false)
          .order('created_at', { ascending: false })
          .limit(1)
      }
    }

    console.log(`[Marketplace] Inquiry handled for item ${mItemId} from sender ${senderId.slice(0, 6)}***`)
  } catch (err) {
    console.error('[Marketplace] Inquiry handler failed:', err)
    // Fall back to regular DM handling
    void handleSocialDM({ senderId, messageId, messageText: text }, 'facebook')
  }
}
