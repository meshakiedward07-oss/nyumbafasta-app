import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'
import { requireAdminUser } from '@/lib/security/adminAuth'

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
// Body: { target, message, tone, phones? }
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const {
    target,   // 'all_dalali' | 'active_dalali' | 'new_dalali' | 'specific'
    message,
    tone = 'personal',
    phones: specificPhones,
  } = await req.json() as {
    target: string
    message: string
    tone?: string
    phones?: string[]
  }

  if (!message?.trim() || !target) {
    return NextResponse.json({ error: 'message and target required' }, { status: 400 })
  }

  // ── Resolve recipient list ────────────────────────────────────────────────

  type Recipient = { name: string; phone: string }
  let recipients: Recipient[] = []

  if (target === 'specific' && specificPhones?.length) {
    recipients = specificPhones.map((p) => ({ name: 'Mtumiaji', phone: p }))

  } else if (target === 'all_clients' || target === 'active_clients') {
    // ── Client targets ────────────────────────────────────────────────────────
    let clientIds: string[] | null = null

    if (target === 'active_clients') {
      const { data: unlocks } = await supabaseAdmin
        .from('contact_unlocks')
        .select('client_id')
        .eq('status', 'completed')
        .limit(5000)
      clientIds = [...new Set((unlocks ?? []).map((u) => u.client_id as string))]
      if (clientIds.length === 0) {
        return NextResponse.json({ error: 'Hakuna wateja waliofanya unlock bado' }, { status: 400 })
      }
    }

    let query = supabaseAdmin
      .from('users')
      .select('full_name, phone')
      .eq('role', 'client')
      .not('phone', 'is', null)

    if (clientIds) query = query.in('id', clientIds)

    const { data } = await query.limit(500)
    recipients = (data ?? []).map((u) => ({
      name:  u.full_name ?? 'Mteja',
      phone: u.phone ?? '',
    })).filter((r) => r.phone)

  } else {
    // ── Dalali targets ────────────────────────────────────────────────────────
    let query = supabaseAdmin
      .from('users')
      .select('full_name, phone, dalali_profiles(whatsapp_number)')
      .eq('role', 'dalali')
      .eq('is_active', true)

    if (target === 'new_dalali') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', weekAgo)
    } else if (target === 'active_dalali') {
      const { data: activeSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('dalali_id')
        .eq('status', 'active')
      const activeIds = (activeSubs ?? []).map((s) => s.dalali_id)
      if (activeIds.length === 0) {
        return NextResponse.json({ error: 'Hakuna madalali wenye subscription inayoendelea' }, { status: 400 })
      }
      query = query.in('id', activeIds)
    }

    const { data } = await query.limit(500)
    recipients = (data ?? []).map((u) => {
      const profile = Array.isArray(u.dalali_profiles) ? u.dalali_profiles[0] : u.dalali_profiles
      const phone = (profile as { whatsapp_number?: string } | null)?.whatsapp_number ?? u.phone ?? ''
      return { name: u.full_name ?? 'Dalali', phone }
    }).filter((r) => r.phone)
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Hakuna wapokeaji walioonekana' }, { status: 400 })
  }

  // Safety cap: 200ms delay × 200 recipients = 40s (within maxDuration=60 budget)
  if (recipients.length > 200) {
    return NextResponse.json(
      { error: `Wapokeaji ni wengi sana (${recipients.length}). Kiwango cha juu ni 200 kwa broadcast moja ili kuepuka timeout. Tumia vikundi vidogo.` },
      { status: 400 },
    )
  }

  // ── Create broadcast record ───────────────────────────────────────────────

  const { data: broadcast, error: bErr } = await supabaseAdmin
    .from('whatsapp_broadcasts')
    .insert({
      admin_id:         admin.id,
      target,
      message:          message.trim(),
      tone,
      recipients_count: recipients.length,
      status:           'sending',
    })
    .select()
    .single()

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

  // ── Tone prefix ───────────────────────────────────────────────────────────

  function buildMessage(recipientName: string): string {
    const firstName = recipientName.split(' ')[0]
    let prefix = ''
    if (tone === 'personal') prefix = `Habari ${firstName}! 😊\n\n`
    else if (tone === 'formal') prefix = `Kwa heshima, ${firstName},\n\n`
    else if (tone === 'urgent') prefix = `MUHIMU — ${firstName},\n\n`

    return (prefix + message.trim())
      .replace(/\{jina\}/gi, firstName)
      .replace(/\{name\}/gi, firstName)
  }

  // ── Send to each recipient with 500ms delay ───────────────────────────────

  let sentCount = 0
  let failedCount = 0

  for (const recipient of recipients) {
    try {
      const phone = formatPhoneNumber(recipient.phone)
      if (!phone) { failedCount++; continue }

      const text = buildMessage(recipient.name)
      await sendTextMessage(phone, text)
      sentCount++
    } catch (err) {
      console.error('[Broadcast] send failed for recipient:', err)
      failedCount++
    }

    // Rate limit: 200ms between sends (Meta allows ~5 msg/s; 200ms = ~5/s stays safe)
    await new Promise((r) => setTimeout(r, 200))
  }

  // ── Update broadcast record ───────────────────────────────────────────────

  await supabaseAdmin
    .from('whatsapp_broadcasts')
    .update({
      sent_count:   sentCount,
      failed_count: failedCount,
      status:       failedCount === recipients.length ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', broadcast.id)

  return NextResponse.json({
    ok: true,
    broadcast_id:     broadcast.id,
    recipients_count: recipients.length,
    sent_count:       sentCount,
    failed_count:     failedCount,
  })
}
