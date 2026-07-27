import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { embed, normaliseQuery } from '@/lib/knowledge/embeddings'
import { semanticSearch, getCascadeConfig } from '@/lib/knowledge/index'

// GET /api/v1/knowledge/search?q=<query>&threshold=<float>
// Test endpoint for admins to preview what the cascade would return.

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

  const cfg = await getCascadeConfig()
  const threshold = parseFloat(searchParams.get('threshold') ?? String(Math.min(cfg.cache_threshold, cfg.kb_threshold) - 0.1))

  try {
    const embedding = await embed(normaliseQuery(q))
    const results   = await semanticSearch(embedding, threshold, 10)

    return NextResponse.json({
      query:     q,
      threshold,
      results,
      config:    cfg,
      would_answer: results.some(r =>
        (r.source === 'cache'          && r.similarity >= cfg.cache_threshold) ||
        (r.source === 'knowledge_base' && r.similarity >= cfg.kb_threshold)
      ),
    })
  } catch (err) {
    console.error('[KB search]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
