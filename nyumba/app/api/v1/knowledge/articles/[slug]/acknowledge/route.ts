import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

type Ctx = { params: Promise<{ slug: string }> }

// GET /api/v1/knowledge/articles/[slug]/acknowledge
// Returns the acknowledgement count + list of who acknowledged (admin/staff only).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { data: article } = await supabaseAdmin
      .from('knowledge_base')
      .select('id, last_reviewed_at')
      .eq('slug', slug)
      .eq('audience', 'internal')
      .maybeSingle()

    if (!article) return NextResponse.json({ error: 'SOP haikupatikana' }, { status: 404 })

    const { data: acks, error } = await supabaseAdmin
      .from('sop_acknowledgements')
      .select('user_id, sop_version, acknowledged_at, users(full_name, role)')
      .eq('sop_id', article.id)
      .order('acknowledged_at', { ascending: false })

    if (error) throw error

    const current_version = article.last_reviewed_at ?? null
    const enriched = (acks ?? []).map(a => {
      const u = a.users as unknown as { full_name: string | null; role: string } | null
      return {
        user_id:         a.user_id,
        full_name:       u?.full_name ?? null,
        role:            u?.role ?? null,
        acknowledged_at: a.acknowledged_at,
        sop_version:     a.sop_version,
        is_current:      !current_version || !a.sop_version || a.sop_version === current_version,
      }
    })

    return NextResponse.json({
      count:          enriched.length,
      current_count:  enriched.filter(a => a.is_current).length,
      users:          enriched,
      sop_version:    current_version,
    })
  } catch (err) {
    console.error('[acknowledge GET]', err)
    return NextResponse.json({ count: 0, current_count: 0, users: [], sop_version: null })
  }
}

// POST /api/v1/knowledge/articles/[slug]/acknowledge
// Current user acknowledges this SOP. Upserts so repeated calls are idempotent.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { data: article } = await supabaseAdmin
      .from('knowledge_base')
      .select('id, last_reviewed_at')
      .eq('slug', slug)
      .eq('audience', 'internal')
      .maybeSingle()

    if (!article) return NextResponse.json({ error: 'SOP haikupatikana' }, { status: 404 })

    const acknowledged_at = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('sop_acknowledgements')
      .upsert(
        {
          sop_id:          article.id,
          user_id:         user.id,
          sop_version:     article.last_reviewed_at ?? null,
          acknowledged_at,
        },
        { onConflict: 'sop_id,user_id' },
      )

    if (error) throw error
    return NextResponse.json({ success: true, acknowledged_at })
  } catch (err) {
    console.error('[acknowledge POST]', err)
    return NextResponse.json({ error: 'Imeshindwa kuthibitisha' }, { status: 500 })
  }
}
