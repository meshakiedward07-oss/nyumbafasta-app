import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'
import { Resend } from 'resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP_NUMBER ?? '255615261147'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    // Admin only
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: 'Ruhusa imekataliwa' }, { status: 403 })
    }

    const { violation_id, status, action_taken, admin_notes, reported_user_id } = await req.json()

    if (!violation_id || !status) {
      return NextResponse.json({ error: 'violation_id na status zinahitajika' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Update violation
    const { error: updateError } = await admin
      .from('agreement_violations')
      .update({
        status,
        action_taken:  action_taken ?? null,
        admin_notes:   admin_notes ?? null,
        resolved_by:   user.id,
        resolved_at:   status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
      })
      .eq('id', violation_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Apply account action if needed
    if (reported_user_id && action_taken) {
      if (action_taken === 'suspend') {
        await admin.from('users').update({ account_status: 'suspended' }).eq('id', reported_user_id)
      } else if (action_taken === 'ban') {
        await admin.from('users').update({ account_status: 'banned', is_active: false }).eq('id', reported_user_id)
      }

      // Notify reported user via WhatsApp if they are a dalali
      const { data: reported } = await admin
        .from('users')
        .select('role, full_name')
        .eq('id', reported_user_id)
        .single()

      if (reported?.role === 'dalali') {
        const { data: profile } = await admin
          .from('dalali_profiles')
          .select('whatsapp_number')
          .eq('user_id', reported_user_id)
          .maybeSingle()

        if (profile?.whatsapp_number) {
          let message = ''
          if (action_taken === 'suspend') {
            message =
              `🚫 *Akaunti Yako Imesimamishwa — NyumbaFasta*\n\n` +
              `Akaunti yako imesimamishwa kwa muda kufuatia malalamiko yaliyopokelewa.\n\n` +
              `Kama unadhani hii ni kosa, wasiliana nasi:\n` +
              `WhatsApp: wa.me/${ADMIN_WHATSAPP}\n\n` +
              `NyumbaFasta Team`
          } else if (action_taken === 'ban') {
            message =
              `🚫 *Akaunti Yako Imefutwa — NyumbaFasta*\n\n` +
              `Akaunti yako imefutwa kabisa kwa ukiukaji mkubwa wa masharti ya matumizi.\n\n` +
              `Kwa maswali: wa.me/${ADMIN_WHATSAPP}\n\n` +
              `NyumbaFasta Team`
          } else if (action_taken === 'warning') {
            message =
              `⚠️ *Onyo Rasmi — NyumbaFasta*\n\n` +
              `Umepokelewa malalamiko dhidi ya akaunti yako. Hii ni onyo rasmi.\n\n` +
              `Endelea kufuata masharti ya matumizi. Ukikiuka tena, akaunti yako itasimamishwa.\n\n` +
              `Maswali: wa.me/${ADMIN_WHATSAPP}\n\n` +
              `NyumbaFasta Team`
          }

          if (message) {
            await sendTextMessage(formatPhoneNumber(profile.whatsapp_number), message).catch(() => {})
          }
        }
      }

      // Email notification to admin (confirmation)
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from:    'NyumbaFasta <noreply@nyumbafasta.co>',
          to:      process.env.ADMIN_EMAIL ?? 'admin@nyumbafasta.co',
          subject: `Hatua Imechukuliwa: ${action_taken} kwa ${reported?.full_name}`,
          html:    `<p>Admin <strong>${user.email}</strong> amechukua hatua ya <strong>${action_taken}</strong> dhidi ya mtumiaji <strong>${reported?.full_name}</strong>.</p><p><a href="${APP_URL}/admin/legal">Angalia Panel</a></p>`,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
