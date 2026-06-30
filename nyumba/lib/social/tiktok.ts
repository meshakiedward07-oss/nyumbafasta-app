import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { Listing } from '@/lib/types/database'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

// ── OAuth ─────────────────────────────────────────────────────────────────

export function getTikTokAuthUrl(state: string): string {
  const clientKey = encodeURIComponent(process.env.TIKTOK_CLIENT_KEY!)
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/social/tiktok/callback`)
  const encodedState = encodeURIComponent(state)
  // video.upload,video.publish require TikTok app review — start with basic scope
  const scope = 'user.info.basic,video.upload,video.publish'
  // Trailing slash required by TikTok docs; commas kept literal (not %2C)
  return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${encodedState}`
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

function buildStaticTikTokCaption(listing: Listing): string {
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

  return `🏡 ${type} inapatikana!

📍 ${location}
💰 TZS ${price}/mwezi
${bedroomLine}${furnishedLine}
✅ Imeidhinishwa na NyumbaFasta
🌐 Tafuta zaidi: nyumbafasta.co

#NyumbaFasta #NyumbaZaKupanga #Tanzania #DarEsSalaam #RealEstate #MaliIsiyohamia #NyumbaTanzania #HouseForRent`.trim()
}

// AI-powered TikTok caption using Claude — falls back to static on error
export async function generateTikTokCaption(listing: Listing): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildStaticTikTokCaption(listing)
  }

  const price    = listing.price_monthly.toLocaleString('sw-TZ')
  const location = listing.location_display ?? `${listing.district}, ${listing.region}`
  const typeMap: Record<string, string> = {
    chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
  }
  const type = typeMap[listing.type] ?? listing.type
  const bedroomInfo = listing.bedrooms ? `Vyumba ${listing.bedrooms}` : ''
  const amenities   = listing.amenities?.slice(0, 4).join(', ') || ''

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role:    'user',
        content: `Andika TikTok caption kwa Kiswahili cha vijana wa Tanzania kwa listing hii:

Aina: ${type}
Mahali: ${location}
Bei: TZS ${price}/mwezi
${bedroomInfo ? `Vyumba: ${bedroomInfo}` : ''}
${amenities ? `Vifaa: ${amenities}` : ''}
${listing.description ? `Maelezo: ${listing.description.slice(0, 150)}` : ''}

Mahitaji:
- Anza na emoji inayovutia na sentensi ya kuchekesha/ya kuvutia
- Tumia lugha ya mitaani ya Dar es Salaam (sawa, poa, noma, bro)
- Jumuisha bei, mahali, na kama ina vyumba
- Ongeza link: nyumbafasta.co
- Mwisho ongeza hashtags: #NyumbaFasta #NyumbaZaKupanga #Tanzania #DarEsSalaam #fyp #nyumba #househunting
- Usiwe rasmi — andika kama TikTok creator wa Tanzania
- Max maneno 100, max hashtags 8

Andika caption TU bila maelezo mengine.`,
      }],
    })

    const aiCaption = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : ''

    return aiCaption || buildStaticTikTokCaption(listing)
  } catch (err) {
    console.error('[TikTok] AI caption failed, using static:', err instanceof Error ? err.message : err)
    return buildStaticTikTokCaption(listing)
  }
}
