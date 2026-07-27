import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { embed, normaliseQuery } from '@/lib/knowledge/embeddings'
import { createArticle, listArticles, updateArticle } from '@/lib/knowledge/index'

// ── GET /api/v1/knowledge/articles — list KB articles (admin only) ────────────

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
  const category = searchParams.get('category') ?? undefined
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset   = parseInt(searchParams.get('offset') ?? '0')

  try {
    const articles = await listArticles({ category, limit, offset })
    return NextResponse.json({ articles, count: articles.length })
  } catch (err) {
    console.error('[KB articles GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── POST /api/v1/knowledge/articles — create a KB article (admin only) ────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { slug, title, body: articleBody, category = 'general', language = 'sw' } = body
  if (!slug || !title || !articleBody) {
    return NextResponse.json({ error: 'slug, title, and body are required' }, { status: 400 })
  }

  try {
    const text = `${title}\n\n${articleBody}`
    const embedding = await embed(normaliseQuery(text))
    const article = await createArticle({
      slug,
      title,
      body: articleBody,
      category,
      language,
      embedding,
      is_active: true,
      created_by: user.id,
    })
    return NextResponse.json({ article }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[KB articles POST]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH /api/v1/knowledge/articles — update a KB article (admin only) ───────

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, string | boolean>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, title, body: articleBody, category, language, is_active } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  try {
    const fields: Record<string, unknown> = {}
    if (title)       fields.title     = title
    if (articleBody) fields.body      = articleBody
    if (category)    fields.category  = category
    if (language)    fields.language  = language
    if (is_active !== undefined) fields.is_active = is_active

    // Re-embed if content changed
    if (title || articleBody) {
      const { data: current } = await admin
        .from('knowledge_base')
        .select('title, body')
        .eq('id', id)
        .single()
      const t = String(fields.title ?? current?.title ?? '')
      const b = String(fields.body  ?? current?.body  ?? '')
      fields.embedding = JSON.stringify(await embed(normaliseQuery(`${t}\n\n${b}`)))
    }

    await updateArticle(String(id), fields)
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[KB articles PATCH]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
