import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ orgId: string }> }

// PATCH /api/v1/admin/org-subscriptions/[orgId]
// Body options (any combination):
//   { plan_id }                — change plan immediately
//   { status }                 — force subscription status
//   { trial_ends_at }          — extend trial end date (ISO string)
//   { current_period_end }     — extend current billing period
//   { pending_plan_id, pending_plan_starts_at } — schedule downgrade
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { orgId } = await params
    const body      = await req.json()
    const admin     = createAdminClient()

    const VALID_STATUSES = ['trial', 'active', 'past_due', 'grace_period', 'cancelled', 'expired']
    const now = new Date().toISOString()

    // Fetch current subscription
    const { data: current } = await admin
      .from('organization_subscriptions')
      .select('id, status, plan_id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (!current) return NextResponse.json({ error: 'Usajili haukupatikana kwa shirika hili' }, { status: 404 })

    const updates: Record<string, unknown> = { updated_at: now }

    // Plan change — immediate
    if ('plan_id' in body) {
      if (body.plan_id) {
        const { data: plan } = await admin.from('subscription_plans').select('id').eq('id', body.plan_id).maybeSingle()
        if (!plan) return NextResponse.json({ error: 'Mpango haukupatikana' }, { status: 404 })
      }
      updates.plan_id = body.plan_id ?? null
      // If upgrading, also activate
      if (body.plan_id && current.status !== 'active') {
        updates.status              = 'active'
        updates.current_period_start = now
        // Default period: 1 month from now
        const end = new Date()
        end.setMonth(end.getMonth() + 1)
        updates.current_period_end = end.toISOString()
      }
    }

    // Force status
    if ('status' in body) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: 'Hali ya usajili si sahihi' }, { status: 400 })
      }
      updates.status = body.status
      if (body.status === 'cancelled') {
        updates.cancelled_at = now
        updates.cancellation_reason = body.cancellation_reason ?? 'Admin action'
      }
    }

    // Extend trial
    if ('trial_ends_at' in body) {
      updates.trial_ends_at = body.trial_ends_at
      if (current.status === 'expired' || current.status === 'cancelled') {
        updates.status = 'trial'
      }
    }

    // Extend billing period
    if ('current_period_end' in body) {
      updates.current_period_end = body.current_period_end
    }
    if ('current_period_start' in body) {
      updates.current_period_start = body.current_period_start
    }

    // Schedule downgrade
    if ('pending_plan_id' in body) {
      updates.pending_plan_id        = body.pending_plan_id ?? null
      updates.pending_plan_starts_at = body.pending_plan_starts_at ?? null
    }

    const { data, error } = await admin
      .from('organization_subscriptions')
      .update(updates)
      .eq('org_id', orgId)
      .select(`
        *,
        org:organizations(id, name),
        plan:subscription_plans(id, name, price_tzs)
      `)
      .single()

    if (error) throw error
    return NextResponse.json({ subscription: data })
  } catch (err) {
    console.error('[PATCH /admin/org-subscriptions/[orgId]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
