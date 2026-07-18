import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Emergency account recovery endpoint.
// Confirms email + optionally resets password for admin/staff accounts.
// Secured by CRON_SECRET — only someone with the env var can call this.
//
// Usage (from terminal/curl):
//   curl -X POST https://nyumbafasta.co/api/v1/admin/recover-account \
//     -H "Content-Type: application/json" \
//     -d '{"email":"admin@example.com","secret":"<CRON_SECRET>"}'
export async function POST(req: NextRequest) {
  // Accept either CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY as the recovery secret
  const validSecrets = [
    process.env.CRON_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter(Boolean)

  if (validSecrets.length === 0) {
    return NextResponse.json({ error: 'Recovery not configured' }, { status: 500 })
  }

  let body: { email?: string; secret?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.secret || !validSecrets.includes(body.secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) {
    return NextResponse.json({ error: 'email inahitajika' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Search auth.users directly — more reliable than public.users which may lack
  // an email column or have a missing row (e.g. trigger didn't fire for OAuth accounts)
  const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUser = (listData?.users ?? []).find(
    u => u.email?.toLowerCase() === email,
  )

  if (!authUser) {
    // Also try public.users in case the email is stored there only
    const { data: row } = await admin
      .from('users')
      .select('id, role, full_name')
      .eq('email', email)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({
        error: `Hakuna mtumiaji na email ${email} katika mfumo`,
        hint: 'Angalia kama umetumia Google OAuth — jaribu kuingia na Google badala ya barua pepe na nenosiri',
      }, { status: 404 })
    }

    // Found in public.users — get auth info by id
    const { data: byId } = await admin.auth.admin.getUserById(row.id)
    if (!byId?.user) {
      return NextResponse.json({ error: 'Akaunti ya auth haipatikani' }, { status: 404 })
    }
    return doUpdate(admin, byId.user.id, row.role, body)
  }

  // Check if this is an OAuth-only account (no password set)
  const hasPassword = authUser.identities?.some(i => i.provider === 'email')
  if (!hasPassword && !body.newPassword) {
    return NextResponse.json({
      ok: false,
      hint: 'Akaunti hii iliundwa kwa Google OAuth — hutaweza kuingia kwa barua pepe na nenosiri bila kuweka nenosiri jipya. Jaribu kuingia kwa Google, AU ongeza newPassword katika ombi hili.',
      email_confirmed: !!authUser.email_confirmed_at,
      providers: authUser.identities?.map(i => i.provider),
    })
  }

  // Get role from public.users
  const { data: profileRow } = await admin
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle()

  return doUpdate(admin, authUser.id, profileRow?.role ?? 'admin', body)
}

async function doUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  role: string,
  body: { newPassword?: string },
): Promise<Response> {
  const updates: Record<string, unknown> = { email_confirm: true }
  if (body.newPassword && typeof body.newPassword === 'string' && body.newPassword.length >= 8) {
    updates.password = body.newPassword
  }

  const { data: updatedUser, error: updateErr } = await admin.auth.admin.updateUserById(
    userId,
    updates,
  )

  if (updateErr) {
    return Response.json({ error: updateErr.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    message: `Email imethibitishwa.${updates.password ? ' Nenosiri limebadilishwa. Ingia sasa.' : ' Jaribu kuingia na nenosiri lako la kawaida.'}`,
    user: {
      id: userId,
      role,
      email_confirmed_at: updatedUser.user.email_confirmed_at,
    },
  })
}
