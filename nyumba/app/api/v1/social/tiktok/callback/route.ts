import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { exchangeCodeForToken, getTikTokUserInfo } from '@/lib/social/tiktok'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${APP_URL}/admin/social?tiktok=error&msg=${encodeURIComponent(error)}`)
  }

  // Verify state
  const savedState = req.cookies.get('tiktok_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${APP_URL}/admin/social?tiktok=error&msg=state_mismatch`)
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/admin/social?tiktok=error&msg=no_code`)
  }

  // Verify admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/admin/social?tiktok=error&msg=auth`)

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(`${APP_URL}/admin/social?tiktok=error&msg=admin_only`)
  }

  try {
    const tokenData = await exchangeCodeForToken(code)

    let displayName = ''
    let avatarUrl = ''
    let followerCount = 0
    try {
      const userInfo = await getTikTokUserInfo(tokenData.access_token)
      displayName  = userInfo.display_name ?? ''
      avatarUrl    = userInfo.avatar_url    ?? ''
      followerCount = userInfo.follower_count ?? 0
    } catch {
      // non-fatal — TikTok sandbox may not return all fields
    }

    await supabaseAdmin
      .from('tiktok_connections')
      .upsert(
        {
          open_id:                    tokenData.open_id,
          access_token:               tokenData.access_token,
          refresh_token:              tokenData.refresh_token,
          token_expires_at:           new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          refresh_token_expires_at:   new Date(Date.now() + tokenData.refresh_expires_in * 1000).toISOString(),
          display_name:               displayName,
          avatar_url:                 avatarUrl,
          follower_count:             followerCount,
          scopes:                     tokenData.scope.split(','),
          is_active:                  true,
          connected_at:               new Date().toISOString(),
          last_refreshed_at:          new Date().toISOString(),
        },
        { onConflict: 'open_id' },
      )

    const res = NextResponse.redirect(`${APP_URL}/admin/social?tiktok=connected`)
    res.cookies.delete('tiktok_oauth_state')
    return res
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[TikTok] Callback error:', msg)
    return NextResponse.redirect(`${APP_URL}/admin/social?tiktok=error&msg=${encodeURIComponent(msg)}`)
  }
}
