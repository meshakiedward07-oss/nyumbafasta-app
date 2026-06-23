// Server-only CRM functions — safe to import only from API routes and server components
import { createAdminClient } from '@/lib/supabase/server'
import {
  PIPELINE_STAGES,
  SOURCE_LABELS,
  type PipelineStage,
  type DalaliLead,
} from './constants'

export { PIPELINE_STAGES, SOURCE_LABELS, type PipelineStage, type DalaliLead }

// ── getLeads ──────────────────────────────────────────────────────────────────
export async function getLeads(params: {
  staffId?:         string
  isAdmin?:         boolean
  stage?:           string
  search?:          string
  page?:            number
  limit?:           number
  includeArchived?: boolean
}): Promise<{ leads: DalaliLead[]; total: number; byStage: Record<string, number> }> {
  const db    = createAdminClient()
  const limit = params.limit ?? 50
  const page  = params.page  ?? 0
  const from  = page * limit
  const to    = from + limit - 1

  let query = db
    .from('agent_leads')
    .select(`
      id, business_name, phone, whatsapp, region, source,
      pipeline_stage, assigned_to, assigned_at,
      last_contacted_at, contact_attempts, next_followup_at,
      notes, converted_to_profile_id, converted_at,
      first_listing_id, first_listing_at, status,
      created_at, updated_at,
      assigned_staff:users!assigned_to ( id, full_name, phone ),
      converted_profile:users!converted_to_profile_id ( id, full_name )
    `, { count: 'exact' })

  if (!params.isAdmin && params.staffId) {
    query = query.eq('assigned_to', params.staffId)
  }

  if (params.stage && params.stage !== 'all') {
    query = query.eq('pipeline_stage', params.stage)
  } else if (!params.includeArchived) {
    query = query.not('pipeline_stage', 'in', '("amefanikiwa","amepotea")')
  }

  if (params.search) {
    const q = params.search.replace(/[%_]/g, '\\$&')
    query = query.or(
      `business_name.ilike.%${q}%,phone.ilike.%${q}%,region.ilike.%${q}%`,
    )
  }

  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data, count } = await query

  // Stage counts (always full DB)
  const { data: allLeads } = await db
    .from('agent_leads')
    .select('pipeline_stage')

  const byStage: Record<string, number> = {}
  PIPELINE_STAGES.forEach(s => { byStage[s.key] = 0 })
  allLeads?.forEach(l => {
    if (byStage[l.pipeline_stage] !== undefined) byStage[l.pipeline_stage]++
  })

  return {
    leads: (data as unknown as DalaliLead[]) || [],
    total: count || 0,
    byStage,
  }
}

// ── moveLeadStage ─────────────────────────────────────────────────────────────
export async function moveLeadStage(
  leadId:   string,
  newStage: PipelineStage,
  staffId:  string,
  note?:    string,
): Promise<{ success: boolean; error?: string }> {
  const db = createAdminClient()

  const { data: lead } = await db
    .from('agent_leads')
    .select('pipeline_stage')
    .eq('id', leadId)
    .single()

  if (!lead) return { success: false, error: 'Lead haikupatikana' }

  const oldStage = lead.pipeline_stage as string

  const { error } = await db
    .from('agent_leads')
    .update({ pipeline_stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { success: false, error: error.message }

  const oldLabel = PIPELINE_STAGES.find(s => s.key === oldStage)?.label || oldStage
  const newLabel = PIPELINE_STAGES.find(s => s.key === newStage)?.label || newStage

  await db.from('lead_communications').insert({
    lead_id:   leadId,
    user_id:   staffId,
    type:      'note',
    direction: 'internal',
    content:   note || `Stage: ${oldLabel} → ${newLabel}`,
  })

  return { success: true }
}

// ── logActivity ────────────────────────────────────────────────────────────────
export async function logActivity(params: {
  leadId:      string
  staffId?:    string
  type:        'call' | 'whatsapp' | 'note'
  description: string
}): Promise<void> {
  const db = createAdminClient()
  await db.from('lead_communications').insert({
    lead_id:   params.leadId,
    user_id:   params.staffId ?? null,
    type:      params.type,
    direction: 'outbound',
    content:   params.description,
  })
}

// ── getLeadActivities ─────────────────────────────────────────────────────────
export async function getLeadActivities(leadId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('lead_communications')
    .select(`
      id, type, direction, content, created_at,
      staff:users!user_id ( full_name )
    `)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(100)

  return data || []
}

// ── scheduleFollowup ──────────────────────────────────────────────────────────
export async function scheduleFollowup(
  leadId:     string,
  staffId:    string,
  followupAt: Date,
  note?:      string,
): Promise<void> {
  const db = createAdminClient()

  await db
    .from('agent_leads')
    .update({
      next_followup_at: followupAt.toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', leadId)

  await db.from('lead_communications').insert({
    lead_id:   leadId,
    user_id:   staffId,
    type:      'note',
    direction: 'internal',
    content:   `Follow-up imepangwa: ${followupAt.toLocaleDateString('sw-TZ')}${note ? ` — ${note}` : ''}`,
  })
}

// ── getCRMStats ────────────────────────────────────────────────────────────────
export async function getCRMStats(staffId?: string, isAdmin = false) {
  const db = createAdminClient()

  let q = db
    .from('agent_leads')
    .select('pipeline_stage, source, created_at, converted_at, next_followup_at, last_contacted_at')

  if (!isAdmin && staffId) q = q.eq('assigned_to', staffId)

  const { data: all } = await q
  const now = new Date()

  const byStage:  Record<string, number> = {}
  const bySource: Record<string, number> = {}
  PIPELINE_STAGES.forEach(s => { byStage[s.key] = 0 })

  let followupsDueToday = 0
  let neverContacted    = 0
  let totalConverted    = 0
  let totalDaysToConvert = 0

  for (const l of all ?? []) {
    if (byStage[l.pipeline_stage] !== undefined) byStage[l.pipeline_stage]++
    bySource[l.source] = (bySource[l.source] || 0) + 1

    if (l.next_followup_at && new Date(l.next_followup_at) <= now) followupsDueToday++
    if (!l.last_contacted_at) neverContacted++

    if (l.converted_at) {
      totalConverted++
      totalDaysToConvert += Math.round(
        (new Date(l.converted_at).getTime() - new Date(l.created_at).getTime()) / 86400000,
      )
    }
  }

  const totalActive     = (all ?? []).length
  const conversionRate  = totalActive > 0
    ? parseFloat(((byStage.amefanikiwa / totalActive) * 100).toFixed(1))
    : 0
  const avgDaysToConvert = totalConverted > 0
    ? Math.round(totalDaysToConvert / totalConverted)
    : 0

  return {
    totalActive,
    byStage,
    bySource,
    conversionRate,
    avgDaysToConvert,
    followupsDueToday,
    uncontacted: neverContacted,
  }
}
