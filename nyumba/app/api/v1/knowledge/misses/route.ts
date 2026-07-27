import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/knowledge/misses — miss log viewer for admins
// Supports: layer, reviewed, limit, offset, grouped

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const layer     = searchParams.get('layer')
  const reviewed  = searchParams.get('reviewed')
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset    = parseInt(searchParams.get('offset') ?? '0')
  const grouped   = searchParams.get('grouped') === 'true'

  try {
    if (grouped) {
      // Return the top recurring miss texts for Phase 5 pattern review
      const { data, error } = await admin
        .from('cascade_miss_log')
        .select('message_text, layer_reached, invoked_amina')
        .eq('reviewed', false)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error

      // Simple client-side grouping by message prefix similarity
      // Phase 5 will do proper embedding-based clustering
      const freq: Record<string, { count: number; layer: string; invoked_amina: boolean }> = {}
      for (const row of data ?? []) {
        const key = row.message_text.slice(0, 60).toLowerCase().trim()
        if (!freq[key]) freq[key] = { count: 0, layer: row.layer_reached, invoked_amina: row.invoked_amina }
        freq[key].count++
      }

      const patterns = Object.entries(freq)
        .map(([text, info]) => ({ text, ...info }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50)

      return NextResponse.json({ patterns, total: data?.length ?? 0 })
    }

    let q = admin
      .from('cascade_miss_log')
      .select('id, phone_number, message_text, layer_reached, best_cache_similarity, best_kb_similarity, invoked_amina, handover_triggered, reviewed, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (layer)    q = q.eq('layer_reached', layer)
    if (reviewed !== null) q = q.eq('reviewed', reviewed === 'true')

    const { data, error, count } = await q

    if (error) throw error
    return NextResponse.json({ misses: data ?? [], count })
  } catch (err) {
    console.error('[KB misses GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/v1/knowledge/misses — mark a miss as reviewed

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { id?: string; ids?: string[]; reviewed?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ids = body.ids ?? (body.id ? [body.id] : null)
  if (!ids?.length) return NextResponse.json({ error: 'id or ids required' }, { status: 400 })

  const { error } = await admin
    .from('cascade_miss_log')
    .update({ reviewed: body.reviewed ?? true })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, updated: ids.length })
}
