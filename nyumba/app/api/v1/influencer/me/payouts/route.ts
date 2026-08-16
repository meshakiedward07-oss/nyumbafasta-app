import { NextResponse } from 'next/server'
import { requireInfluencerAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STAGE_LABELS: Record<number, string> = {
  1: '3 Listings Zilizoidhinishwa',
  2: 'Subscription ya Kwanza ya Malipo',
  3: 'Subscription ya Pili ya Malipo',
}

export async function GET() {
  const auth = await requireInfluencerAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data: influencerProfile } = await admin
    .from('influencer_profiles')
    .select('id')
    .eq('user_id', auth.userId)
    .single()

  if (!influencerProfile) {
    return NextResponse.json({ error: 'Profaili ya influencer haipatikani' }, { status: 404 })
  }

  const { data: stages, error } = await admin
    .from('influencer_payout_stages')
    .select('id, referred_user_id, stage, amount_tzs, status, hold_until, triggered_at, paid_at, referred_user:referred_user_id(full_name)')
    .eq('influencer_id', influencerProfile.id)
    .order('triggered_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const payouts = (stages ?? []).map(s => ({
    id:             s.id,
    referredUserId: s.referred_user_id,
    // @ts-expect-error supabase join typing
    referredName:   (s.referred_user as { full_name: string } | null)?.full_name ?? null,
    stage:          s.stage,
    stageLabel:     STAGE_LABELS[s.stage] ?? `Stage ${s.stage}`,
    amountTzs:      s.amount_tzs,
    status:         s.status,
    holdUntil:      s.hold_until,
    triggeredAt:    s.triggered_at,
    paidAt:         s.paid_at,
  }))

  const totalEarned = payouts
    .filter(p => p.status === 'earned' || p.status === 'paid')
    .reduce((sum, p) => sum + p.amountTzs, 0)

  const totalPaid = payouts
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amountTzs, 0)

  const totalPending = payouts
    .filter(p => p.status === 'hold')
    .reduce((sum, p) => sum + p.amountTzs, 0)

  return NextResponse.json({
    summary: {
      totalEarned,
      totalPaid,
      totalPending,
      balance: totalEarned - totalPaid,
    },
    payouts,
  })
}
