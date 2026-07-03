import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// POST /api/v1/profile/track-click
// Fire-and-forget — always returns 200 immediately.
// Analytics queries count from profile_click_events directly.
export async function POST(req: NextRequest) {
  void (async () => {
    try {
      const { dalaliId, listingId, eventType } = await req.json() as {
        dalaliId?: string
        listingId?: string
        eventType?: string
      }
      if (!dalaliId || !eventType) return

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
