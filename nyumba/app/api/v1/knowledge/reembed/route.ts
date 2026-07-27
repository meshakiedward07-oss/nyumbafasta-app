import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { embed, normaliseQuery } from '@/lib/knowledge/embeddings'

export const maxDuration = 60

// POST /api/v1/knowledge/reembed
// Generates embeddings for any knowledge_base or knowledge_cache row
// that has a NULL embedding. Run once after the seed migration.
// Admin only.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table') ?? 'knowledge_base' // 'knowledge_base' | 'knowledge_cache'

  const results = { processed: 0, errors: 0, skipped: 0 }

  try {
    if (table === 'knowledge_base') {
      const { data: rows } = await admin
        .from('knowledge_base')
        .select('id, title, body')
        .is('embedding', null)
        .eq('is_active', true)
        .limit(200)

      for (const row of rows ?? []) {
        try {
          const text = `${row.title}\n\n${row.body}`
          const embedding = await embed(normaliseQuery(text))
          await admin
            .from('knowledge_base')
            .update({ embedding: JSON.stringify(embedding), updated_at: new Date().toISOString() })
            .eq('id', row.id)
          results.processed++
        } catch {
          results.errors++
        }
      }
    } else if (table === 'knowledge_cache') {
      const { data: rows } = await admin
        .from('knowledge_cache')
        .select('id, question')
        .is('embedding', null)
        .eq('is_active', true)
        .limit(200)

      for (const row of rows ?? []) {
        try {
          const embedding = await embed(normaliseQuery(row.question))
          await admin
            .from('knowledge_cache')
            .update({ embedding: JSON.stringify(embedding) })
            .eq('id', row.id)
          results.processed++
        } catch {
          results.errors++
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid table param' }, { status: 400 })
    }

    return NextResponse.json({ ...results, table })
  } catch (err) {
    console.error('[KB reembed]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
