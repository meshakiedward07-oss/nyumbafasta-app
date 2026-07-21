import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/email/resend'
import { passwordResetEmail } from '@/lib/email/templates'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'

// POST /api/v1/auth/request-password-reset
// Generates a Supabase recovery link and sends it via Resend instead of
// relying on Supabase's built-in SMTP (which is rate-limited and goes to spam).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // Rate-limit: 5 requests per 10 minutes per IP
  const rl = await rateLimit(`pw_reset:${ip}`, 5, 10 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Maombi mengi. Tafadhali subiri dakika chache.' },
      { status: 429 }
    )
  }

  const { email, redirectTo: customRedirect } = await req.json() as {
    email?: string
    redirectTo?: string
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Barua pepe si sahihi' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Always respond OK so we don't leak whether an email exists
  const respond = () => NextResponse.json({ ok: true })

  try {
    const admin = createAdminClient()

    // Generate the recovery link server-side — no email sent by Supabase
    const redirectUrl = customRedirect
      ?? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?redirect=/account/change-password`

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo: redirectUrl },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      // User probably doesn't exist — still respond 200 so we don't leak
      console.error('[PW Reset] generateLink error:', linkErr?.message)
      return respond()
    }

    // Look up user's display name
    let userName = 'Mtumiaji'
    try {
      const { data: profile } = await admin
        .from('users')
        .select('full_name')
        .eq('email', normalizedEmail)
        .maybeSingle()
      if (profile?.full_name) userName = (profile.full_name as string).split(' ')[0]
    } catch { /* not critical */ }

    const { subject, html } = passwordResetEmail(userName, linkData.properties.action_link)
    await sendMail({ to: normalizedEmail, subject, html })
  } catch (err) {
    console.error('[PW Reset] Unexpected error:', err)
  }

  // Always return OK — never reveal if email exists or not
  return respond()
}
