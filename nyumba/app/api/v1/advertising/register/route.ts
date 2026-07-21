import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'
import { auditLog } from '@/lib/security/auditLog'
import { sendMail } from '@/lib/email/resend'
import { advertiserWelcomeEmail, emailBase } from '@/lib/email/templates'

export async function POST(req: NextRequest) {
  // Rate limit: 5 registrations per hour per IP
  const ip = getClientIp(req)
  const rl = await rateLimit(`adv_register:${ip}`, 5, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Maombi mengi sana. Jaribu tena baadaye.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const {
      email, password,
      business_name, business_category,
      contact_phone, whatsapp_number,
      city, district, description, website_url,
    } = body

    if (!email || !password || !business_name || !business_category || !contact_phone || !city) {
      return NextResponse.json({ error: 'Tafadhali jaza sehemu zote zinazohitajika' }, { status: 400 })
    }

    const supabase = await createClient()
    const admin    = createAdminClient()

    const { data: { user: existingUser } } = await supabase.auth.getUser()

    let userId: string
    let createdAuthUser = false

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Use admin client so the email is auto-confirmed — advertisers can log in
      // immediately without waiting for a confirmation email.
      const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (signUpError) {
        return NextResponse.json({ error: signUpError.message }, { status: 400 })
      }
      if (!signUpData.user) {
        return NextResponse.json({ error: 'Imeshindwa kuunda akaunti' }, { status: 500 })
      }
      userId         = signUpData.user.id
      createdAuthUser = true
    }

    // Check for existing advertiser profile
    const { data: existing } = await admin
      .from('advertisers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Tayari una akaunti ya mfanyabiashara', existing: true }, { status: 409 })
    }

    // Create advertiser profile — if this fails, roll back the auth user
    const { data: advertiser, error: insertError } = await admin
      .from('advertisers')
      .insert({
        user_id:          userId,
        business_name,
        business_category,
        contact_phone,
        whatsapp_number:  whatsapp_number ? normalizePhone(whatsapp_number) : null,
        email,
        city,
        district:         district    || null,
        description:      description || null,
        website_url:      website_url || null,
        status:           'pending_review',
      })
      .select('id, status')
      .single()

    if (insertError || !advertiser) {
      // Atomic rollback: remove the auth user we just created so the email
      // can be reused on the next attempt — prevents orphaned auth.users rows.
      if (createdAuthUser) {
        await admin.auth.admin.deleteUser(userId).catch(() => {})
      }
      return NextResponse.json({ error: 'Imeshindwa kusajili biashara. Jaribu tena.' }, { status: 500 })
    }

    // ── Non-blocking side effects ─────────────────────────────────────────────

    // In-app welcome notification
    admin.from('notifications').insert({
      user_id: userId,
      title:   '🎉 Karibu NyumbaFasta Ads!',
      body:    `Akaunti ya "${business_name}" imesajiliwa. Itakaguliwa na timu yetu ndani ya saa 24.`,
      type:    'advertiser_welcome',
      is_read: false,
    }).then(() => {}, () => {})

    // Emails (non-blocking) — both go through Resend, no rate limits
    const { subject: wSubject, html: wHtml } = advertiserWelcomeEmail(business_name, city)
    sendMail({ to: email, subject: wSubject, html: wHtml }).catch(() => {})

    if (process.env.ADMIN_EMAIL) {
      sendMail({
        to:      process.env.ADMIN_EMAIL,
        subject: `🏪 Mfanyabiashara Mpya — ${business_name}`,
        html:    emailBase(
          `<p>Mfanyabiashara mpya amesajili: <b>${business_name}</b> (${city})<br>
           Angalia: <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/adverts/advertisers">Admin → Wafanyabiashara</a></p>`,
          'Mfanyabiashara mpya amesajili'
        ),
      }).catch(() => {})
    }

    // Audit log
    auditLog({
      action:      'admin_action',
      user_id:     userId,
      target_id:   advertiser.id,
      target_type: 'advertiser',
      metadata:    { event: 'advertiser_registered', business_name, city },
      ip_address:  ip,
      severity:    'info',
    }).catch(() => {})

    return NextResponse.json({ ok: true, advertiser_id: advertiser.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
