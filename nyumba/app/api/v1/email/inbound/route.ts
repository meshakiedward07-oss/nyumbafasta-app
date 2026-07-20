import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Resend inbound email webhook
// Setup: In Resend dashboard → Inbound → add route catching reply+*@nyumbafasta.co
// → POST to https://nyumbafasta.co/api/v1/email/inbound
export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>
  try {
    payload = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend inbound payload fields
  const fromEmail   = (payload.from as string | null)    ?? ''
  const fromName    = (payload.sender_name as string | null) ?? fromEmail.split('@')[0] ?? 'Unknown'
  const toEmail     = Array.isArray(payload.to) ? (payload.to[0] as string) : (payload.to as string | null) ?? ''
  const subject     = (payload.subject as string | null) ?? '(no subject)'
  const bodyText    = (payload.text as string | null)    ?? (payload.plain_text as string | null) ?? ''

  // Extract thread_id from reply-to address (reply+{threadId}@domain.com)
  let threadId: string | undefined
  const match = toEmail.match(/reply\+([a-f0-9-]{36})@/)
  if (match) threadId = match[1]

  if (!fromEmail || !bodyText.trim()) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const admin = createAdminClient()

  await admin.from('emails').insert({
    direction:  'inbound',
    subject:    subject.replace(/^re:\s*/i, '').trim(),
    body_text:  bodyText.trim(),
    from_email: fromEmail.toLowerCase(),
    from_name:  fromName,
    to_email:   toEmail.toLowerCase(),
    status:     'received',
    thread_id:  threadId ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
