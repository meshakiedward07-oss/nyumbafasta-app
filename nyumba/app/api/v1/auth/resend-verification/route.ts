import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/email/resend'
import { verificationEmail } from '@/lib/email/templates'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'

// POST /api/v1/auth/resend-verification
// Generates a Supabase email-confirmation link server-side and sends it via
// Resend instead of Supabase's built-in SMTP (rate-limited, goes to spam).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // 5 requests per 10 minutes per IP
  const rl = await rateLimit(`verify_resend:${ip}`, 5, 10 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Maombi mengi. Tafadhali subiri dakika chache.' },
      { status: 429 }
    )
  }

  const { email } = await req.json() as { email?: string }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Barua pepe si sahihi' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Always respond OK — never reveal whether an account exists
  const respond = () => NextResponse.json({ ok: true })

  try {
    const admin = createAdminClient()

    // Generate a fresh confirmation link. If the email doesn't exist or is
    // already confirmed, Supabase returns an error — we silently ignore it.
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'signup',
      email: normalizedEmail,
      options: { redirectTo: redirectUrl },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      // User not found, already confirmed, or other non-fatal error — respond OK
      return respond()
    }

    // Resolve display name
    let userName = 'Mtumiaji'
    try {
      const { data: profile } = await admin
        .from('users')
        .select('full_name')
        .eq('email', normalizedEmail)
        .maybeSingle()
      if (profile?.full_name) userName = (profile.full_name as string).split(' ')[0]
    } catch { /* not critical */ }

    const { subject, html } = verificationEmail(userName, linkData.properties.action_link)
    await sendMail({ to: normalizedEmail, subject, html })
  } catch (err) {
    console.error('[Verify Resend] Unexpected error:', err)
  }

  return respond()
}
