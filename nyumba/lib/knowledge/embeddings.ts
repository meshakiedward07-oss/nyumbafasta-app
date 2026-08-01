// Haiku-based semantic KB article picker.
// Step 1: PostgreSQL FTS narrows the full KB to ≤10 candidates (no AI, pure DB).
// Step 2: Claude Haiku picks the best candidate from that short list (cheap AI).
// No external API — uses the same Anthropic SDK as Amina.

import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface KBCandidate {
  id:    string
  slug:  string
  title: string
  body:  string
}

export interface KBPickResult {
  candidate:  KBCandidate | null
  confidence: number
}

// ── Step 1: FTS candidate retrieval (pure DB, no AI) ─────────────────────────

export async function fetchKBCandidates(
  messageText: string,
  limit = 10,
): Promise<KBCandidate[]> {
  const { data, error } = await supabaseAdmin.rpc('nf_kb_candidates', {
    p_query: messageText,
    p_limit: limit,
  })
  if (error) {
    console.error('[KB] nf_kb_candidates error:', error.message)
    return []
  }
  return (data ?? []) as KBCandidate[]
}

// ── Step 2: Haiku picks the best candidate ───────────────────────────────────

export async function pickBestArticle(
  messageText: string,
  candidates:  KBCandidate[],
): Promise<KBPickResult> {
  if (candidates.length === 0) return { candidate: null, confidence: 0 }

  const articleList = candidates
    .map((c, i) => `${i + 1}. [${c.slug}] "${c.title}"`)
    .join('\n')

  const prompt = `You route WhatsApp messages for NyumbaFasta, a property platform in Tanzania.

User message: "${messageText.slice(0, 400)}"

Knowledge base articles (titles only):
${articleList}

Which article number (1-${candidates.length}) best answers this message?
Reply with JSON only — nothing else: {"choice": <number or 0>, "confidence": <0.0-1.0>}
Use choice=0 if no article clearly answers the question.`

  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text  = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = text.replace(/```[a-z]*/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(clean) as { choice: number; confidence: number }

    const idx = (parsed.choice ?? 0) - 1
    if (idx < 0 || idx >= candidates.length) return { candidate: null, confidence: 0 }

    return {
      candidate:  candidates[idx],
      confidence: Math.min(1, Math.max(0, parseFloat(String(parsed.confidence)) || 0)),
    }
  } catch (err) {
    console.error('[KB] Haiku pick failed:', err)
    return { candidate: null, confidence: 0 }
  }
}

// ── Combined: FTS candidates → Haiku pick ────────────────────────────────────

export async function findBestKBArticle(
  messageText: string,
): Promise<KBPickResult> {
  const candidates = await fetchKBCandidates(messageText)
  if (candidates.length === 0) return { candidate: null, confidence: 0 }
  return pickBestArticle(messageText, candidates)
}
