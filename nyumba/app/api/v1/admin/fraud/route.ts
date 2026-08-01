import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPERADMIN_EMAIL = 'meshakiedward07@gmail.com'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'staff'].includes(profile.role as string)) return null
  return { user, profile, admin }
}

// GET /api/v1/admin/fraud — list fraud signals
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAdmin()
    if (!session) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { admin } = session
    const { searchParams } = new URL(req.url)

    const resolved = searchParams.get('resolved')
    const severity = searchParams.get('severity')
    const type     = searchParams.get('type')
    const page     = Math.max(0, Number(searchParams.get('page') ?? 0))
    const pageSize = 25

    let query = admin
      .from('fraud_signals')
      .select(`
        id,
        signal_type,
        severity,
        description,
        evidence,
        related_user_ids,
        related_ip,
        is_resolved,
        resolved_at,
        resolution_note,
        created_at,
        user:user_id (id, full_name, phone, account_status, fraud_score)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (resolved === 'true')  query = query.eq('is_resolved', true)
    if (resolved === 'false') query = query.eq('is_resolved', false)
    if (severity)             query = query.eq('severity', severity)
    if (type)                 query = query.eq('signal_type', type)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ signals: data, total: count, page, pageSize })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/admin/fraud — resolve a signal or update user account_status
export async function PATCH(req: NextRequest) {
  try {
    const session = await verifyAdmin()
    if (!session) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { user: adminUser, admin } = session
    const body = await req.json()
    const { signal_id, action, resolution_note, target_user_id, account_status } = body as {
      signal_id?:       string
      action?:          'resolve'
      resolution_note?: string
      target_user_id?:  string
      account_status?:  string
    }

    // ── Resolve signal ──────────────────────────────────────────────────────
    if (signal_id && action === 'resolve') {
      const { error } = await admin.from('fraud_signals').update({
        is_resolved:     true,
        resolved_by:     adminUser.id,
        resolved_at:     new Date().toISOString(),
        resolution_note: resolution_note ?? null,
      }).eq('id', signal_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── Update account status (suspend/ban) ─────────────────────────────────
    if (target_user_id && account_status) {
      if (!['active', 'suspended', 'banned'].includes(account_status)) {
        return NextResponse.json({ error: 'Hali si sahihi' }, { status: 400 })
      }

      // CRITICAL: Superadmin account must never be modified
      const { data: targetAuth } = await admin.auth.admin.getUserById(target_user_id)
      if (targetAuth?.user?.email === SUPERADMIN_EMAIL) {
        return NextResponse.json({ error: 'Akaunti hii haiwezi kubadilishwa' }, { status: 403 })
      }

      const { error } = await admin.from('users').update({ account_status })
        .eq('id', target_user_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ombi si sahihi' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
