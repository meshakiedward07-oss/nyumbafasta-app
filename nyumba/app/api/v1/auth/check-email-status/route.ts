import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Called by the login page when signInWithPassword returns "invalid login credentials"
// to distinguish an unconfirmed email from genuinely wrong credentials.
// Returns { exists, confirmed } — no password info exposed.
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

    // Look up user id from public.users (synced from auth.users via trigger)
    const { data: row } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!row?.id) return NextResponse.json({ exists: false, confirmed: false })

    // Get auth record to check email_confirmed_at
    const { data: authData } = await admin.auth.admin.getUserById(row.id)
    if (!authData?.user) return NextResponse.json({ exists: false, confirmed: false })

    return NextResponse.json({
      exists: true,
      confirmed: !!authData.user.email_confirmed_at,
    })
  } catch {
    return NextResponse.json({ exists: false, confirmed: false })
  }
}
