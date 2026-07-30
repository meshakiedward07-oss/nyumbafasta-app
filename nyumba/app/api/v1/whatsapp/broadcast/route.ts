import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { resolveRecipients, executeBroadcast } from '@/lib/whatsapp/broadcastSender'

export const maxDuration = 60

// GET /api/v1/whatsapp/broadcast — broadcast history
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('whatsapp_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ broadcasts: data ?? [] })
}

// POST /api/v1/whatsapp/broadcast
// Body: { target, message, tone, phones?, scheduled_at? }
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { target, message, tone = 'personal', phones: specificPhones, scheduled_at } =
    await req.json() as {
      target: string; message: string; tone?: string
      phones?: string[]; scheduled_at?: string
    }

  if (!message?.trim() || !target) {
    return NextResponse.json({ error: 'message and target required' }, { status: 400 })
  }

  // ── Resolve recipients (validates the target is sane) ──────────────────────
  const { recipients, error: recipientErr } = await resolveRecipients(target, specificPhones)
  if (recipientErr) return NextResponse.json({ error: recipientErr }, { status: 400 })
  if (!recipients.length) return NextResponse.json({ error: 'Hakuna wapokeaji walioonekana' }, { status: 400 })

  // Safety cap: 200ms delay × 200 = 40s (within maxDuration=60)
  if (recipients.length > 200) {
    return NextResponse.json(
      { error: `Wapokeaji ni wengi sana (${recipients.length}). Max 200 kwa broadcast moja.` },
      { status: 400 },
    )
  }

  // ── Create broadcast record ────────────────────────────────────────────────
  const { data: broadcast, error: bErr } = await supabaseAdmin
    .from('whatsapp_broadcasts')
    .insert({
      admin_id:         admin.id,
      target,
      message:          message.trim(),
      tone,
      recipients_count: recipients.length,
      status:           scheduled_at ? 'scheduled' : 'sending',
      ...(scheduled_at ? { scheduled_at } : {}),
      // Store specific phones so the cron can re-resolve them
      ...(target === 'specific' && specificPhones?.length ? { phones_json: specificPhones } : {}),
    })
    .select()
    .single()

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

  // ── Scheduled: save and return ─────────────────────────────────────────────
  if (scheduled_at) {
    return NextResponse.json({ scheduled: true, broadcast_id: broadcast.id, scheduled_at })
  }

  // ── Send immediately ───────────────────────────────────────────────────────
  const { sentCount, failedCount } = await executeBroadcast(
    broadcast.id, recipients, message.trim(), tone,
  )

  return NextResponse.json({
    ok: true,
    broadcast_id:     broadcast.id,
    recipients_count: recipients.length,
    sent_count:       sentCount,
    failed_count:     failedCount,
  })
}
