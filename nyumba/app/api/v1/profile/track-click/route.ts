import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_EVENT_TYPES = ['whatsapp_click', 'phone_click', 'share', 'listing_view', 'profile_view']

// POST /api/v1/profile/track-click
// Fire-and-forget — always returns 200 immediately.
// Analytics queries count from profile_click_events directly.
export async function POST(req: NextRequest) {
  // 30 track events per minute per IP
  const rl = await rateLimit(`track-click:${getClientIp(req)}`, 30, 60_000)
  if (!rl.allowed) return NextResponse.json({ ok: true })

  void (async () => {
    try {
      const { dalaliId, listingId, eventType } = await req.json() as {
        dalaliId?: string
        listingId?: string
        eventType?: string
      }
      if (!dalaliId || !UUID_RE.test(dalaliId)) return
      if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) return
      if (listingId && !UUID_RE.test(listingId)) return

      await supabaseAdmin.from('profile_click_events').insert({
        dalali_id:  dalaliId,
        listing_id: listingId ?? null,
        event_type: eventType,
      })
    } catch (err) {
      console.error('[Profile/track-click]', err)
    }
  })()

  return NextResponse.json({ ok: true })
}
