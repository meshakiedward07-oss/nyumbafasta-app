import { NextResponse } from 'next/server'
import { requireInfluencerAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireInfluencerAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data: influencerProfile, error } = await admin
    .from('influencer_profiles')
    .select('id, referral_code, is_active, social_handle, platform, notes, created_at')
    .eq('user_id', auth.userId)
    .single()

  if (error || !influencerProfile) {
    return NextResponse.json({ error: 'Profaili ya influencer haipatikani' }, { status: 404 })
  }

  return NextResponse.json({
    influencer: {
      userId:      auth.userId,
      fullName:    auth.fullName,
      referralCode: influencerProfile.referral_code,
      isActive:    influencerProfile.is_active,
      socialHandle: influencerProfile.social_handle,
      platform:    influencerProfile.platform,
      notes:       influencerProfile.notes,
      createdAt:   influencerProfile.created_at,
    },
  })
}
