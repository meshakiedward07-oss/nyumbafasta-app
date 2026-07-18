import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Called by the login page when signInWithPassword returns "invalid login credentials"
// to distinguish an unconfirmed email from genuinely wrong credentials.
// Returns { exists, confirmed } — no password info exposed.
//
// NOTE: public.users.email is not populated by the DB trigger — we query
// auth.admin directly to avoid always returning { exists: false }.
export async function POST(req: NextRequest) {
  let email: string
  try {
    const body = await req.json()
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return NextResponse.json({ exists: false, confirmed: false })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ exists: false, confirmed: false })
  }

  try {
    const admin = createAdminClient()

    // Query auth.admin directly — public.users.email is not reliably populated
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const authUser = (listData?.users ?? []).find(
      u => u.email?.toLowerCase() === email,
    )

    if (!authUser) return NextResponse.json({ exists: false, confirmed: false })

    return NextResponse.json({
      exists: true,
      confirmed: !!authUser.email_confirmed_at,
    })
  } catch {
    return NextResponse.json({ exists: false, confirmed: false })
  }
}
