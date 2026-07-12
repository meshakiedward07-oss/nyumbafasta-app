import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/v1/leads/broadcast
// Body: { message, tone, target, leadIds?, quality?, leadType?, status? }
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const {
      message,
      tone = 'personal',
      target,       // 'selected' | 'all' | 'high' | 'medium' | 'low' | 'has_whatsapp' | 'dalali' | 'mteja' | 'new_status'
      leadIds,      // when target === 'selected'
      quality,      // optional extra filter
      leadType,
      status,
    } = await req.json() as {
      message: string
      tone?: string
      target: string
      leadIds?: string[]
      quality?: string
      leadType?: string
      status?: string
    }

    if (!message?.trim()) return NextResponse.json({ error: 'Ujumbe unahitajika' }, { status: 400 })
    if (!target)          return NextResponse.json({ error: 'Lengwa linahitajika' }, { status: 400 })

    // ── Build lead query ───────────────────────────────────────────────────────
    let q = supabaseAdmin
      .from('leads')
      .select('id,full_name,phone,whatsapp_number')
      .eq('is_duplicate', false)
      .eq('is_dead_lead', false)
      .not('status', 'in', '("inactive","rejected")')
      .or('phone.not.is.null,whatsapp_number.not.is.null') // must have some contact

    if (target === 'selected') {
      if (!leadIds?.length) return NextResponse.json({ error: 'leadIds zinahitajika' }, { status: 400 })
      q = q.in('id', leadIds.slice(0, 200))

    } else if (target === 'high')         q = q.eq('contact_quality', 'high')
    else if (target === 'medium')         q = q.eq('contact_quality', 'medium')
    else if (target === 'low')            q = q.eq('contact_quality', 'low')
    else if (target === 'has_whatsapp')   q = q.not('whatsapp_number', 'is', null)
    else if (target === 'dalali')         q = q.eq('lead_type', 'dalali')
    else if (target === 'mteja')          q = q.eq('lead_type', 'mteja')
    else if (target === 'new_status')     q = q.eq('status', 'new')
    // 'all' — no extra filter beyond the base filters above

    // Optional stacking filters
    if (quality)   q = q.eq('contact_quality', quality)
    if (leadType)  q = q.eq('lead_type', leadType)
    if (status)    q = q.eq('status', status)

    const { data: leads, error: lErr } = await q.limit(200)
    if (lErr) throw lErr

    if (!leads?.length) return NextResponse.json({ error: 'Hakuna leads zenye namba za kuwasiliana' }, { status: 400 })

    // Cap check
    if (leads.length >= 200) {
      // Warn but still send (already limited to 200 in query)
      console.warn(`[Leads Broadcast] Hitting 200-lead cap for target=${target}`)
    }

    // ── Personalise message ────────────────────────────────────────────────────
    function buildMsg(name: string): string {
      const first = (name || 'Rafiki').split(' ')[0]
      let prefix = ''
      if (tone === 'personal') prefix = `Habari ${first}! 😊\n\n`
      else if (tone === 'formal') prefix = `Kwa heshima, ${first},\n\n`
      else if (tone === 'urgent') prefix = `⚡ MUHIMU — ${first},\n\n`
      return (prefix + message.trim())
        .replace(/\{jina\}/gi, first)
        .replace(/\{name\}/gi, first)
    }

    // ── Create broadcast record ────────────────────────────────────────────────
    const { data: broadcast, error: bErr } = await supabaseAdmin
      .from('whatsapp_broadcasts')
      .insert({
        target:           `leads_${target}`,
        message:          message.trim(),
        tone,
        recipients_count: leads.length,
        status:           'sending',
      })
      .select('id')
      .single()

    if (bErr) throw bErr

    // ── Send ──────────────────────────────────────────────────────────────────
    let sentCount   = 0
    let failedCount = 0
    const failedNames: string[] = []

    for (const lead of leads) {
      const rawPhone = lead.whatsapp_number || lead.phone
      if (!rawPhone) { failedCount++; continue }

      const phone = formatPhoneNumber(rawPhone)
      if (!phone || phone.length < 9) { failedCount++; continue }

      const text = buildMsg(lead.full_name || 'Rafiki')
      const ok   = await sendTextMessage(phone, text)
      if (ok) sentCount++
      else { failedCount++; failedNames.push(lead.full_name || phone) }

      // 200ms delay — ~5 msg/s, within Meta's rate limit
      await new Promise(r => setTimeout(r, 200))
    }

    // ── Update broadcast record ────────────────────────────────────────────────
    await supabaseAdmin
      .from('whatsapp_broadcasts')
      .update({
        sent_count:   sentCount,
        failed_count: failedCount,
        status:       failedCount === leads.length ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', broadcast.id)

    return NextResponse.json({
      ok:               true,
      broadcast_id:     broadcast.id,
      recipients_count: leads.length,
      sent_count:       sentCount,
      failed_count:     failedCount,
      failed_names:     failedNames.slice(0, 10),
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    console.error('[Leads Broadcast]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/v1/leads/broadcast — recent leads broadcast history
export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { data } = await supabaseAdmin
    .from('whatsapp_broadcasts')
    .select('id,target,message,recipients_count,sent_count,failed_count,status,created_at,completed_at')
    .like('target', 'leads_%')
    .order('created_at', { ascending: false })
    .limit(15)

  return NextResponse.json({ broadcasts: data ?? [] })
}
