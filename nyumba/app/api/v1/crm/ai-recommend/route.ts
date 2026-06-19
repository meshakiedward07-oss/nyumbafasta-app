import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY haipo' }, { status: 500 })
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const { lead_id } = await req.json()

    const { data: lead } = await supabaseAdmin
      .from('agent_leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (!lead) return NextResponse.json({ error: 'Lead haikupatikana' }, { status: 404 })

    const [{ data: comms }, { data: calls }] = await Promise.all([
      supabaseAdmin
        .from('lead_communications')
        .select('type, content, created_at')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('call_logs')
        .select('outcome, notes, called_at')
        .eq('lead_id', lead_id)
        .order('called_at', { ascending: false })
        .limit(5),
    ])

    const prompt = `
Wewe ni AI advisor wa NyumbaFasta CRM Tanzania.
Chunguza lead hii na utoe mapendekezo ya hatua inayofaa.

LEAD INFO:
Jina: ${lead.business_name}
Simu: ${lead.phone}
Mkoa: ${lead.region}
Pipeline Stage: ${lead.pipeline_stage || 'new'}
AI Score: ${lead.ai_score}/100
Last Contact: ${lead.last_contacted_at || 'Haijawahi'}
Budget: ${lead.budget_min ? `Tsh ${lead.budget_min} - ${lead.budget_max}` : 'Haijulikani'}

HISTORY (${comms?.length || 0} interactions):
${comms?.map(c => `- ${c.type}: ${String(c.content).slice(0, 100)}`).join('\n') || 'Hakuna'}

CALL LOGS (${calls?.length || 0} calls):
${calls?.map(c => `- ${c.outcome}: ${String(c.notes || '').slice(0, 100)}`).join('\n') || 'Hakuna'}

Jibu kwa JSON tu (bila markdown, bila maelezo ya nje):
{
  "recommendation": "Shauri moja fupi la Kiswahili (max maneno 30)",
  "action": "call|whatsapp|viewing|send_photos|close_deal|nurture",
  "priority": 1-10,
  "reasoning": "Sababu fupi kwa Kiswahili",
  "best_time": "asubuhi|mchana|jioni",
  "message_hint": "Ujumbe mfupi wa kutumia"
}
`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI response si JSON')

    const result = JSON.parse(jsonMatch[0]) as {
      recommendation: string
      action: string
      priority: number
      reasoning: string
      best_time: string
      message_hint: string
    }

    await supabaseAdmin.from('ai_recommendations').insert({
      lead_id,
      recommendation: result.recommendation,
      action: result.action,
      priority: result.priority,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
