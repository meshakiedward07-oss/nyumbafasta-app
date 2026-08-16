import { NextResponse } from 'next/server'
import { requireInfluencerAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireInfluencerAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  // Resolve influencer_profiles.id from userId
  const { data: influencerProfile } = await admin
    .from('influencer_profiles')
    .select('id, referral_code')
    .eq('user_id', auth.userId)
    .single()

  if (!influencerProfile) {
    return NextResponse.json({ error: 'Profaili ya influencer haipatikani' }, { status: 404 })
  }

  // Fetch all referrals with referred dalali's name + signup date
  const { data: attributions, error } = await admin
    .from('referral_attributions')
    .select('id, referred_user_id, referral_code, signed_up_at, referred_user:referred_user_id(full_name)')
    .eq('influencer_id', influencerProfile.id)
    .order('signed_up_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const referrals = (attributions ?? []).map(a => ({
    id:             a.id,
    referredUserId: a.referred_user_id,
    referralCode:   a.referral_code,
    signedUpAt:     a.signed_up_at,
    // @ts-expect-error supabase join typing
    fullName:       (a.referred_user as { full_name: string } | null)?.full_name ?? null,
  }))

  return NextResponse.json({
    referralCode: influencerProfile.referral_code,
    total:        referrals.length,
    referrals,
  })
}
