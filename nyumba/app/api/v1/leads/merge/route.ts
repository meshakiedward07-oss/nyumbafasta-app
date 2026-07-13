import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// POST /api/v1/leads/merge
// Body: { primaryId, duplicateId }
// Merges duplicate into primary (fills nulls from duplicate), then hard-deletes duplicate.
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { primaryId, duplicateId } = await req.json() as {
      primaryId:   string
      duplicateId: string
    }
    if (!primaryId || !duplicateId) {
      return NextResponse.json({ error: 'primaryId na duplicateId vinahitajika' }, { status: 400 })
    }
    if (primaryId === duplicateId) {
      return NextResponse.json({ error: 'primaryId na duplicateId lazima ziwe tofauti' }, { status: 400 })
    }

    const [{ data: primary, error: e1 }, { data: dup, error: e2 }] = await Promise.all([
      supabaseAdmin.from('leads').select('*').eq('id', primaryId).single(),
      supabaseAdmin.from('leads').select('*').eq('id', duplicateId).single(),
    ])
    if (e1 || !primary) return NextResponse.json({ error: 'Lead ya msingi haikupatikana' }, { status: 404 })
    if (e2 || !dup)     return NextResponse.json({ error: 'Duplicate lead haikupatikana' }, { status: 404 })

    // Copy non-null fields from duplicate into primary when primary has null
    const MERGEABLE = [
      'phone', 'phone_2', 'email', 'ward', 'district', 'region', 'address',
      'facebook_url', 'instagram_url', 'tiktok_url', 'whatsapp_number',
      'facebook_status', 'instagram_status', 'tiktok_status', 'whatsapp_status',
    ] as const

    const updates: Record<string, unknown> = {}
    for (const field of MERGEABLE) {
      if (!primary[field] && dup[field]) updates[field] = dup[field]
    }
    // Append notes if both have text
    if (primary.notes && dup.notes && primary.notes !== dup.notes) {
      updates.notes = `${primary.notes}\n---\n${dup.notes}`
    } else if (!primary.notes && dup.notes) {
      updates.notes = dup.notes
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from('leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', primaryId)
    }
    await supabaseAdmin.from('leads').delete().eq('id', duplicateId)

    return NextResponse.json({ success: true, fieldsMerged: Object.keys(updates) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/v1/leads/merge?type=all
// Hard-deletes every lead where is_duplicate = true.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const type = new URL(req.url).searchParams.get('type')
  if (type !== 'all') {
    return NextResponse.json({ error: 'type=all inahitajika' }, { status: 400 })
  }

  try {
    const { count } = await supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('is_duplicate', true)

    await supabaseAdmin.from('leads').delete().eq('is_duplicate', true)
    return NextResponse.json({ success: true, deleted: count ?? 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
