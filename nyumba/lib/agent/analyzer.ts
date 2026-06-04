/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk'
import { ClaudeAnalysis, LeadSource } from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function analyzeLeadWithClaude(
  item: any,
  source: LeadSource
): Promise<ClaudeAnalysis | null> {
  try {
    const prompt = buildPrompt(item, source)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const result = JSON.parse(jsonMatch[0]) as ClaudeAnalysis

    if (!result.is_agent) return null

    if (result.phone) {
      result.phone = formatTanzaniaPhone(result.phone)
    }

    return result
  } catch (err) {
    console.error('Claude analyzer error:', err)
    return null
  }
}

function buildPrompt(item: any, source: LeadSource): string {
  const data = JSON.stringify(item, null, 2).slice(0, 2000)

  return `
Wewe ni AI analyst wa NyumbaFasta Tanzania.
Kazi yako: Chunguza data hii kutoka ${source} na uamue kama ni dalali wa nyumba/mali Tanzania.

DATA:
${data}

Jibu kwa JSON tu — hakuna maandishi mengine:
{
  "is_agent": true/false,
  "business_name": "jina la biashara",
  "phone": "nambari +255...",
  "email": "email au null",
  "region": "moja ya: Dar es Salaam/Arusha/Mwanza/Dodoma/Zanzibar/Mbeya/Haijulikani",
  "website": "url au null",
  "facebook_url": "url au null",
  "instagram_url": "url au null",
  "tiktok_url": "url au null",
  "whatsapp": "nambari au null",
  "score": 0-100,
  "notes": "maelezo mafupi kwa Kiswahili"
}

Scoring rules:
- Ana nambari ya simu Tanzania (+255): +25
- Ana listings za nyumba/mali: +25
- Ana reviews au followers: +20
- Ana website/social media: +15
- Ametaja bei za nyumba: +15

is_agent = true ONLY kama anauza/kupangisha nyumba/mali Tanzania.
`
}

function formatTanzaniaPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('255')) return '+' + cleaned
  if (cleaned.startsWith('0')) return '+255' + cleaned.slice(1)
  if (cleaned.length === 9) return '+255' + cleaned
  return phone
}
