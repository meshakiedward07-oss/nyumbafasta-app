import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'
import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'
import { Resend } from 'resend'

const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER ?? '255615261147'
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

const VIOLATION_LABELS: Record<string, string> = {
  fake_listing:      'Orodha ya Ulaghai / Fake Listing',
  fraud:             'Ulaghai / Fraud',
  harassment:        'Unyanyasaji / Harassment',
  spam:              'Ujumbe wa Spam',
  price_manipulation: 'Udanganyifu wa Bei / Price Manipulation',
  fake_identity:     'Utambulisho wa Uongo / Fake Identity',
  other:             'Nyingine / Other',
}

export async function POST(req: NextRequest) {
  try {
    // Max 3 violation reports per user per hour
    const ip = getClientIp(req)
    const rl = rateLimit(`violation:${ip}`, 3, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi sana. Jaribu tena baadaye.' }, { status: 429 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { reported_user_id, violation_type, description, evidence_urls } = await req.json()

    if (!reported_user_id || !violation_type || !description) {
      return NextResponse.json({ error: 'Taarifa zinazohitajika zimekosekana' }, { status: 400 })
    }

    const validTypes = ['fake_listing', 'fraud', 'harassment', 'spam', 'price_manipulation', 'fake_identity', 'other']
    if (!validTypes.includes(violation_type)) {
      return NextResponse.json({ error: 'Aina ya ukiukaji si sahihi' }, { status: 400 })
    }

    if (reported_user_id === user.id) {
      return NextResponse.json({ error: 'Huwezi kujiripoti mwenyewe' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get reporter info
    const { data: reporter } = await admin
      .from('users')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    // Get reported user info
    const { data: reported } = await admin
      .from('users')
      .select('full_name, role')
      .eq('id', reported_user_id)
      .single()

    if (!reported) {
      return NextResponse.json({ error: 'Mtumiaji aliyeripotiwa hapatikani' }, { status: 404 })
    }

    // Insert violation
    const { data: violation, error: insertError } = await admin
      .from('agreement_violations')
      .insert({
        reporter_id:      user.id,
        reported_user_id,
        violation_type,
        description:      description.trim(),
        evidence_urls:    evidence_urls ?? [],
        status:           'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // ── Phase 9: Notifications ─────────────────────────────────────────────

    const violationLabel = VIOLATION_LABELS[violation_type] ?? violation_type
    const adminUrl = `${APP_URL}/admin/legal?violation=${violation?.id ?? ''}`

    // 1. WhatsApp to admin
    try {
      await sendTextMessage(
        formatPhoneNumber(ADMIN_WHATSAPP),
        `🚨 *RIPOTI YA UKIUKAJI MPYA*\n\n` +
        `ID: ${violation?.id ?? 'N/A'}\n` +
        `Aina: ${violationLabel}\n\n` +
        `Aliyeripotiwa: *${reported.full_name}* (${reported.role})\n` +
        `Aliyeripoti: *${reporter?.full_name ?? 'Haijulikani'}*\n\n` +
        `Maelezo: ${description.slice(0, 200)}${description.length > 200 ? '...' : ''}\n\n` +
        `Angalia hapa: ${adminUrl}`
      )
    } catch {
      // Silently continue — violation was still saved
    }

    // 2. Email to admin
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from:    'NyumbaFasta <noreply@nyumbafasta.co>',
          to:      process.env.ADMIN_EMAIL ?? 'admin@nyumbafasta.co',
          subject: `🚨 Ripoti Mpya: ${violationLabel}`,
          html: `
            <h2>Ripoti ya Ukiukaji Mpya</h2>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:8px;font-weight:bold">Aina:</td><td style="padding:8px">${violationLabel}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Aliyeripotiwa:</td><td style="padding:8px">${reported.full_name} (${reported.role})</td></tr>
              <tr><td style="padding:8px;font-weight:bold">Aliyeripoti:</td><td style="padding:8px">${reporter?.full_name ?? 'Haijulikani'}</td></tr>
              <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Maelezo:</td><td style="padding:8px">${description}</td></tr>
            </table>
            <p><a href="${adminUrl}" style="background:#1D9E75;color:white;padding:10px 20px;border-radius:8px;text-decoration:none">Angalia Ripoti</a></p>
          `,
        })
      } catch {
        // Silently continue
      }
    }

    // 3. WhatsApp warning to reported user (if they are a dalali with a WhatsApp number)
    if (reported.role === 'dalali') {
      try {
        const { data: profile } = await admin
          .from('dalali_profiles')
          .select('whatsapp_number')
          .eq('user_id', reported_user_id)
          .maybeSingle()

        if (profile?.whatsapp_number) {
          await sendTextMessage(
            formatPhoneNumber(profile.whatsapp_number),
            `⚠️ *Onyo kutoka NyumbaFasta*\n\n` +
            `Taarifa yako imepokea malalamiko kuhusu: *${violationLabel}*\n\n` +
            `Malalamiko haya yanachunguzwa na timu yetu ya admin. ` +
            `Kama malalamiko yataonekana kuwa ya kweli, akaunti yako inaweza kusimamishwa.\n\n` +
            `Kama una maswali, wasiliana nasi: wa.me/${ADMIN_WHATSAPP}\n\n` +
            `NyumbaFasta Team`
          )
        }
      } catch {
        // Silently continue
      }
    }

    return NextResponse.json({ success: true, violation_id: violation?.id })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
