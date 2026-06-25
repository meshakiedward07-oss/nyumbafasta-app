import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { Listing } from '@/lib/types/database'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize'

// ── OAuth ─────────────────────────────────────────────────────────────────

export function getTikTokAuthUrl(state: string): string {
  const base = TIKTOK_AUTH_URL
  const clientKey = encodeURIComponent(process.env.TIKTOK_CLIENT_KEY!)
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/social/tiktok/callback`)
  const scope = 'user.info.basic,video.upload,video.publish'
  const encodedState = encodeURIComponent(state)
  // Build manually to keep commas literal in scope (TikTok requires this)
  return `${base}?client_key=${clientKey}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${encodedState}`
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_expires_in: number
  open_id: string
  scope: string
}> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/social/tiktok/callback`,
    }),
  })
  const data = await res.json() as {
    access_token: string; refresh_token: string; expires_in: number
    refresh_expires_in: number; open_id: string; scope: string
    error?: string; error_description?: string
  }
  if (data.error) throw new Error(`TikTok token error: ${data.error_description}`)
  return data
}

export async function refreshTikTokToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const data = await res.json() as {
    access_token: string; expires_in: number
    error?: string; error_description?: string
  }
  if (data.error) throw new Error(String(data.error_description))
  return data
}

// ── User Info ─────────────────────────────────────────────────────────────

export async function getTikTokUserInfo(accessToken: string): Promise<{
  open_id: string
  display_name: string
  avatar_url: string
  follower_count: number
}> {
  const res = await fetch(
    `${TIKTOK_API_BASE}/user/info/?fields=open_id,display_name,avatar_url,follower_count`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  type UserInfo = { open_id: string; display_name: string; avatar_url: string; follower_count: number }
  const data = await res.json() as { data?: { user?: UserInfo }; error?: { message: string } }
  if (data.error?.message) throw new Error(data.error.message)
  return data.data?.user ?? ({ open_id: '', display_name: '', avatar_url: '', follower_count: 0 })
}

// ── Token Management ──────────────────────────────────────────────────────

export async function getValidToken(): Promise<string | null> {
  const { data: conn } = await supabaseAdmin
    .from('tiktok_connections')
    .select('*')
    .eq('is_active', true)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conn) return null

  const now = new Date()
  if (now < new Date(conn.token_expires_at)) return conn.access_token as string

  try {
    const refreshed = await refreshTikTokToken(conn.refresh_token as string)
    const newExpiry = new Date(Date.now() + (refreshed.expires_in as number) * 1000)
    await supabaseAdmin
      .from('tiktok_connections')
      .update({
        access_token: refreshed.access_token,
        token_expires_at: newExpiry.toISOString(),
        last_refreshed_at: now.toISOString(),
      })
      .eq('id', conn.id)
    return refreshed.access_token
  } catch (err) {
    console.error('[TikTok] Token refresh failed:', err)
    return null
  }
}

// ── Post Video ────────────────────────────────────────────────────────────

export async function postVideoToTikTok(params: {
  videoUrl: string
  caption: string
  listingId?: string
  privacyLevel?: string
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
}): Promise<{ success: boolean; publishId?: string; error?: string }> {
  const accessToken = await getValidToken()
  if (!accessToken) return { success: false, error: 'TikTok account haijaunganishwa' }

  const { data: post } = await supabaseAdmin
    .from('tiktok_posts')
    .insert({
      listing_id: params.listingId ?? null,
      video_url: params.videoUrl,
      caption: params.caption,
      status: 'uploading',
      privacy_level: params.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
      disable_comment: params.disableComment ?? false,
      disable_duet: params.disableDuet ?? false,
      disable_stitch: params.disableStitch ?? false,
    })
    .select('id')
    .single()

  try {
    const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: params.caption.slice(0, 150),
          privacy_level: params.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
          disable_comment: params.disableComment ?? false,
          disable_duet: params.disableDuet ?? false,
          disable_stitch: params.disableStitch ?? false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: params.videoUrl,
        },
      }),
    })

    const initData = await initRes.json() as { error?: { code: string; message: string }; data?: { publish_id: string } }

    if (initData.error?.code && initData.error.code !== 'ok') {
      throw new Error(initData.error.message || 'TikTok init failed')
    }

    const publishId = initData.data?.publish_id

    await supabaseAdmin
      .from('tiktok_posts')
      .update({
        publish_id: publishId,
        status: 'processing',
        tiktok_response: initData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post?.id)

    console.log('[TikTok] Video posted, publishId:', publishId)
    return { success: true, publishId }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[TikTok] Post error:', msg)
    await supabaseAdmin
      .from('tiktok_posts')
      .update({ status: 'failed', error_message: msg, updated_at: new Date().toISOString() })
      .eq('id', post?.id)
    return { success: false, error: msg }
  }
}

// ── Check Post Status ─────────────────────────────────────────────────────

export async function checkTikTokPostStatus(
  publishId: string,
  accessToken: string,
): Promise<{ status: string; videoId?: string; shareUrl?: string }> {
  const res = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publish_id: publishId }),
  })
  const data = await res.json() as { data?: { status: string; publicaly_available_post_id?: string[]; share_url?: string } }
  return {
    status: data.data?.status ?? 'UNKNOWN',
    videoId: data.data?.publicaly_available_post_id?.[0],
    shareUrl: data.data?.share_url,
  }
}

// ── Caption Generator ─────────────────────────────────────────────────────

export function generateTikTokCaption(listing: Listing): string {
  const price = listing.price_monthly.toLocaleString('sw-TZ')
  const location = listing.location_display ?? `${listing.district}, ${listing.region}`

  const typeMap: Record<string, string> = {
    chumba: 'Chumba',
    apartment: 'Apartment',
    nyumba: 'Nyumba',
    studio: 'Studio',
    duka: 'Duka',
  }
  const type = typeMap[listing.type] ?? listing.type

  const bedroomLine = listing.bedrooms ? `🛏️ Vyumba ${listing.bedrooms}\n` : ''
  const furnishedLine =
    listing.furnished === 'furnished'
      ? '✨ Imejengwa (Furnished)\n'
      : listing.furnished === 'semi'
      ? '🪑 Semi-furnished\n'
      : ''

  return `🏠 ${type} inapatikana!

📍 ${location}
💰 TZS ${price}/mwezi
${bedroomLine}${furnishedLine}
✅ Imeidhinishwa na NyumbaFasta
📱 Tafuta zaidi: nyumbafasta.co

#NyumbaFasta #NyumbaZaKupanga #Tanzania #DarEsSalaam #RealEstate #MaliIsiyohamia #NyumbaTanzania #HouseForRent`.trim()
}
