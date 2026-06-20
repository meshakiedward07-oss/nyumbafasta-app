import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { notifyNewLead } from '@/lib/whatsapp/notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { leadId, dalaliId } = await req.json() as { leadId: string; dalaliId: string }

    if (!leadId || !dalaliId) {
      return NextResponse.json({ error: 'leadId na dalaliId vinahitajika' }, { status: 400 })
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('agent_leads')
      .select('id, business_name, phone, region, pipeline_stage, assigned_to')
      .eq('id', leadId)
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead haikupatikana' }, { status: 404 })
    }

    // Fetch dalali profile (need phone for WhatsApp notification)
    const { data: dalali, error: dalaliErr } = await supabaseAdmin
      .from('users')
      .select('id, full_name, phone, dalali_profiles(whatsapp_number)')
      .eq('id', dalaliId)
      .single()

    if (dalaliErr || !dalali) {
      return NextResponse.json({ error: 'Dalali hakupatikana' }, { status: 404 })
    }

    const now = new Date().toISOString()

    // Update the lead
    const { error: updateErr } = await supabaseAdmin
      .from('agent_leads')
      .update({
        assigned_to: dalaliId,
        assigned_at: now,
        pipeline_stage: 'contacted',
        last_contacted_at: now,
        updated_at: now,
      })
      .eq('id', leadId)

    if (updateErr) throw updateErr

    // Log assignment in lead_communications
    await supabaseAdmin.from('lead_communications').insert({
      lead_id: leadId,
      type: 'note',
      direction: 'internal',
      content: `Lead imepewa ${dalali.full_name || 'dalali'} na admin`,
    })

    // In-app notification
    await supabaseAdmin.from('notifications').insert({
      user_id: dalaliId,
      type: 'lead_assigned',
      title: '🎯 Lead Mpya Umepewa!',
      body: `Lead mpya: ${lead.business_name || 'Lead'}${lead.region ? ` (${lead.region})` : ''} — angalia CRM yako`,
      is_read: false,
    })

    // WhatsApp notification — use dalali's whatsapp_number or phone
    const dalaliProfile = (dalali.dalali_profiles as { whatsapp_number?: string } | null)
    const waPhone = dalaliProfile?.whatsapp_number || (dalali as { phone?: string }).phone

    let whatsappSent = false
    if (waPhone) {
      const leadDetails =
        `${lead.business_name || 'Lead mpya'}` +
        `${lead.region ? ` — Mkoa: ${lead.region}` : ''}` +
        `${lead.phone ? `\n📞 Simu: ${lead.phone}` : ''}`

      whatsappSent = await notifyNewLead(waPhone, lead.business_name || 'Lead', leadDetails)
    }

    return NextResponse.json({
      success: true,
      assigned_to: dalaliId,
      dalali_name: dalali.full_name,
      whatsapp_sent: whatsappSent,
      whatsapp_phone: waPhone ? waPhone.slice(0, 7) + '****' : null,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
