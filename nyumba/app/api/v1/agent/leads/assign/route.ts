import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { notifyStaffNewProspect } from '@/lib/whatsapp/notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { leadId, staffId } = await req.json() as { leadId: string; staffId: string }

    if (!leadId || !staffId) {
      return NextResponse.json({ error: 'leadId na staffId vinahitajika' }, { status: 400 })
    }

    // Fetch lead
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('agent_leads')
      .select('id, business_name, phone, region, source, pipeline_stage, assigned_to')
      .eq('id', leadId)
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead haikupatikana' }, { status: 404 })
    }

    // Fetch staff member — must be role='staff' or 'admin'
    const { data: staff, error: staffErr } = await supabaseAdmin
      .from('users')
      .select('id, full_name, phone, role')
      .eq('id', staffId)
      .in('role', ['staff', 'admin'])
      .single()

    if (staffErr || !staff) {
      return NextResponse.json(
        { error: 'Mfanyakazi hakupatikana au si staff/admin' },
        { status: 404 },
      )
    }

    const now = new Date().toISOString()

    // Assign lead to staff member
    const { error: updateErr } = await supabaseAdmin
      .from('agent_leads')
      .update({
        assigned_to: staffId,
        assigned_at: now,
        pipeline_stage: 'contacted',
        last_contacted_at: now,
        updated_at: now,
      })
      .eq('id', leadId)

    if (updateErr) throw updateErr

    // Log assignment
    await supabaseAdmin.from('lead_communications').insert({
      lead_id: leadId,
      type: 'note',
      direction: 'internal',
      content: `Lead imepewa ${staff.full_name ?? 'mfanyakazi'} na admin`,
    })

    // In-app notification
    await supabaseAdmin.from('notifications').insert({
      user_id: staffId,
      type: 'lead_assigned',
      title: '🎯 Prospect Mpya wa Dalali!',
      body: `Prospect mpya: ${lead.business_name ?? 'Dalali Mtarajiwa'}${lead.region ? ` (${lead.region})` : ''} — wasiliana nao haraka`,
      is_read: false,
    })

    // WhatsApp notification to staff
    const staffPhone = (staff as { phone?: string }).phone
    let whatsappSent = false
    if (staffPhone) {
      whatsappSent = await notifyStaffNewProspect(
        staffPhone,
        lead.business_name ?? 'Dalali Mtarajiwa',
        lead.region ?? null,
        lead.source ?? 'manual',
      )
    }

    return NextResponse.json({
      success: true,
      assigned_to: staffId,
      staff_name: staff.full_name,
      whatsapp_sent: whatsappSent,
      whatsapp_phone: staffPhone ? staffPhone.slice(0, 7) + '****' : null,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
