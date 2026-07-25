import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Resend delivery status webhook
// Configure in Resend dashboard → Webhooks → Add endpoint:
//   URL: https://nyumbafasta.co/api/v1/email/webhook
//   Events: email.delivered, email.bounced, email.complained, email.opened
export async function POST(req: NextRequest) {
  let event: { type?: string; data?: Record<string, unknown> }
  try {
    event = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, data } = event
  if (!type || !data) return NextResponse.json({ ok: true, skipped: true })

  const resendId = data.email_id as string | undefined
  if (!resendId) return NextResponse.json({ ok: true, skipped: true })

  const admin = createAdminClient()

  // Map Resend event types to our status values
  const STATUS_MAP: Record<string, string> = {
    'email.delivered':  'delivered',
    'email.bounced':    'bounced',
    'email.complained': 'bounced',
    'email.opened':     'delivered',
  }

  const newStatus = STATUS_MAP[type]
  if (!newStatus) return NextResponse.json({ ok: true, skipped: true })

  await admin
    .from('emails')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('resend_id', resendId)

  return NextResponse.json({ ok: true, status: newStatus })
}
