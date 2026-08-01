import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/email/resend'
import { passwordChangedEmail } from '@/lib/email/templates'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'

// POST /api/v1/auth/password-changed-notification
// Called client-side immediately after supabase.auth.updateUser({ password }) succeeds.
// Sends the user a "your password was changed" security notification.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // 10 per hour per IP — generous since this fires once per real password change
  const rl = await rateLimit(`pw_changed:${ip}`, 10, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  const { email } = await req.json() as { email?: string }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    const admin = createAdminClient()

    let userName = 'Mtumiaji'
    try {
      const { data: profile } = await admin
        .from('users')
        .select('full_name')
        .eq('email', normalizedEmail)
        .maybeSingle()
      if (profile?.full_name) userName = (profile.full_name as string).split(' ')[0]
    } catch { /* not critical */ }

    const { subject, html } = passwordChangedEmail(userName)
    await sendMail({ to: normalizedEmail, subject, html })
  } catch (err) {
    console.error('[PW Changed Notification] error:', err)
  }

  // Always respond OK — never reveal if email exists
  return NextResponse.json({ ok: true })
}
