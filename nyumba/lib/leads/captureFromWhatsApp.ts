import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { LeadSource } from '@/lib/agent/types'

export interface DalaliLeadData {
  phoneNumber?: string       // WhatsApp phone (e.g. 255712345678)
  socialId?: string          // Instagram/Facebook sender ID (when no phone available)
  name?: string
  region?: string
  conversationSummary: string
  signal: string
  confidence: number
  source: LeadSource         // 'whatsapp_amina' | 'instagram_amina' | 'facebook_amina'
}

export async function captureDalaliLead(
  data: DalaliLeadData,
): Promise<{ created: boolean; leadId?: string; reason?: string }> {
  const identifierPhone = data.phoneNumber?.replace(/\D/g, '') ?? null

  // Skip if already a registered dalali (match on last 9 digits of phone)
  if (identifierPhone) {
    const last9 = identifierPhone.slice(-9)
    const { data: existingDalali } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'dalali')
      .ilike('phone', `%${last9}`)
      .maybeSingle()

    if (existingDalali) {
      console.log('[Lead Capture] Already a registered dalali:', identifierPhone.slice(0, 4) + '****')
      return { created: false, reason: 'already_dalali' }
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Duplicate check by phone (WhatsApp) or social source_id
  if (identifierPhone) {
    const { data: existingLead } = await supabaseAdmin
      .from('agent_leads')
      .select('id')
      .eq('phone', identifierPhone)
      .gte('created_at', thirtyDaysAgo)
      .maybeSingle()

    if (existingLead) {
      console.log('[Lead Capture] Duplicate within 30 days (phone):', identifierPhone.slice(0, 4) + '****')
      await supabaseAdmin.from('lead_communications').insert({
        lead_id: existingLead.id,
        type: 'note',
        direction: 'inbound',
        content: `Mawasiliano ya ziada kupitia ${data.source}: ${data.conversationSummary.slice(0, 200)}`,
      })
      return { created: false, reason: 'already_captured', leadId: existingLead.id }
    }
  } else if (data.socialId) {
    const { data: existingLead } = await supabaseAdmin
      .from('agent_leads')
      .select('id')
      .eq('source_id', data.socialId)
      .gte('created_at', thirtyDaysAgo)
      .maybeSingle()

    if (existingLead) {
      console.log('[Lead Capture] Duplicate within 30 days (social ID):', data.socialId.slice(0, 6) + '***')
      await supabaseAdmin.from('lead_communications').insert({
        lead_id: existingLead.id,
        type: 'note',
        direction: 'inbound',
        content: `Mawasiliano ya ziada kupitia ${data.source}: ${data.conversationSummary.slice(0, 200)}`,
      })
      return { created: false, reason: 'already_captured', leadId: existingLead.id }
    }
  }

  const displayPhone = identifierPhone
    ? `${identifierPhone.slice(0, 4)}****${identifierPhone.slice(-3)}`
    : data.socialId?.slice(0, 6) + '***'

  const { data: newLead, error } = await supabaseAdmin
    .from('agent_leads')
    .insert({
      business_name: data.name || `Dalali (${data.source === 'whatsapp_amina' ? 'WhatsApp' : data.source.replace('_amina', '')} ${identifierPhone?.slice(-4) ?? data.socialId?.slice(-4) ?? ''})`,
      phone: identifierPhone ?? null,
      whatsapp: data.source === 'whatsapp_amina' ? (identifierPhone ?? null) : null,
      region: data.region ?? null,
      source: data.source,
      source_id: data.socialId ?? null,
      status: 'new',
      ai_score: Math.min(Math.max(Math.round(data.confidence), 0), 100),
      ai_notes: `Amina alitambua: ${data.signal} (confidence: ${data.confidence}%)`,
      ai_analyzed_at: new Date().toISOString(),
      notes: `Chanzo: ${data.source}\nMuhtasari: ${data.conversationSummary.slice(0, 300)}`,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Lead Capture] Insert failed:', error.message)
    return { created: false, reason: error.message }
  }

  console.log('[Lead Capture] New lead created:', newLead.id, 'from', displayPhone)
  void notifyAdminNewLead(newLead.id, data, displayPhone ?? 'Haijulikani')

  return { created: true, leadId: newLead.id }
}

async function notifyAdminNewLead(
  leadId: string,
  data: DalaliLeadData,
  displayPhone: string,
): Promise<void> {
  try {
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER
    if (!adminPhone) return

    const { sendTextMessage } = await import('@/lib/whatsapp/client')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

    const platformLabel =
      data.source === 'whatsapp_amina' ? 'WhatsApp' :
      data.source === 'instagram_amina' ? 'Instagram DM' : 'Facebook DM'

    await sendTextMessage(
      adminPhone,
      `🆕 *Dalali Lead Mpya* — Amina amegundua!\n\n` +
      `📲 Chanzo: ${platformLabel}\n` +
      `📞 Namba: ${displayPhone}\n` +
      `👤 Jina: ${data.name ?? 'Haijulikani'}\n` +
      `📍 Mkoa: ${data.region ?? 'Haijulikani'}\n` +
      `📊 Imani: ${data.confidence}%\n` +
      `🔍 Ishara: ${data.signal}\n\n` +
      `💬 Ujumbe: "${data.conversationSummary.slice(0, 120)}${data.conversationSummary.length > 120 ? '...' : ''}"\n\n` +
      `🆔 Lead ID: ${leadId.slice(0, 8)}...\n` +
      `🔗 Leads: ${appUrl}/admin/leads`,
    )
  } catch (err) {
    console.error('[Lead Capture] Admin notify failed:', err)
  }
}
