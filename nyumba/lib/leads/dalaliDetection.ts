import Anthropic from '@anthropic-ai/sdk'

export interface DalaliSignal {
  isDalaliProspect: boolean
  confidence: number
  signal: string
}

// 90% confidence — person explicitly states they are/want to be a dalali
const EXPLICIT_PHRASES = [
  'mimi ni dalali',
  'nina nyumba za kuuza',
  'nina nyumba za kupanga',
  'nina nyumba za kukodisha',
  'nataka kujiunga kama dalali',
  'nataka kuorodhesha nyumba',
  'ninaweza kuweka listing',
  'nina mali nyingi',
  'nina majengo',
  'nataka kuuza nyumba zangu',
  'weka nyumba zangu',
  'post nyumba zangu',
  'jiunge kama dalali',
  'kuwa dalali',
  'how to list my property',
  'nataka kuuza nyumba kupitia',
  'naweza kuorodhesha nyumba',
  'nina apartment za kukodisha',
  'nina plot',
  'ninauza nyumba',
  'ninakodisha nyumba',
]

// 60% confidence — asking questions a dalali prospect would ask
const MEDIUM_PHRASES = [
  'commission ya',
  'kamisheni ya',
  'ada ya kuorodhesha',
  'subscription fee',
  'nawezaje kuwa dalali',
  'listing zangu',
  'nyumba zangu kwa kukodisha',
  'naweza kuweka nyumba',
  'kupost nyumba zangu',
  'dalali wa nyumba',
  'kuweka listings',
  'dashboard ya dalali',
  'subscribers wa dalali',
  'dalali plan',
  'bei ya plan',
]

export async function detectDalaliIntent(
  message: string,
  conversationHistory: { role: string; content: string }[] = [],
): Promise<DalaliSignal> {
  const lower = message.toLowerCase()

  for (const phrase of EXPLICIT_PHRASES) {
    if (lower.includes(phrase)) {
      return { isDalaliProspect: true, confidence: 90, signal: `explicit: "${phrase}"` }
    }
  }

  for (const phrase of MEDIUM_PHRASES) {
    if (lower.includes(phrase)) {
      return { isDalaliProspect: true, confidence: 60, signal: `medium: "${phrase}"` }
    }
  }

  // AI fallback only for messages with property-business context and some conversation history
  const hasPropertyContext = (
    lower.includes('nyumba') ||
    lower.includes('listing') ||
    lower.includes('property') ||
    lower.includes('chumba') ||
    lower.includes('apartment')
  )
  if (hasPropertyContext && conversationHistory.length >= 1) {
    return await checkWithAI(message, conversationHistory)
  }

  return { isDalaliProspect: false, confidence: 0, signal: '' }
}

async function checkWithAI(
  message: string,
  history: { role: string; content: string }[],
): Promise<DalaliSignal> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const recentContext = history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `Je, mtu huyu ni DALALI (real estate agent) anayetaka kujiunga au kuorodhesha nyumba kwenye NyumbaFasta, na SIO mteja wa kawaida anayetafuta kupanga/kununua nyumba?

Mazungumzo:
${recentContext}
Ujumbe wa sasa: ${message}

Jibu JSON tu: {"is_dalali": true/false, "confidence": 0-100}`,
      }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text : '{}'
    const match = text.match(/\{[\s\S]*?\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as { is_dalali?: boolean; confidence?: number }
      return {
        isDalaliProspect: parsed.is_dalali === true,
        confidence: Number(parsed.confidence) || 0,
        signal: 'ai_detected',
      }
    }
  } catch {
    // non-fatal — keyword detection already ran
  }
  return { isDalaliProspect: false, confidence: 0, signal: '' }
}
