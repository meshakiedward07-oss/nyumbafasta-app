import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { sendMail } from '@/lib/email/resend'

// Temporary diagnostic/recovery endpoint — DELETE after use
// Auth: requires a live admin session cookie (visit while logged in as admin)

function makeAdminClients(req: NextRequest) {
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
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  return { supabase, adminClient, supabaseRes }
}

async function requireAdmin(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  return me?.role === 'admin' ? user : null
}

// GET — diagnose an advertiser account by email
export async function GET(req: NextRequest) {
  const { supabase, adminClient } = makeAdminClients(req)
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = req.nextUrl.searchParams.get('email') ?? 'adsnyumbafasta@gmail.com'

  // 1. auth.users
  let authUser: Record<string, unknown> | null = null
  let authError: string | null = null
  try {
    const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (error) { authError = error.message }
    else {
      const found = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (found) authUser = {
        id: found.id, email: found.email,
        email_confirmed_at: found.email_confirmed_at,
        created_at: found.created_at, last_sign_in_at: found.last_sign_in_at,
        banned_until: found.banned_until, user_metadata: found.user_metadata,
      }
    }
  } catch (e) { authError = String(e) }

  // 2. advertisers by email (orphan check — search both user_id match and email columns)
  const advertiserByEmail = await adminClient
    .from('advertisers')
    .select('*')
    .or(`business_email.eq.${email},contact_email.eq.${email}`)
    .maybeSingle()

  const result: Record<string, unknown> = {
    email,
    auth_user: authUser,
    auth_error: authError,
    auth_exists: !!authUser,
    advertiser_by_email: advertiserByEmail.data ?? null,
    advertiser_by_email_error: advertiserByEmail.error?.message ?? null,
  }

  if (authUser) {
    const userId = authUser.id as string
    const [advByUid, pubUser] = await Promise.all([
      adminClient.from('advertisers').select('*').eq('user_id', userId).maybeSingle(),
      adminClient.from('users').select('*').eq('id', userId).maybeSingle(),
    ])
    result.advertiser_by_user_id = advByUid.data ?? null
    result.public_user = pubUser.data ?? null
    result.public_user_error = pubUser.error?.message ?? null
  }

  return NextResponse.json(result)
}

// POST — create a fresh advertiser account and send magic-link invite
// Body: { email, business_name? }
export async function POST(req: NextRequest) {
  const { supabase, adminClient } = makeAdminClients(req)
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email, business_name } = await req.json() as { email?: string; business_name?: string }
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

  // Check if auth account already exists
  const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const existing = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    return NextResponse.json({ error: 'Account already exists', user_id: existing.id }, { status: 409 })
  }

  // Create confirmed auth account (no password — user will set via magic link)
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'advertiser', business_name: business_name ?? '' },
  })
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? 'Failed to create user' }, { status: 500 })
  }

  const userId = created.user.id

  // Explicitly upsert public.users — never rely on the trigger alone
  const { error: profileErr } = await adminClient.from('users').upsert(
    { id: userId, email, full_name: business_name ?? email.split('@')[0], role: 'client', is_active: true, is_verified: false },
    { onConflict: 'id' }
  )
  if (profileErr) {
    await adminClient.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.json({ error: `public.users upsert failed: ${profileErr.message}` }, { status: 500 })
  }

  // Insert advertisers row if missing
  const { data: existingAdv } = await adminClient
    .from('advertisers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existingAdv) {
    const { error: advErr } = await adminClient.from('advertisers').insert({
      user_id: userId,
      business_name: business_name ?? '',
      email,
      status: 'active',
    })
    if (advErr) {
      try { await adminClient.from('users').delete().eq('id', userId) } catch { /* non-fatal */ }
      await adminClient.auth.admin.deleteUser(userId).catch(() => {})
      return NextResponse.json({ error: `advertisers insert failed: ${advErr.message}` }, { status: 500 })
    }
  }

  // Generate magic link for them to set password and login
  const { data: linkData } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${APP_URL}/advertising/dashboard` },
  })

  const magicLink = linkData?.properties?.action_link ?? null

  // Send invite email
  if (magicLink) {
    await sendMail({
      to: email,
      subject: 'Karibu NyumbaFasta — Akaunti yako ya Mfanyabiashara Imeundwa',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#1D9E75">Karibu NyumbaFasta! 🏪</h2>
          <p>Habari,</p>
          <p>Akaunti yako ya mfanyabiashara imeundwa na msimamizi wa NyumbaFasta.</p>
          <p>Bonyeza kitufe hapa chini kuingia kwenye akaunti yako:</p>
          <p style="margin:24px 0">
            <a href="${magicLink}" style="background:#1D9E75;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold">
              Ingia kwenye Akaunti →
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">Kiungo hiki kitaisha baada ya masaa 24. Kama hukuomba akaunti hii, punguza ujumbe huu.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">NyumbaFasta — Platform ya Matangazo Tanzania</p>
        </div>
      `,
    })
  }

  return NextResponse.json({
    ok: true,
    user_id: userId,
    email,
    magic_link_sent: !!magicLink,
    note: 'Account created. Magic link email sent.',
  })
}
