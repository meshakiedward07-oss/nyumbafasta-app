/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from './supabaseAdmin'
import { AgentLead, ClaudeAnalysis, LeadSource, SaveResult } from './types'

export async function saveLeadToSupabase(
  analysis: ClaudeAnalysis,
  source: LeadSource,
  rawItem: any,
  sourceId?: string
): Promise<SaveResult> {
  try {
    const lead: AgentLead = {
      business_name: analysis.business_name,
      phone: analysis.phone,
      email: analysis.email,
      region: analysis.region,
      source,
      source_id: sourceId || rawItem?.id || rawItem?.placeId || null,
      source_url: rawItem?.url || rawItem?.website || null,
      website_url: analysis.website,
      facebook_url: analysis.facebook_url,
      instagram_url: analysis.instagram_url,
      tiktok_url: analysis.tiktok_url,
      whatsapp: analysis.whatsapp || analysis.phone,
      ai_score: analysis.score,
      ai_notes: analysis.notes,
      ai_analyzed_at: new Date().toISOString(),
      status: 'new',
      raw_data: rawItem
    }

    if (lead.source_id) {
      const { data, error } = await supabaseAdmin
        .from('agent_leads')
        .upsert(lead, {
          onConflict: 'source,source_id',
          ignoreDuplicates: false
        })
        .select('id')
        .single()

      if (error) throw error

      console.log(`✅ Saved: ${lead.business_name} (${source})`)
      return { saved: true, id: data?.id, isNew: true }
    }

    if (lead.phone) {
      const { data: existing } = await supabaseAdmin
        .from('agent_leads')
        .select('id')
        .eq('phone', lead.phone)
        .single()

      if (existing) {
        console.log(`⏭️ Duplicate phone: ${lead.phone}`)
        return { saved: false, id: existing.id, isNew: false }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('agent_leads')
      .insert(lead)
      .select('id')
      .single()

    if (error) throw error

    console.log(`✅ New lead: ${lead.business_name}`)
    return { saved: true, id: data?.id, isNew: true }

  } catch (err: any) {
    console.error('Save error:', err)
    return { saved: false, id: null, isNew: false, error: err.message }
  }
}
