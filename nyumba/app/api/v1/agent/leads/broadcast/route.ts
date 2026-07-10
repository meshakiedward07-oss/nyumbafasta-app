import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic  = 'force-dynamic'
export const maxDuration = 60

// GET — preview recipient count before sending
// ?target=all|new|contacted|region&region=Dar es Salaam&status=new
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') || ''
  const status = searchParams.get('status') || ''

  let q = supabaseAdmin
    .from('agent_leads')
    .select('id', { count: 'exact', head: true })
    .not('whatsapp', 'is', null)

  if (region) q = q.eq('region', region)
  if (status) q = q.eq('status', status)

  const { count } = await q
  return NextResponse.json({ count: count ?? 0 })
}

// POST — send WhatsApp broadcast to leads with whatsapp numbers
// Body: { message, tone?, region?, status? }
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const {
    message,
    tone   = 'personal',
    region = '',
    status = '',
  } = await req.json() as {
    message: string
    tone?:   string
    region?: string
    status?: string
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Ujumbe unahitajika' }, { status: 400 })
  }

  // ── Fetch recipients ──────────────────────────────────────────────────────
  let q = supabaseAdmin
    .from('agent_leads')
    .select('id, business_name, whatsapp')
    .not('whatsapp', 'is', null)

  if (region) q = q.eq('region', region)
  if (status) q = q.eq('status', status)

  const { data: leads, error: fetchErr } = await q.limit(500)
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const recipients = (leads ?? []).filter(l => l.whatsapp)

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Hakuna leads wenye namba ya WhatsApp walioonekana' }, { status: 400 })
  }

  if (recipients.length > 200) {
    return NextResponse.json(
      { error: `Wapokeaji ni wengi sana (${recipients.length}). Kiwango cha juu ni 200 kwa broadcast moja. Tumia filter ya mkoa au status.` },
      { status: 400 },
    )
  }

  // ── Build personalised message ────────────────────────────────────────────
  function buildMessage(leadName: string): string {
    const first = leadName.split(' ')[0]
    let prefix = ''
    if (tone === 'personal') prefix = `Habari ${first}! 😊\n\n`
    else if (tone === 'formal') prefix = `Kwa heshima, ${first},\n\n`
    else if (tone === 'urgent') prefix = `MUHIMU — ${first},\n\n`

    return (prefix + message.trim())
      .replace(/\{jina\}/gi, first)
      .replace(/\{name\}/gi, first)
  }

  // ── Send with rate limiting (200ms between sends) ─────────────────────────
  let sentCount   = 0
  let failedCount = 0

  for (const lead of recipients) {
    try {
      const phone = formatPhoneNumber(lead.whatsapp as string)
      if (!phone) { failedCount++; continue }

      const text = buildMessage(lead.business_name as string)
      const ok   = await sendTextMessage(phone, text)
      ok ? sentCount++ : failedCount++
    } catch {
      failedCount++
    }
    await new Promise(r => setTimeout(r, 200))
  }

  return NextResponse.json({
    ok:          true,
    total:       recipients.length,
    sent:        sentCount,
    failed:      failedCount,
  })
}
