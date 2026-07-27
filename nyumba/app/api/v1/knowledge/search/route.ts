import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { findBestKBArticle, fetchKBCandidates } from '@/lib/knowledge/embeddings'
import { lookupCache, getCascadeConfig } from '@/lib/knowledge/index'

// GET /api/v1/knowledge/search?q=<query>
// Admin test endpoint: shows what the cascade would return for a given message.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'q is required' }, { status: 400 })

  try {
    const cfg        = await getCascadeConfig()
    const cacheHit   = await lookupCache(q, cfg.cache_similarity_threshold)
    const candidates = await fetchKBCandidates(q)
    const kbResult   = await findBestKBArticle(q)

    return NextResponse.json({
      query:          q,
      config:         cfg,
      cache_hit:      cacheHit,
      fts_candidates: candidates.map(c => ({ slug: c.slug, title: c.title })),
      kb_result:      kbResult.candidate
        ? { slug: kbResult.candidate.slug, title: kbResult.candidate.title, confidence: kbResult.confidence }
        : null,
      would_answer:
        (cacheHit && cacheHit.similarity >= cfg.cache_similarity_threshold) ||
        (!!kbResult.candidate && kbResult.confidence >= cfg.kb_confidence_threshold),
    })
  } catch (err) {
    console.error('[KB search]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
