import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

const VALID_PLANS = ['basic', 'premium', 'enterprise'] as const
type Plan = typeof VALID_PLANS[number]

const PLAN_LABEL: Record<Plan, string> = { basic: 'Basic', premium: 'Premium', enterprise: 'Enterprise' }

// Found 2026-09-02: this route was updating `users.listing_deadline_days`
// (an unrelated "listing posting deadline" grace-period field — see
// lib/dalali/accountMonitor.ts) instead of the `subscriptions` table that
// actually gates a dalali's plan/listing-limits/features everywhere else
// in the app (subscriptions/can-post/route.ts, dashboard, etc.). The admin
// UI showed "Imepanuliwa kwa siku 30" (success) but the dalali's real
// subscription — status, plan, expires_at — was never touched. Rewritten
// to operate on `subscriptions` directly, matching the exact
// current-subscription lookup used everywhere else
// (.in('status', ['active','grace_period']).order('expires_at', desc)) and
// the proven-working extend logic already in
// app/api/v1/admin/payments/[userId]/fix/route.ts's `extend_subscription`
// action — extended here to also let admin choose/change the plan
// (basic/premium/enterprise), which that route couldn't do.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  let days = 30
  let reason = ''
  let requestedPlan: Plan | undefined
  try {
    const body = await req.json()
    days = Math.min(Math.max(1, parseInt(body.days) || 30), 365)
    reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (typeof body.plan === 'string' && (VALID_PLANS as readonly string[]).includes(body.plan)) {
      requestedPlan = body.plan as Plan
    }
  } catch { /* body optional — falls back to +30 days on the current plan */ }

  const admin = createAdminClient()

  const { data: dalali } = await admin
    .from('users')
    .select('id, role')
    .eq('id', id)
    .eq('role', 'dalali')
    .single()

  if (!dalali) {
    return NextResponse.json({ error: 'Dalali hapatikani' }, { status: 404 })
  }

  // Same lookup every subscription-gating check in the app uses (e.g.
  // subscriptions/can-post/route.ts) — the most-recently-expiring
  // active/grace_period row is "the" current subscription.
  const { data: currentSub } = await admin
    .from('subscriptions')
    .select('id, plan, status, expires_at')
    .eq('dalali_id', id)
    .in('status', ['active', 'grace_period'])
    .order('expires_at', { ascending: false })
    .maybeSingle()

  const plan: Plan | undefined = requestedPlan ?? (currentSub?.plan as Plan | undefined)
  if (!plan) {
    return NextResponse.json(
      { error: 'Dalali hana kifurushi kilichopo — chagua kifurushi (Basic/Premium/Enterprise)' },
      { status: 400 },
    )
  }

  const now  = new Date()
  const base = currentSub?.expires_at && new Date(currentSub.expires_at) > now
    ? new Date(currentSub.expires_at)
    : now
  const expiresAt = new Date(base)
  expiresAt.setDate(expiresAt.getDate() + days)

  let subId: string
  if (currentSub) {
    const { error } = await admin
      .from('subscriptions')
      .update({ plan, status: 'active', expires_at: expiresAt.toISOString() })
      .eq('id', currentSub.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    subId = currentSub.id
  } else {
    const { data: newSub, error } = await admin
      .from('subscriptions')
      .insert({
        dalali_id:      id,
        plan,
        status:         'active',
        amount_paid:    0,
        payment_method: 'admin_grant',
        starts_at:      now.toISOString(),
        expires_at:     expiresAt.toISOString(),
      })
      .select('id')
      .single()
    if (error || !newSub) {
      return NextResponse.json({ error: error?.message ?? 'Imeshindwa kuunda usajili' }, { status: 500 })
    }
    subId = newSub.id
  }

  const planLabel    = PLAN_LABEL[plan]
  const planChanged  = !!currentSub && currentSub.plan !== plan
  const expiresLabel = expiresAt.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })

  // Dalali is notified immediately (in-app notification bell) — matches
  // the exact pattern used by every other admin-grants-subscription path
  // in the app (payments/subscription/renew, admin/payments/[userId]/fix).
  await admin.from('notifications').insert({
    user_id: id,
    title:   planChanged ? `🎉 Kifurushi Chako Kimebadilishwa kwenda ${planLabel}!` : '📅 Usajili Wako Umepanuliwa!',
    body:    `Admin amekupa kifurushi cha ${planLabel}, kinatumika sasa hivi (active), hadi tarehe ${expiresLabel}.`,
    type:    'subscription_active',
    is_read: false,
  })

  // Audit trail — best-effort, matches admin/payments/[userId]/fix's pattern.
  admin.from('admin_logs').insert({
    admin_id:       auth.userId,
    action:         'extend_subscription',
    target_user_id: id,
    record_type:    'subscription',
    record_id:      subId,
    note:           reason ? `${planLabel}, siku ${days}: ${reason}` : `${planLabel}, siku ${days}`,
  }).then(({ error }) => {
    if (error) console.warn('[DalaliExtend] admin_logs insert failed (non-fatal):', error.message)
  })

  return NextResponse.json({
    success:    true,
    plan,
    expires_at: expiresAt.toISOString(),
    message:    `Kifurushi cha ${planLabel} kimewekwa — active hadi ${expiresLabel}`,
  })
}
