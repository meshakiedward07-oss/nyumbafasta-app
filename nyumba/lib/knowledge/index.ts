import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export interface KBArticle {
  id:          string
  slug:        string
  title:       string
  body:        string
  category:    string
  language:    string
  is_active:   boolean
  created_by?: string
  created_at:  string
  updated_at:  string
}

export interface CacheEntry {
  id:          string
  question:    string
  answer:      string
  hit_count:   number
  source:      string
  is_active:   boolean
  last_hit_at: string
  created_at:  string
}

export interface SearchResult {
  id:         string
  source:     'cache' | 'knowledge_base'
  content:    string   // the answer (cache) or formatted article body (KB)
  title?:     string   // KB articles have a title
  similarity: number
}

// ── Semantic search via pgvector ──────────────────────────────────────────────
// Calls nf_semantic_search() which UNIONs knowledge_base + knowledge_cache
// and returns results ordered by cosine similarity descending.

export async function semanticSearch(
  embedding: number[],
  threshold: number,
  limit = 5,
): Promise<SearchResult[]> {
  const { data, error } = await supabaseAdmin.rpc('nf_semantic_search', {
    p_embedding: JSON.stringify(embedding),
    p_threshold: threshold,
    p_limit:     limit,
  })

  if (error) {
    console.error('[KB] nf_semantic_search error:', error.message)
    return []
  }

  return (data ?? []) as SearchResult[]
}

// ── Knowledge-base article CRUD ───────────────────────────────────────────────

export async function createArticle(
  article: Omit<KBArticle, 'id' | 'created_at' | 'updated_at'> & { embedding: number[] },
): Promise<KBArticle> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_base')
    .insert({
      slug:      article.slug,
      title:     article.title,
      body:      article.body,
      category:  article.category,
      language:  article.language ?? 'sw',
      embedding: JSON.stringify(article.embedding),
      is_active: article.is_active ?? true,
    })
    .select('id, slug, title, body, category, language, is_active, created_at, updated_at')
    .single()

  if (error) throw new Error(`KB create failed: ${error.message}`)
  return data as KBArticle
}

export async function listArticles(options?: {
  category?: string
  limit?: number
  offset?: number
}): Promise<KBArticle[]> {
  let q = supabaseAdmin
    .from('knowledge_base')
    .select('id, slug, title, body, category, language, is_active, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.category) q = q.eq('category', options.category)
  if (options?.offset)   q = q.range(options.offset, options.offset + (options.limit ?? 50) - 1)

  const { data, error } = await q
  if (error) throw new Error(`KB list failed: ${error.message}`)
  return (data ?? []) as KBArticle[]
}

export async function updateArticle(
  id: string,
  fields: Partial<KBArticle> & { embedding?: number[] },
): Promise<void> {
  const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() }
  if (fields.embedding) update.embedding = JSON.stringify(fields.embedding)

  const { error } = await supabaseAdmin
    .from('knowledge_base')
    .update(update)
    .eq('id', id)

  if (error) throw new Error(`KB update failed: ${error.message}`)
}

// ── Cache operations ──────────────────────────────────────────────────────────

export async function addToCache(
  question:  string,
  answer:    string,
  embedding: number[],
  source:    'amina_answer' | 'admin_authored' = 'amina_answer',
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_cache')
    .insert({
      question,
      answer,
      embedding: JSON.stringify(embedding),
      source,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[KB] cache insert failed:', error.message)
    return null
  }
  return data?.id ?? null
}

export async function recordCacheHit(id: string): Promise<void> {
  void supabaseAdmin.rpc('nf_increment_cache_hit', { p_cache_id: id }).then(() => null, () => null)
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface CascadeConfig {
  cache_threshold:    number  // 0.85
  kb_threshold:       number  // 0.80
  max_context_items:  number  // 3 (items injected into Amina prompt in Phase 4)
}

const DEFAULT_CONFIG: CascadeConfig = {
  cache_threshold:   0.85,
  kb_threshold:      0.80,
  max_context_items: 3,
}

export async function getCascadeConfig(): Promise<CascadeConfig> {
  try {
    const { data } = await supabaseAdmin
      .from('cascade_config')
      .select('key, value')

    if (!data || data.length === 0) return DEFAULT_CONFIG

    const cfg = { ...DEFAULT_CONFIG }
    for (const row of data) {
      const k = row.key as keyof CascadeConfig
      if (k in cfg) (cfg as Record<string, number>)[k] = parseFloat(row.value)
    }
    return cfg
  } catch {
    return DEFAULT_CONFIG
  }
}
