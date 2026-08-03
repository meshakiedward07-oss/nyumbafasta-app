import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export interface KBArticle {
  id:                string
  slug:              string
  title:             string
  body:              string
  category:          string
  language:          string
  audience:          'external' | 'internal'
  owner_role?:       string | null
  sla_description?:  string | null
  review_frequency?: string | null
  last_reviewed_at?: string | null
  is_active:         boolean
  created_by?:       string
  created_at:        string
  updated_at:        string
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

export interface CacheLookupResult {
  id:         string
  answer:     string
  similarity: number
}

// ── Cache lookup — pg_trgm trigram similarity, pure DB, no AI ────────────────
// Returns the best-matching cached answer if similarity ≥ threshold.

export async function lookupCache(
  messageText: string,
  threshold = 0.40,  // pg_trgm similarity scale: 0=no match, 1=identical
  limit      = 1,
): Promise<CacheLookupResult | null> {
  const { data, error } = await supabaseAdmin.rpc('nf_cache_lookup', {
    p_question:  messageText,
    p_threshold: threshold,
    p_limit:     limit,
  })

  if (error) {
    console.error('[KB] nf_cache_lookup error:', error.message)
    return null
  }
  if (!data || data.length === 0) return null
  return data[0] as CacheLookupResult
}

export async function recordCacheHit(id: string): Promise<void> {
  void supabaseAdmin.rpc('nf_increment_cache_hit', { p_cache_id: id }).then(() => null, () => null)
}

// ── Cache write ───────────────────────────────────────────────────────────────

export async function addToCache(
  question:  string,
  answer:    string,
  source:    'amina_answer' | 'admin_authored' = 'amina_answer',
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_cache')
    .insert({ question, answer, source })
    .select('id')
    .single()

  if (error) {
    console.error('[KB] cache insert failed:', error.message)
    return null
  }
  return data?.id ?? null
}

// ── Knowledge-base CRUD ───────────────────────────────────────────────────────

const KB_SELECT_FIELDS = 'id, slug, title, body, category, language, audience, owner_role, sla_description, review_frequency, last_reviewed_at, is_active, created_by, created_at, updated_at'

export async function createArticle(
  article: Omit<KBArticle, 'id' | 'created_at' | 'updated_at'>,
): Promise<KBArticle> {
  const { data, error } = await supabaseAdmin
    .from('knowledge_base')
    .insert({
      slug:              article.slug,
      title:             article.title,
      body:              article.body,
      category:          article.category,
      language:          article.language ?? 'sw',
      audience:          article.audience ?? 'external',
      owner_role:        article.owner_role ?? null,
      sla_description:   article.sla_description ?? null,
      review_frequency:  article.review_frequency ?? null,
      last_reviewed_at:  article.last_reviewed_at ?? null,
      is_active:         article.is_active ?? true,
      created_by:        article.created_by ?? null,
    })
    .select(KB_SELECT_FIELDS)
    .single()

  if (error) throw new Error(`KB create failed: ${error.message}`)
  return data as KBArticle
}

export async function listArticles(options?: {
  category?: string
  audience?: 'external' | 'internal'
  limit?:    number
  offset?:   number
}): Promise<KBArticle[]> {
  let q = supabaseAdmin
    .from('knowledge_base')
    .select(KB_SELECT_FIELDS)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.category) q = q.eq('category', options.category)
  if (options?.audience) q = q.eq('audience', options.audience)
  if (options?.offset)   q = q.range(options.offset, options.offset + (options.limit ?? 50) - 1)

  const { data, error } = await q
  if (error) throw new Error(`KB list failed: ${error.message}`)
  return (data ?? []) as KBArticle[]
}

export async function updateArticle(
  id:     string,
  fields: Partial<Omit<KBArticle, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('knowledge_base')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`KB update failed: ${error.message}`)
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface CascadeConfig {
  cache_similarity_threshold: number  // pg_trgm scale 0-1; default 0.40
  kb_confidence_threshold:    number  // Haiku confidence 0-1; default 0.75
  max_context_items:          number  // items injected into Amina prompt; default 3
}

const DEFAULT_CONFIG: CascadeConfig = {
  cache_similarity_threshold: 0.40,
  kb_confidence_threshold:    0.75,
  max_context_items:          3,
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
