import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('ad_subscription_plans')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Mpango haukupatikana' }, { status: 404 })
  return NextResponse.json({ plan: data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()

  const allowed = [
    'name', 'ad_type', 'bundle_types', 'description', 'price_tzs', 'duration_days',
    'slot_limit', 'features', 'display_order', 'is_active', 'placements', 'visibility',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Hakuna mabadiliko' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ad_subscription_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const admin = createAdminClient()

  // Check if any campaigns use this plan
  const { count } = await admin
    .from('ad_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', id)

  if ((count ?? 0) > 0) {
    // Soft-delete: deactivate instead
    const { data, error } = await admin
      .from('ad_subscription_plans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plan: data, deactivated: true, message: 'Mpango uliposimamishwa (una kampeni zilizopo)' })
  }

  const { error } = await admin.from('ad_subscription_plans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
