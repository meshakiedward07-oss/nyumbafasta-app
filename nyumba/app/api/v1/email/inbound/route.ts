import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Resend inbound webhook
// Receives emails sent to <anything>@kiruajorix.resend.app
// In Resend dashboard → Inbound → Webhook URL:
//   https://www.nyumbafasta.co/api/v1/email/inbound
export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>
  try {
    payload = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend inbound payload:
  // from: "Name <email@domain.com>" or "email@domain.com"
  // to:   ["email@domain.com"] or "email@domain.com"
  // subject, text, html, messageId, replyTo, headers
  const rawFrom   = (payload.from as string | null) ?? ''
  const toField   = Array.isArray(payload.to)
    ? (payload.to[0] as string)
    : (payload.to as string | null) ?? ''
  const subject   = (payload.subject as string | null) ?? '(hakuna kichwa)'
  const bodyText  = (payload.text as string | null) ?? (payload.plain_text as string | null) ?? ''

  // Parse "Name <email>" → { name, email }
  const fromMatch = rawFrom.match(/^(.+?)\s*<([^>]+)>$/)
  const fromEmail = fromMatch ? fromMatch[2].trim().toLowerCase() : rawFrom.trim().toLowerCase()
  const fromName  = fromMatch ? fromMatch[1].trim().replace(/^["']|["']$/g, '') : fromEmail.split('@')[0]

  // Extract thread_id from reply+{uuid}@kiruajorix.resend.app or any domain
  let threadId: string | undefined
  const toMatch = toField.match(/reply\+([a-f0-9-]{36})@/)
  if (toMatch) threadId = toMatch[1]

  // Also check replyTo header for threading
  if (!threadId) {
    const replyToArr = Array.isArray(payload.replyTo) ? payload.replyTo : []
    for (const rt of replyToArr as string[]) {
      const m = rt.match(/reply\+([a-f0-9-]{36})@/)
      if (m) { threadId = m[1]; break }
    }
  }

  if (!fromEmail || !bodyText.trim()) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const admin = createAdminClient()
  await admin.from('emails').insert({
    direction:  'inbound',
    subject:    subject.replace(/^re:\s*/i, '').trim(),
    body_text:  bodyText.trim(),
    from_email: fromEmail,
    from_name:  fromName,
    to_email:   toField.toLowerCase(),
    to_name:    'NyumbaFasta',
    status:     'received',
    thread_id:  threadId ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
