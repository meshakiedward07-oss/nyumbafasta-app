import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import type { PlanFeatures } from '@/lib/types/property'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/v1/admin/subscription-plans/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await req.json()

    const ALLOWED_SCALAR = ['name', 'description', 'price_tzs', 'billing_cycle', 'is_active', 'is_public']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const key of ALLOWED_SCALAR) {
      if (key in body) updates[key] = body[key] ?? null
    }

    // Merge features patch — only update supplied keys, keep the rest
    if (body.features && typeof body.features === 'object') {
      const admin = createAdminClient()
      const { data: existing } = await admin.from('subscription_plans').select('features').eq('id', id).single()
      const merged: PlanFeatures = { ...(existing?.features as PlanFeatures), ...body.features }
      updates.features = merged
    }

    // Handle is_default — clear the old default first (the partial unique index only allows one)
    if (body.is_default === true) {
      const admin = createAdminClient()
      await admin
        .from('subscription_plans')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('is_default', true)
        .neq('id', id)
      updates.is_default = true
    } else if (body.is_default === false) {
      updates.is_default = false
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plan: data })
  } catch (err) {
    console.error('[PATCH /admin/subscription-plans/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/admin/subscription-plans/[id]
// Soft-deactivates a plan; blocks if active subscriptions are on it
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin = createAdminClient()

    // Guard: can't deactivate if orgs are actively on this plan
    const { count } = await admin
      .from('organization_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', id)
      .in('status', ['trial', 'active', 'past_due', 'grace_period'])

    if ((count ?? 0) > 0) {
      return NextResponse.json({
        error: `Mpango huu una mashirika ${count} yanayoutumia. Hamisha kwanza kabla ya kufuta.`,
      }, { status: 409 })
    }

    const { data, error } = await admin
      .from('subscription_plans')
      .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, is_active')
      .single()

    if (error) throw error
    return NextResponse.json({ plan: data, message: 'Mpango umefutwa (umesimamishwa).' })
  } catch (err) {
    console.error('[DELETE /admin/subscription-plans/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
