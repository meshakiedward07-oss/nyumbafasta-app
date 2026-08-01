import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Resend inbound webhook
// Webhook URL: https://nyumbafasta.co/api/v1/email/inbound
// Payload shape: { type: "email.received", created_at: "...", data: { from, to, subject, text, ... } }

// GET is needed so browser health checks / Resend's webhook verify don't get 405
export async function GET() {
  return NextResponse.json({ ok: true, service: 'NyumbaFasta Inbound Email Webhook' })
}

function verifySvix(rawBody: string, req: NextRequest): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return true // skip verification when secret not configured

  const svixId        = req.headers.get('svix-id') ?? ''
  const svixTimestamp = req.headers.get('svix-timestamp') ?? ''
  const svixSignature = req.headers.get('svix-signature') ?? ''

  if (!svixId || !svixTimestamp || !svixSignature) return false

  const ts = parseInt(svixTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  const toSign   = `${svixId}.${svixTimestamp}.${rawBody}`
  const keyBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const computed = createHmac('sha256', keyBytes).update(toSign).digest('base64')
  const expected = `v1,${computed}`

  return svixSignature.split(' ').some(sig => {
    try { return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) }
    catch { return false }
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!verifySvix(rawBody, req)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { type?: string; data?: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.type !== 'email.received' || !event.data) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const d = event.data

  // Parse "Name <email>" or plain "email"
  const rawFrom   = (d.from as string | null) ?? ''
  const fromMatch = rawFrom.match(/^(.+?)\s*<([^>]+)>$/)
  const fromEmail = (fromMatch ? fromMatch[2] : rawFrom).trim().toLowerCase()
  const fromName  = fromMatch
    ? fromMatch[1].trim().replace(/^["']|["']$/g, '')
    : fromEmail.split('@')[0]

  const toArr   = Array.isArray(d.to) ? d.to as string[] : [d.to as string]
  const toEmail = (toArr[0] ?? '').toLowerCase()
  const subject = (d.subject as string | null) ?? '(hakuna kichwa)'
  const bodyText = (d.text as string | null) ?? ''

  // Extract thread_id from reply+{uuid}@ in the to address
  let threadId: string | undefined
  const toMatch = toEmail.match(/reply\+([a-f0-9-]{36})@/)
  if (toMatch) threadId = toMatch[1]

  // Also check received_for addresses
  if (!threadId && Array.isArray(d.received_for)) {
    for (const addr of d.received_for as string[]) {
      const m = (addr as string).match(/reply\+([a-f0-9-]{36})@/)
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
    to_email:   toEmail,
    to_name:    'NyumbaFasta',
    status:     'received',
    thread_id:  threadId ?? undefined,
    resend_id:  (d.email_id as string | null) ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
