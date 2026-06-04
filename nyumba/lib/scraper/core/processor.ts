import { analyzeWithClaude, AnalysisResult } from './analyzer'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { LeadSource } from '@/lib/agent/types'
import { sleep } from '../utils/browser'

export type RawItem = {
  text: string
  name?: string
  url?: string
  extra?: Record<string, unknown>
}

export type ProcessStats = {
  total: number
  analyzed: number
  saved: number
  duplicates: number
  low_score: number
  errors: number
  leads: AnalysisResult[]
}

export async function processItems(
  items: RawItem[],
  source: LeadSource,
  region: string
): Promise<ProcessStats> {
  const stats: ProcessStats = {
    total: items.length,
    analyzed: 0,
    saved: 0,
    duplicates: 0,
    low_score: 0,
    errors: 0,
    leads: []
  }

  console.log(`\n🤖 Processing ${items.length} items from ${source}...`)

  for (const item of items) {
    try {
      const analysis = await analyzeWithClaude({
        name: item.name,
        text: item.text,
        url: item.url,
        source,
        region_hint: region,
        extra: item.extra
      })

      stats.analyzed++

      if (!analysis) {
        stats.low_score++
        continue
      }

      const isDuplicate = await checkDuplicate(
        analysis.phone,
        analysis.business_name,
        analysis.region,
        source,
        item.url
      )

      if (isDuplicate) {
        stats.duplicates++
        continue
      }

      const saved = await saveLead(analysis, source, item)
      if (saved) {
        stats.saved++
        stats.leads.push(analysis)
        console.log(
          `✅ [${source}] ${analysis.business_name} ` +
          `(${analysis.score}/100) — ${analysis.phone || 'no phone'}`
        )
      } else {
        stats.duplicates++
      }

      await sleep(400)

    } catch (err: unknown) {
      stats.errors++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`❌ Process error:`, msg)
    }
  }

  return stats
}

async function checkDuplicate(
  phone: string | null,
  businessName: string,
  region: string,
  source: string,
  url?: string
): Promise<boolean> {
  if (phone) {
    const { data } = await supabaseAdmin
      .from('agent_leads')
      .select('id')
      .eq('phone', phone)
      .limit(1)
    if (data && data.length > 0) return true
  }

  if (url) {
    const { data } = await supabaseAdmin
      .from('agent_leads')
      .select('id')
      .eq('source_url', url)
      .limit(1)
    if (data && data.length > 0) return true
  }

  // suppress unused warning — source used for future filtering
  void source

  const { data } = await supabaseAdmin
    .from('agent_leads')
    .select('id')
    .ilike('business_name', businessName)
    .eq('region', region)
    .limit(1)
  if (data && data.length > 0) return true

  return false
}

async function saveLead(
  analysis: AnalysisResult,
  source: LeadSource,
  rawItem: RawItem
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('agent_leads')
      .insert({
        business_name: analysis.business_name,
        phone: analysis.phone,
        email: analysis.email,
        region: analysis.region,
        source,
        source_id: rawItem.url || null,
        source_url: rawItem.url || null,
        website_url: analysis.website,
        facebook_url: analysis.facebook_url,
        instagram_url: analysis.instagram_url,
        tiktok_url: analysis.tiktok_url,
        whatsapp: analysis.whatsapp || analysis.phone,
        ai_score: analysis.score,
        ai_notes: `${analysis.notes} [${analysis.confidence} confidence]`,
        ai_analyzed_at: new Date().toISOString(),
        status: 'new',
        raw_data: rawItem.extra || {}
      })

    return !error
  } catch (err) {
    console.error('Save error:', err)
    return false
  }
}
