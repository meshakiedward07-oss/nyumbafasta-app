import { findBestKBArticle } from '@/lib/knowledge/embeddings'
import { lookupCache, recordCacheHit, addToCache, getCascadeConfig } from '@/lib/knowledge/index'
import { logMiss } from '@/lib/knowledge/missLog'

export interface CascadeResult {
  answered:      boolean
  answer:        string
  confidence:    number
  layerAnswered: 'cache' | 'knowledge_base' | null
  // Closest KB content, passed as retrieved context to Amina (Phase 4)
  retrieved:     Array<{ source: string; content: string; confidence: number }>
}

export interface CascadeOptions {
  phoneNumber?: string
  sessionId?:   string
  flowType?:    string
}

// ── Cascade: cache → knowledge_base → miss log ────────────────────────────────
// 1. pg_trgm cache lookup (pure DB, no AI)
// 2. PostgreSQL FTS candidates → Haiku picks best (cheap AI)
// 3. Miss: log + return retrieved items for Amina to use as context

export async function runCascade(
  messageText: string,
  options: CascadeOptions = {},
): Promise<CascadeResult> {
  const t0  = Date.now()
  const cfg = await getCascadeConfig()

  // ── 1. Cache lookup (pg_trgm, no AI call) ────────────────────────────────
  const cacheHit = await lookupCache(messageText, cfg.cache_similarity_threshold)
  console.log(`[Cascade] cache sim=${cacheHit?.similarity?.toFixed(3) ?? '—'} threshold=${cfg.cache_similarity_threshold} (${Date.now() - t0}ms)`)

  if (cacheHit && cacheHit.similarity >= cfg.cache_similarity_threshold) {
    void recordCacheHit(cacheHit.id)
    return {
      answered:      true,
      answer:        cacheHit.answer,
      confidence:    cacheHit.similarity,
      layerAnswered: 'cache',
      retrieved:     [{ source: 'cache', content: cacheHit.answer, confidence: cacheHit.similarity }],
    }
  }

  // ── 2. KB lookup: FTS candidates → Haiku pick ────────────────────────────
  const kbResult = await findBestKBArticle(messageText)
  console.log(`[Cascade] kb conf=${kbResult.confidence.toFixed(3)} threshold=${cfg.kb_confidence_threshold} slug=${kbResult.candidate?.slug ?? '—'} (${Date.now() - t0}ms)`)

  if (kbResult.candidate && kbResult.confidence >= cfg.kb_confidence_threshold) {
    const { title, body } = kbResult.candidate
    const answer = title ? `*${title}*\n\n${body}` : body
    return {
      answered:      true,
      answer,
      confidence:    kbResult.confidence,
      layerAnswered: 'knowledge_base',
      retrieved:     [{ source: 'knowledge_base', content: body, confidence: kbResult.confidence }],
    }
  }

  // ── 3. Miss — log and hand off ────────────────────────────────────────────
  console.log(`[Cascade] MISS (${Date.now() - t0}ms)`)

  void logMiss(messageText, 'knowledge_base', {
    phoneNumber:      options.phoneNumber,
    sessionId:        options.sessionId,
    flowType:         options.flowType,
    bestCacheSim:     cacheHit?.similarity ?? 0,
    bestKbSim:        kbResult.confidence,
    searchHadResults: !!kbResult.candidate,
  })

  const retrieved = kbResult.candidate
    ? [{ source: 'knowledge_base', content: kbResult.candidate.body, confidence: kbResult.confidence }]
    : []

  return {
    answered:      false,
    answer:        '',
    confidence:    Math.max(cacheHit?.similarity ?? 0, kbResult.confidence),
    layerAnswered: null,
    retrieved,
  }
}

// ── Cache Amina's answer for future identical questions ───────────────────────
// Fire-and-forget — never awaited in the hot path.

export function cacheAminaAnswer(question: string, answer: string): void {
  addToCache(question, answer, 'amina_answer')
    .catch(err => console.error('[Cascade] cache write failed (non-fatal):', err))
}
