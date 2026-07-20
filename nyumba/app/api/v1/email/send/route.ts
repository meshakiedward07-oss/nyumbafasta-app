import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { rateLimit } from '@/lib/security/rateLimit'

export async function POST(req: NextRequest) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  // Who is the sender?
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const senderName = (profile?.full_name as string | null) ?? 'Timu ya NyumbaFasta'

  // Rate limit: 30 emails per 10 minutes per staff member
  const rl = await rateLimit(`email:${user.id}`, 30, 10 * 60 * 1000)
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

  if (!to_email || !to_name || !subject?.trim() || !body_text?.trim()) {
    return NextResponse.json({ error: 'Tafadhali jaza sehemu zote zinazohitajika' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to_email)) {
    return NextResponse.json({ error: 'Anwani ya barua pepe si sahihi' }, { status: 400 })
  }

  // Insert email record (pending)
  const { data: emailRecord, error: insertErr } = await admin
    .from('emails')
    .insert({
      direction:      'outbound',
      subject:        subject.trim(),
      body_text:      body_text.trim(),
      from_email:     'noreply@nyumbafasta.co',
      from_name:      senderName,
      to_email:       to_email.toLowerCase(),
      to_name:        to_name.trim(),
      recipient_type: recipient_type ?? null,
      recipient_id:   recipient_id ?? null,
      sent_by_id:     user.id,
      sent_by_name:   senderName,
      status:         'pending',
      thread_id:      thread_id ?? undefined,
    })
    .select('id, thread_id')
    .single()

  if (insertErr || !emailRecord) {
    return NextResponse.json({ error: 'Imeshindwa kuunda rekodi ya barua pepe' }, { status: 500 })
  }

  // Send via Resend
  const result = await sendEmail({
    to:         to_email,
    toName:     to_name,
    subject:    subject.trim(),
    bodyText:   body_text.trim(),
    senderName,
    threadId:   emailRecord.thread_id as string,
  })

  if (!result) {
    await admin.from('emails').update({ status: 'failed' }).eq('id', emailRecord.id)
    return NextResponse.json({ error: 'Imeshindwa kutuma barua pepe. Angalia RESEND_API_KEY.' }, { status: 502 })
  }

  await admin.from('emails').update({ status: 'sent', resend_id: result.id }).eq('id', emailRecord.id)

  return NextResponse.json({ ok: true, email_id: emailRecord.id, thread_id: emailRecord.thread_id })
}
