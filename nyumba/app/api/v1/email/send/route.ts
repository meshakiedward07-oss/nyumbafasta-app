import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMail, buildEmailHtml, REPLY_DOMAIN } from '@/lib/email/resend'
import { rateLimit } from '@/lib/security/rateLimit'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const userId = auth.userId
    const admin  = createAdminClient()

    const { data: profile } = await admin
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single()
    const senderName = (profile?.full_name as string | null) ?? 'Timu ya NyumbaFasta'

    // Rate limit: 30 emails per 10 minutes per staff member
    const rl = await rateLimit(`email:${userId}`, 30, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi. Jaribu tena baadaye.' }, { status: 429 })
    }

    const body = await req.json() as {
      to_email:       string
      to_name:        string
      subject:        string
      body_text:      string
      recipient_type: string
      recipient_id?:  string
      thread_id?:     string
    }

    const { to_email, to_name, subject, body_text, recipient_type, recipient_id, thread_id } = body

    if (!to_email || !to_name?.trim() || !subject?.trim() || !body_text?.trim()) {
      return NextResponse.json({ error: 'Tafadhali jaza sehemu zote zinazohitajika' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) {
      return NextResponse.json({ error: 'Anwani ya barua pepe si sahihi' }, { status: 400 })
    }

    // Build HTML using the same helper used by all automatic emails
    const html = buildEmailHtml({
      recipientName: to_name,
      subject:       subject.trim(),
      bodyText:      body_text.trim(),
      senderName,
    })

    // Determine thread ID before sending so Reply-To header can reference it
    const usedThreadId = thread_id ?? randomUUID()

    // Send via Resend — same path as every other automatic email in the system
    const result = await sendMail({
      to:      to_email.toLowerCase(),
      subject: subject.trim(),
      html,
      replyTo: `reply+${usedThreadId}@${REPLY_DOMAIN}`,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Imeshindwa kutuma barua pepe. Angalia RESEND_API_KEY kwenye Vercel.' },
        { status: 502 },
      )
    }

    // Log to emails table non-fatally — delivery never depends on this succeeding
    admin.from('emails').insert({
      direction:      'outbound',
      subject:        subject.trim(),
      body_text:      body_text.trim(),
      from_email:     'noreply@nyumbafasta.co',
      from_name:      senderName,
      to_email:       to_email.toLowerCase(),
      to_name:        to_name.trim(),
      recipient_type: recipient_type ?? null,
      recipient_id:   recipient_id ?? null,
      sent_by_id:     userId,
      sent_by_name:   senderName,
      status:         'sent',
      resend_id:      result.id ?? null,
      thread_id:      usedThreadId,
    }).then(null, () => {}) // Non-fatal — email already sent

    return NextResponse.json({ ok: true, thread_id: usedThreadId })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/email/send]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
