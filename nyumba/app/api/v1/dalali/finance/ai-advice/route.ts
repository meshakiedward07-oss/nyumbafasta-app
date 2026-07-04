import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stats } = await req.json()
    if (!stats?.summary) return NextResponse.json({ error: 'stats required' }, { status: 400 })

    const s = stats.summary
    const c = stats.commissions ?? {}
    const g = stats.goal

    const catLines = Object.entries(stats.incomeByCategory ?? {})
      .map(([k, v]) => `  - ${k}: TSh ${Math.round((v as number) / 1000)}K`).join('\n') || '  (hakuna data)'
    const expLines = Object.entries(stats.expenseByCategory ?? {})
      .map(([k, v]) => `  - ${k}: TSh ${Math.round((v as number) / 1000)}K`).join('\n') || '  (hakuna data)'

    const prompt = `Wewe ni Amina — mshauri wa biashara wa AI kwa madalali wa nyumba Tanzania.

Takwimu za biashara mwezi huu:

MAPATO:
- Leo: TSh ${Math.round(s.today / 1000)}K
- Wiki hii: TSh ${Math.round(s.week / 1000)}K
- Mwezi huu: TSh ${Math.round(s.monthIncome / 1000)}K
- Mwaka huu: TSh ${Math.round(s.yearIncome / 1000)}K

MATUMIZI MWEZI HUU: TSh ${Math.round(s.monthExpenses / 1000)}K
FAIDA HALISI: TSh ${Math.round(s.monthProfit / 1000)}K

COMMISSION:
- Inasubiri: TSh ${Math.round((c.pending ?? 0) / 1000)}K
- Imechelewa: TSh ${Math.round((c.overdue ?? 0) / 1000)}K
- Imelipwa: TSh ${Math.round((c.paid ?? 0) / 1000)}K

LENGO LA MWEZI: ${g ? `Target TSh ${Math.round(g.target_amount / 1000)}K — Sasa TSh ${Math.round(g.current_amount / 1000)}K (${Math.round(g.current_amount / g.target_amount * 100)}%)` : 'Halijawekwa'}

MAPATO KWA AINA:
${catLines}

MATUMIZI KWA AINA:
${expLines}

Toa ushauri wa vitendo 3-4 kwa Kiswahili. Kuwa mfupi na wa msaada. Kila ushauri uanze na emoji moja. Tumia takwimu halisi. Usiulize maswali.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    })

    const advice = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return NextResponse.json({ advice })
  } catch (e) {
    console.error('[finance/ai-advice]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
