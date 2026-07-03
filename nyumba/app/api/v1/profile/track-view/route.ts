import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// POST /api/v1/profile/track-view
// Fire-and-forget — always returns 200 immediately; tracking runs async.
// Analytics counts views from profile_views table directly.
export async function POST(req: NextRequest) {
  void (async () => {
    try {
      const { dalaliId, referrer } = await req.json() as { dalaliId?: string; referrer?: string }
      if (!dalaliId) return

      let source = 'direct'
      if (referrer) {
        if      (referrer.includes('facebook.com'))  source = 'facebook'
        else if (referrer.includes('instagram.com')) source = 'instagram'
        else if (referrer.includes('tiktok.com'))    source = 'tiktok'
        else if (referrer.includes('twitter.com') || referrer.includes('t.co')) source = 'twitter'
        else if (referrer.includes('google.'))       source = 'google'
        else if (referrer.includes('wa.me') || referrer.includes('whatsapp.com')) source = 'whatsapp'
        else source = 'other'
      }

      await supabaseAdmin.from('profile_views').insert({
        dalali_id: dalaliId,
        source,
        referrer: referrer ?? null,
      })
    } catch (err) {
      console.error('[Profile/track-view]', err)
    }
  })()

  return NextResponse.json({ ok: true })
}
