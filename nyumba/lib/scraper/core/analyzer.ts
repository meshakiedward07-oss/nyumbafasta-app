import Anthropic from '@anthropic-ai/sdk'
import { LeadSource } from '@/lib/agent/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export type AnalysisResult = {
  is_agent: boolean
  business_name: string
  phone: string | null
  email: string | null
  whatsapp: string | null
  region: string
  district: string | null
  website: string | null
  facebook_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  score: number
  notes: string
  confidence: 'high' | 'medium' | 'low'
}

export async function analyzeWithClaude(
  data: {
    name?: string
    text: string
    url?: string
    source: LeadSource
    region_hint: string
    extra?: Record<string, unknown>
  }
): Promise<AnalysisResult | null> {
  try {
    const prompt = `
Wewe ni AI analyst wa NyumbaFasta Tanzania.
Kazi yako: Chunguza data hii na uamue kama ni dalali wa nyumba Tanzania.

SOURCE: ${data.source}
REGION HINT: ${data.region_hint}
URL: ${data.url || 'haijulikani'}

DATA:
${data.text.slice(0, 3000)}

EXTRA INFO:
${JSON.stringify(data.extra || {}, null, 2).slice(0, 500)}

Jibu kwa JSON tu — hakuna maandishi mengine kabla au baada:
{
  "is_agent": true/false,
  "business_name": "jina kamili la biashara",
  "phone": "+255XXXXXXXXX au null",
  "email": "email@example.com au null",
  "whatsapp": "+255XXXXXXXXX au null",
  "region": "mkoa sahihi wa Tanzania",
  "district": "wilaya au mtaa au null",
  "website": "https://... au null",
  "facebook_url": "https://facebook.com/... au null",
  "instagram_url": "https://instagram.com/... au null",
  "tiktok_url": "https://tiktok.com/... au null",
  "score": 0-100,
  "notes": "maelezo mafupi kwa Kiswahili",
  "confidence": "high/medium/low"
}

SCORING (jumla 100):
+25 Ana nambari ya simu Tanzania (+255...)
+20 Ana listings za nyumba/mali halisi
+15 Ana website au social media ya biashara
+15 Ametaja bei za nyumba au kukodisha
+15 Ana reviews nzuri au followers wengi
+10 Ana WhatsApp ya biashara

SHERIA:
- is_agent = true TU kama anauza/kupangisha nyumba Tanzania
- Kama si dalali wa nyumba — is_agent = false
- Phone lazima ianze +255 (Tanzania tu)
- Region lazima iwe mkoa halisi wa Tanzania
- Jibu JSON tu — hakuna maelezo mengine
`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const result = JSON.parse(jsonMatch[0]) as AnalysisResult

    if (!result.is_agent) return null
    if (!result.business_name) return null
    if (result.score < 30) return null

    return result

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Claude analysis error:', msg)
    return null
  }
}
