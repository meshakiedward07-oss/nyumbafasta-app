import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { refreshTikTokToken } from '@/lib/social/tiktok'

export const dynamic = 'force-dynamic'

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  const xHeader = req.headers.get('x-cron-secret')
  return auth === `Bearer ${secret}` || xHeader === secret
}

// POST / GET — refresh TikTok token if expiring within 24h
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find active connections expiring within 24 hours
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: conn } = await supabaseAdmin
      .from('tiktok_connections')
      .select('id, open_id, access_token, refresh_token, token_expires_at')
      .eq('is_active', true)
      .lt('token_expires_at', in24h)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conn) {
      return Response.json({
        success: true,
        message: 'Hakuna token zinazoisha hivi karibuni',
        timestamp: new Date().toISOString(),
      })
    }

    const refreshed = await refreshTikTokToken(conn.refresh_token as string)
    const newExpiry = new Date(Date.now() + (refreshed.expires_in as number) * 1000)

    await supabaseAdmin
      .from('tiktok_connections')
      .update({
        access_token:     refreshed.access_token,
        token_expires_at: newExpiry.toISOString(),
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('id', conn.id)

    console.log('[cron/social/refresh-token] Token refreshed for open_id:', conn.open_id)

    return Response.json({
      success:    true,
      refreshed:  true,
      expiresAt:  newExpiry.toISOString(),
      timestamp:  new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/social/refresh-token]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
