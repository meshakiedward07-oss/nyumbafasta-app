import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Temporary diagnostic endpoint — DELETE after use
// Auth: requires a live admin session cookie (visit while logged in as admin)
export async function GET(req: NextRequest) {
  // Verify the caller is an authenticated admin
  let supabaseRes = NextResponse.next({ request: req })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseRes = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseRes.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const email = req.nextUrl.searchParams.get('email') ?? 'adsnyumbafasta@gmail.com'

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1. Find in auth.users
  let authUser: Record<string, unknown> | null = null
  let authError: string | null = null
  try {
    const { data: { users }, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (error) { authError = error.message }
    else {
      const found = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (found) {
        authUser = {
          id: found.id,
          email: found.email,
          email_confirmed_at: found.email_confirmed_at,
          created_at: found.created_at,
          last_sign_in_at: found.last_sign_in_at,
          banned_until: found.banned_until,
          is_anonymous: found.is_anonymous,
          user_metadata: found.user_metadata,
        }
      }
    }
  } catch (e) { authError = String(e) }

  if (!authUser) {
    return NextResponse.json({ email, auth_user: null, auth_error: authError, note: 'NOT FOUND in auth.users' })
  }

  const userId = authUser.id as string

  // 2. Advertisers table
  const { data: advertiser, error: advErr } = await admin
    .from('advertisers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  // 3. Public.users table
  const { data: publicUser, error: pubErr } = await admin
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  return NextResponse.json({
    email,
    auth_user: authUser,
    advertiser: advertiser ?? null,
    advertiser_error: advErr?.message ?? null,
    public_user: publicUser ?? null,
    public_user_error: pubErr?.message ?? null,
  })
}
