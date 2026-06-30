import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'

export async function POST(req: NextRequest) {
  const admin = createAdminClient()
  // Verify cron secret
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []
  const errors: string[] = []

  try {
    const now = new Date()

    // Get followup schedules that are due
    const { data: schedules, error: schedErr } = await admin
      .from('followup_schedules')
      .select('*, agent_leads(id, business_name, phone, assigned_to)')
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
      .limit(50)

    if (schedErr) throw schedErr

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ ok: true, results: ['No followups due'], errors: [] })
    }

    for (const schedule of schedules) {
      try {
        const lead = schedule.agent_leads as {
          id: string; business_name?: string; phone?: string; assigned_to?: string
        } | null

        if (!lead) {
          await admin.from('followup_schedules').update({ status: 'skipped' }).eq('id', schedule.id)
          continue
        }

        // Log a communication entry for the followup reminder
        await admin.from('lead_communications').insert({
          lead_id: lead.id,
          user_id: schedule.created_by || null,
          type: 'note',
          direction: 'outbound',
          content: `[Auto-followup] ${schedule.followup_type}: ${schedule.message || 'Followup ya mfumo'}`,
        })

        // Notify the assigned dalali
        if (lead.assigned_to) {
          await admin.from('notifications').insert({
            user_id: lead.assigned_to,
            type: 'followup_reminder',
            title: '⏰ Wakati wa Kuwasiliana!',
            body: `Kumbusho: wasiliana na ${lead.business_name || 'lead yako'} — ${schedule.followup_type}`,
            is_read: false,
          })
        }

        // Mark schedule as completed
        await admin.from('followup_schedules').update({
          status: 'completed',
          completed_at: now.toISOString(),
        }).eq('id', schedule.id)

        // Send WhatsApp reminder to assigned dalali if they have a phone
        if (lead.phone) {
          const waMsg = `🔔 *Kumbuka Lead!*\n\nLead imekaa siku 3+ bila mawasiliano:\n\n👤 *${lead.business_name || 'Lead yako'}*\n📞 ${lead.phone}\n\nWasiliana nao leo! 📈\n\n🔗 ${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/crm`
          await sendTextMessage(formatPhoneNumber(lead.phone), waMsg)
        }

        results.push(`Followup processed: ${lead.business_name || lead.id}`)
      } catch (err) {
        errors.push(`Followup ${schedule.id}: ${(err as Error).message}`)
        await admin.from('followup_schedules').update({ status: 'failed' }).eq('id', schedule.id)
      }
    }

    // Auto-schedule next followup for leads that have been in a stage too long
    try {
      const staleThreshold = new Date()
      staleThreshold.setDate(staleThreshold.getDate() - 3) // 3 days without contact

      const { data: staleLeads } = await admin
        .from('agent_leads')
        .select('id, business_name, assigned_to, pipeline_stage')
        .not('pipeline_stage', 'in', '(closed,lost)')
        .lt('last_contacted_at', staleThreshold.toISOString())
        .not('assigned_to', 'is', null)
        .limit(20)

      for (const lead of staleLeads || []) {
        // Check no pending followup already exists
        const { data: existing } = await admin
          .from('followup_schedules')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('status', 'pending')
          .single()

        if (!existing) {
          const scheduledAt = new Date()
          scheduledAt.setHours(scheduledAt.getHours() + 2) // 2 hours from now

          await admin.from('followup_schedules').insert({
            lead_id: lead.id,
            followup_type: 'call',
            scheduled_at: scheduledAt.toISOString(),
            message: `Lead ${lead.business_name || ''} haikuwasiliana kwa siku 3+`,
            status: 'pending',
            created_by: null,
          })
          results.push(`Auto-scheduled followup for stale lead: ${lead.business_name || lead.id}`)
        }
      }
    } catch (err) {
      errors.push(`Auto-schedule stale: ${(err as Error).message}`)
    }

    return NextResponse.json({ ok: true, results, errors })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: (err as Error).message,
      results,
      errors,
    }, { status: 500 })
  }
}
