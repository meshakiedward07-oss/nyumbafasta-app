import { findBestKBArticle } from '@/lib/knowledge/embeddings'
import { lookupCache, recordCacheHit, addToCache, getCascadeConfig } from '@/lib/knowledge/index'
import { logMiss } from '@/lib/knowledge/missLog'
import { extractEntities } from '@/lib/knowledge/entities'
import { searchListings, searchVendors, noResultsMessage } from '@/lib/knowledge/structuredSearch'

export interface CascadeResult {
  answered:      boolean
  answer:        string
  confidence:    number
  layerAnswered: 'cache' | 'knowledge_base' | 'search' | null
  // Closest KB content passed to Amina as context (Phase 4)
  retrieved:     Array<{ source: string; content: string; confidence: number }>
}

export interface CascadeOptions {
  phoneNumber?: string
  sessionId?:   string
  flowType?:    string
  orgId?:       string   // set when user has a known org context (property management)
}

// ── Cascade: cache → (KB ∥ entities) → structured search → miss ──────────────
//
// Layer order:
//   1. pg_trgm cache lookup           (pure DB, no AI)
//   2a. KB FTS candidates → Haiku     (cheap AI, parallel with 2b)
//   2b. Entity extraction → Haiku     (cheap AI, parallel with 2a)
//   3. Structured DB search           (pure DB, if entities say it's a search)
//   4. Miss → Amina gets context      (full AI, only when all above fail)

export async function runCascade(
  messageText: string,
  options: CascadeOptions = {},
): Promise<CascadeResult> {
  const t0  = Date.now()
  const cfg = await getCascadeConfig()

  // ── 1. Cache lookup (pg_trgm, no AI) ─────────────────────────────────────
  const cacheHit = await lookupCache(messageText, cfg.cache_similarity_threshold)
  console.log(`[Cascade] cache sim=${cacheHit?.similarity?.toFixed(3) ?? '—'} (${Date.now() - t0}ms)`)

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

  // ── 2. KB lookup and entity extraction run in parallel ────────────────────
  const [kbResult, entities] = await Promise.all([
    findBestKBArticle(messageText),
    extractEntities(messageText),
  ])
  console.log(`[Cascade] kb conf=${kbResult.confidence.toFixed(3)} slug=${kbResult.candidate?.slug ?? '—'} | search=${entities.is_search} type=${entities.search_type} conf=${entities.confidence.toFixed(2)} (${Date.now() - t0}ms)`)

  // ── 3. Structured search — takes priority when intent is clear ────────────
  // The spec says: a search request should be routed to structured search
  // BEFORE the KB confidence gate, because searching and answering a question
  // are different response types.
  if (entities.is_search && entities.confidence >= 0.5) {

    if (entities.search_type === 'listing') {
      const listingAnswer = await searchListings(entities)
      console.log(`[Cascade] search listings → ${listingAnswer ? 'HIT' : 'MISS'} (${Date.now() - t0}ms)`)

      if (listingAnswer) {
        return {
          answered:      true,
          answer:        listingAnswer,
          confidence:    entities.confidence,
          layerAnswered: 'search',
          retrieved:     [],
        }
      }

      // Search ran but found nothing — tell the user rather than silently
      // falling to Amina with no context about what was tried
      const noResults = noResultsMessage(entities)
      void logMiss(messageText, 'search', {
        phoneNumber:      options.phoneNumber,
        sessionId:        options.sessionId,
        flowType:         options.flowType,
        bestCacheSim:     cacheHit?.similarity ?? 0,
        bestKbSim:        kbResult.confidence,
        searchHadResults: false,
      })
      return {
        answered:      true,   // we answer with "nothing found" — Amina not needed
        answer:        noResults,
        confidence:    entities.confidence,
        layerAnswered: 'search',
        retrieved:     [],
      }
    }

    if (entities.search_type === 'vendor') {
      const vendorAnswer = await searchVendors(entities, options.orgId)
      if (vendorAnswer) {
        return {
          answered:      true,
          answer:        vendorAnswer,
          confidence:    entities.confidence,
          layerAnswered: 'search',
          retrieved:     [],
        }
      }
      // No org context or no vendor results → fall through to KB / Amina
    }
  }

  // ── 4a. KB hit ────────────────────────────────────────────────────────────
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

  // ── 4b. Miss ──────────────────────────────────────────────────────────────
  console.log(`[Cascade] MISS (${Date.now() - t0}ms)`)

  void logMiss(messageText, 'knowledge_base', {
    phoneNumber:      options.phoneNumber,
    sessionId:        options.sessionId,
    flowType:         options.flowType,
    bestCacheSim:     cacheHit?.similarity ?? 0,
    bestKbSim:        kbResult.confidence,
    searchHadResults: entities.is_search,
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

export function cacheAminaAnswer(question: string, answer: string): void {
  addToCache(question, answer, 'amina_answer')
    .catch(err => console.error('[Cascade] cache write failed (non-fatal):', err))
}
