import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// TEMPORARY — verifies fix_trial_activation_guarantee_2026_08_22.sql actually
// ran and every dalali now has an active subscription. Delete after checking.
export async function GET() {
  const admin_ = await requireAdminUser()
  if (!admin_) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: dalaliProfiles } = await admin.from('dalali_profiles').select('user_id')
  const totalDalali = dalaliProfiles?.length ?? 0

  const { data: activeSubs } = await admin
    .from('subscriptions')
    .select('dalali_id, plan, status, is_trial, trial_ends_at')
    .in('status', ['active', 'grace_period'])

  const subByDalali = new Map((activeSubs ?? []).map(s => [s.dalali_id, s]))
  const withoutSub = (dalaliProfiles ?? []).filter(dp => !subByDalali.has(dp.user_id))

  const planCounts: Record<string, number> = {}
  for (const s of activeSubs ?? []) {
    planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1
  }

  return NextResponse.json({
    total_dalali: totalDalali,
    dalali_with_active_subscription: activeSubs?.length ?? 0,
    dalali_without_any_subscription: withoutSub.length,
    plan_breakdown: planCounts,
    sample_without_subscription: withoutSub.slice(0, 5).map(d => d.user_id),
    sample_enterprise_trials: (activeSubs ?? [])
      .filter(s => s.plan === 'enterprise' && s.is_trial)
      .slice(0, 3),
  })
}
