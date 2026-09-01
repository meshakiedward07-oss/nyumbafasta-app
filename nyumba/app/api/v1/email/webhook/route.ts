import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createHmac, timingSafeEqual } from 'crypto'

// Resend delivery status webhook
// Configure in Resend dashboard → Webhooks → Add endpoint:
//   URL: https://nyumbafasta.co/api/v1/email/webhook
//   Events: email.delivered, email.bounced, email.complained, email.opened
export async function POST(req: NextRequest) {
  // Verify Resend webhook signature (svix-based)
  const secret = process.env.RESEND_WEBHOOK_SECRET
  // Fail CLOSED when the secret isn't configured — this used to fall
  // through to the bottom of the function and process the payload with NO
  // signature check at all (only a console.warn), unlike the sibling
  // email/inbound/route.ts which already correctly rejects in this case.
  // An unauthenticated caller could flip any email's delivery status
  // (`delivered`/`bounced`/`complained`) by POSTing a guessed/arbitrary
  // resend_id. Found 2026-09-01 compose-email audit.
  if (!secret) {
    console.error('[email/webhook] RESEND_WEBHOOK_SECRET not set — rejecting (fail-closed)')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 401 })
  }

  const svixId        = req.headers.get('svix-id') ?? ''
  const svixTimestamp = req.headers.get('svix-timestamp') ?? ''
  const svixSignature = req.headers.get('svix-signature') ?? ''

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 401 })
  }

  // Reject payloads older than 5 minutes to prevent replay attacks
  const ts = parseInt(svixTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return NextResponse.json({ error: 'Timestamp out of range' }, { status: 401 })
  }

  const rawBody = await req.text()
  const toSign  = `${svixId}.${svixTimestamp}.${rawBody}`
  // Resend webhook secret starts with "whsec_" followed by base64; strip prefix
  const keyBytes  = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const computed  = createHmac('sha256', keyBytes).update(toSign).digest('base64')
  const expected  = `v1,${computed}`

  // svix-signature may contain multiple space-separated values; any match is valid
  const signatures = svixSignature.split(' ')
  const valid = signatures.some(sig => {
    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    } catch {
      return false
    }
  })

  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Body already read as text; parse it now
  let event: { type?: string; data?: Record<string, unknown> }
  try { event = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  return processEvent(event)
}

async function processEvent(event: { type?: string; data?: Record<string, unknown> }) {
  const { type, data } = event
  if (!type || !data) return NextResponse.json({ ok: true, skipped: true })

  const resendId = data.email_id as string | undefined
  if (!resendId) return NextResponse.json({ ok: true, skipped: true })

  const admin = createAdminClient()

  const STATUS_MAP: Record<string, string> = {
    'email.delivered':  'delivered',
    'email.bounced':    'bounced',
    'email.complained': 'complained',
    'email.opened':     'delivered',
  }

  const newStatus = STATUS_MAP[type]
  if (!newStatus) return NextResponse.json({ ok: true, skipped: true })

  // The update's error was previously discarded entirely — silently
  // useless if `newStatus` isn't in the emails.status CHECK constraint
  // (found 2026-09-01: 'delivered'/'bounced'/'complained' were NOT in the
  // constraint that shipped with the table, so every real delivery-status
  // update from Resend was failing outright and no email's status ever
  // progressed past 'sent'; see the emails_status_values migration).
  const { error } = await admin
    .from('emails')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('resend_id', resendId)

  if (error) {
    console.error('[email/webhook] status update failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
