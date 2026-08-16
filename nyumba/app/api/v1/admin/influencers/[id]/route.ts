import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/v1/admin/influencers/[id] — full detail: referrals + all payout stages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const admin = createAdminClient()

  const [referralsRes, stagesRes] = await Promise.all([
    admin.from('referral_attributions')
      .select('id, referred_user_id, referral_code, signed_up_at, referred_user:referred_user_id(full_name)')
      .eq('influencer_id', id)
      .order('signed_up_at', { ascending: false }),

    admin.from('influencer_payout_stages')
      .select('id, referred_user_id, stage, amount_tzs, status, hold_until, triggered_at, paid_at, admin_note, referred_user:referred_user_id(full_name)')
      .eq('influencer_id', id)
      .order('triggered_at', { ascending: false }),
  ])

  const referrals = (referralsRes.data ?? []).map(r => ({
    id:             r.id,
    referredUserId: r.referred_user_id,
    // @ts-expect-error supabase join typing
    fullName:       (r.referred_user as { full_name: string } | null)?.full_name ?? null,
    referralCode:   r.referral_code,
    signedUpAt:     r.signed_up_at,
  }))

  const stages = (stagesRes.data ?? []).map(s => ({
    id:             s.id,
    referredUserId: s.referred_user_id,
    // @ts-expect-error supabase join typing
    referredName:   (s.referred_user as { full_name: string } | null)?.full_name ?? null,
    stage:          s.stage,
    amountTzs:      s.amount_tzs,
    status:         s.status,
    holdUntil:      s.hold_until,
    triggeredAt:    s.triggered_at,
    paidAt:         s.paid_at,
    adminNote:      s.admin_note,
  }))

  return NextResponse.json({ referrals, stages })
}
