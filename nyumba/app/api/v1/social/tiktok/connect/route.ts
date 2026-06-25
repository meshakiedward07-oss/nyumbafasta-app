import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTikTokAuthUrl } from '@/lib/social/tiktok'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin tu' }, { status: 403 })

  const state = crypto.randomUUID()
  const authUrl = getTikTokAuthUrl(state)

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('tiktok_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/' })
  return res
}
