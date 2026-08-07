import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { cache, TTL } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'admin:dept-settings'

const VALID_ROLES = new Set(['admin', 'staff', 'sales', 'finance', 'marketing'])

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const hit = cache.get(CACHE_KEY)
    if (hit) return NextResponse.json(hit)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('department_settings')
      .select('owner_role, owner_name, sop_title, sop_url, sop_review_days, sop_last_reviewed_at, kpi_targets, goal_notes, updated_at')
      .order('owner_role')

    if (error) throw error

    const result = { settings: data ?? [] }
    cache.set(CACHE_KEY, result, TTL.STATS)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /admin/department-settings]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const body = await req.json() as {
      owner_role:           string
      owner_name?:          string | null
      sop_title?:           string | null
      sop_url?:             string | null
      sop_review_days?:     number
      sop_last_reviewed_at?: string | null
      kpi_targets?:         unknown[]
      goal_notes?:          string | null
    }

    const { owner_role } = body
    if (!owner_role || !VALID_ROLES.has(owner_role)) {
      return NextResponse.json({ error: 'owner_role batili' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: me } = await admin.from('users').select('id').eq('id', auth.userId).single()

    const updates = {
      owner_name:           body.owner_name   ?? null,
      sop_title:            body.sop_title    ?? null,
      sop_url:              body.sop_url      ?? null,
      sop_review_days:      body.sop_review_days ?? 30,
      sop_last_reviewed_at: body.sop_last_reviewed_at ?? null,
      kpi_targets:          body.kpi_targets  ?? [],
      goal_notes:           body.goal_notes   ?? null,
      updated_by:           me?.id ?? null,
      updated_at:           new Date().toISOString(),
    }

    const { data, error } = await admin
      .from('department_settings')
      .upsert({ owner_role, ...updates }, { onConflict: 'owner_role' })
      .select()
      .single()

    if (error) throw error

    cache.delete(CACHE_KEY)
    return NextResponse.json({ setting: data })
  } catch (err) {
    console.error('[PATCH /admin/department-settings]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
