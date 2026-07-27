import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/v1/admin/fundi-subscription-plans/[id]
// Body: any subset of { name, description, price_tzs, billing_cycle, max_job_forms, features, is_active, is_default, display_order }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const body   = await req.json()
    const admin  = createAdminClient()

    // Verify plan exists
    const { data: existing } = await admin
      .from('fundi_subscription_plans')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Mpango haukupatikana' }, { status: 404 })

    const updates: Record<string, unknown> = {}

    if (body.name          !== undefined) updates.name          = body.name.trim()
    if (body.description   !== undefined) updates.description   = body.description?.trim() || null
    if (body.price_tzs     !== undefined) updates.price_tzs     = Number(body.price_tzs)
    if (body.billing_cycle !== undefined) updates.billing_cycle = body.billing_cycle
    if (body.max_job_forms !== undefined) updates.max_job_forms = Number(body.max_job_forms)
    if (body.features      !== undefined) updates.features      = body.features
    if (body.is_active     !== undefined) updates.is_active     = Boolean(body.is_active)
    if (body.display_order !== undefined) updates.display_order = Number(body.display_order)

    if (body.is_default === true) {
      // Clear existing default before setting this one
      await admin
        .from('fundi_subscription_plans')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', id)
      updates.is_default = true
    } else if (body.is_default === false) {
      updates.is_default = false
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Hakuna mabadiliko' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('fundi_subscription_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plan: data })
  } catch (err) {
    console.error('[PATCH /admin/fundi-subscription-plans/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/admin/fundi-subscription-plans/[id]
// Soft-delete: sets is_active = false
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin  = createAdminClient()

    // Check if any active subscriptions use this plan
    const { count } = await admin
      .from('fundi_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', id)
      .eq('status', 'active')

    if ((count ?? 0) > 0) {
      // Soft delete — don't break active subscribers
      await admin
        .from('fundi_subscription_plans')
        .update({ is_active: false, is_default: false })
        .eq('id', id)
      return NextResponse.json({ message: 'Mpango umefichwa (wanaosajiliwa bado wanaendelea)' })
    }

    const { error } = await admin
      .from('fundi_subscription_plans')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ message: 'Mpango umefutwa' })
  } catch (err) {
    console.error('[DELETE /admin/fundi-subscription-plans/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
