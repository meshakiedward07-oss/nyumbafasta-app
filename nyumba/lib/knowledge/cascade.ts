import { embed, normaliseQuery } from '@/lib/knowledge/embeddings'
import { semanticSearch, getCascadeConfig, addToCache, recordCacheHit } from '@/lib/knowledge/index'
import { logMiss } from '@/lib/knowledge/missLog'

export interface CascadeResult {
  answered:     boolean
  answer:       string
  confidence:   number
  layerAnswered: 'cache' | 'knowledge_base' | null
  // Top retrieved items (used in Phase 4 to inject context into Amina)
  retrieved:    Array<{ source: string; content: string; similarity: number }>
}

export interface CascadeOptions {
  phoneNumber?: string
  sessionId?:   string
  flowType?:    string
}

// ── Cascade: cache → knowledge_base → miss log ────────────────────────────────
// Returns a result with answered=true if a confident match was found,
// or answered=false with retrieved[] populated for Amina to use as context.

export async function runCascade(
  messageText: string,
  options: CascadeOptions = {},
): Promise<CascadeResult> {
  const t0 = Date.now()

  // 1. Get config (cached at function level — low DB cost)
  const cfg = await getCascadeConfig()

  // 2. Embed the query
  const normalised = normaliseQuery(messageText)
  let embedding: number[]
  try {
    embedding = await embed(normalised)
  } catch (err) {
    console.error('[Cascade] embed failed (falling through to Amina):', err)
    return { answered: false, answer: '', confidence: 0, layerAnswered: null, retrieved: [] }
  }
  console.log(`[Cascade] embed done (${Date.now() - t0}ms)`)

  // 3. Search cache + knowledge_base together via the unified RPC
  //    We fetch up to 5 results so the top ones can be fed to Amina as context
  const results = await semanticSearch(embedding, Math.min(cfg.cache_threshold, cfg.kb_threshold) - 0.05, 5)
  console.log(`[Cascade] search done (${Date.now() - t0}ms) results=${results.length}`)

  const bestCacheSim = results.find(r => r.source === 'cache')?.similarity ?? 0
  const bestKbSim    = results.find(r => r.source === 'knowledge_base')?.similarity ?? 0

  // 4a. Cache hit — highest bar (near-exact answer)
  const cacheHit = results.find(r => r.source === 'cache' && r.similarity >= cfg.cache_threshold)
  if (cacheHit) {
    console.log(`[Cascade] cache HIT sim=${cacheHit.similarity.toFixed(3)} (${Date.now() - t0}ms)`)
    void recordCacheHit(cacheHit.id)
    return {
      answered:     true,
      answer:       cacheHit.content,
      confidence:   cacheHit.similarity,
      layerAnswered: 'cache',
      retrieved:    results.map(r => ({ source: r.source, content: r.content, similarity: r.similarity })),
    }
  }

  // 4b. Knowledge-base hit — slightly lower bar (article needs to be returned as-is)
  const kbHit = results.find(r => r.source === 'knowledge_base' && r.similarity >= cfg.kb_threshold)
  if (kbHit) {
    console.log(`[Cascade] kb HIT sim=${kbHit.similarity.toFixed(3)} (${Date.now() - t0}ms)`)
    const answer = kbHit.title ? `*${kbHit.title}*\n\n${kbHit.content}` : kbHit.content
    return {
      answered:     true,
      answer,
      confidence:   kbHit.similarity,
      layerAnswered: 'knowledge_base',
      retrieved:    results.map(r => ({ source: r.source, content: r.content, similarity: r.similarity })),
    }
  }

  // 5. Nothing cleared threshold — log miss and return context for Amina
  console.log(`[Cascade] MISS bestCache=${bestCacheSim.toFixed(3)} bestKb=${bestKbSim.toFixed(3)} (${Date.now() - t0}ms)`)

  void logMiss(messageText, bestCacheSim > bestKbSim ? 'cache' : 'knowledge_base', {
    phoneNumber:  options.phoneNumber,
    sessionId:    options.sessionId,
    flowType:     options.flowType,
    bestCacheSim,
    bestKbSim,
    searchHadResults: results.length > 0,
  })

  return {
    answered:     false,
    answer:       '',
    confidence:   Math.max(bestCacheSim, bestKbSim),
    layerAnswered: null,
    // Pass top results to Amina even though none cleared the threshold —
    // these become the "retrieved context" in Phase 4
    retrieved:    results.slice(0, 3).map(r => ({ source: r.source, content: r.content, similarity: r.similarity })),
  }
}

// ── Cache Amina's answer so similar questions get a direct hit next time ──────
// Called after Amina responds. Non-blocking.

export function cacheAminaAnswer(
  question:  string,
  answer:    string,
): void {
  embed(normaliseQuery(question))
    .then(embedding => addToCache(question, answer, embedding, 'amina_answer'))
    .catch(err => console.error('[Cascade] cache write failed (non-fatal):', err))
}
