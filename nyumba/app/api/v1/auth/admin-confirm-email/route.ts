import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/v1/auth/admin-confirm-email
// Auto-confirms an admin/staff email so they can sign in.
// Security: only works for users whose role in public.users is 'admin' or 'staff'.
// An attacker still needs the correct password to log in after confirmation.
export async function POST(req: NextRequest) {
  let email: string
  try {
    const body = await req.json()
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email si sahihi' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // 1. Look up the user in public.users by email — must be admin or staff
    const { data: profile } = await admin
      .from('users')
      .select('id, role')
      .eq('email', email)
      .maybeSingle()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
      // Don't reveal whether the email exists
      return NextResponse.json({ ok: false })
    }

    // 2. Confirm the email via service_role
    const { error } = await admin.auth.admin.updateUserById(profile.id, {
      email_confirm: true,
    })

    if (error) {
      console.error('[admin-confirm-email]', error.message)
      return NextResponse.json({ ok: false })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin-confirm-email] unexpected:', err)
    return NextResponse.json({ ok: false })
  }
}
