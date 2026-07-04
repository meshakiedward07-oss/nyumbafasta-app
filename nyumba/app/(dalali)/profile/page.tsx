import { createClient, createAdminClient } from '@/lib/supabase/server'
import DalaliProfileClient from '@/components/dalali/DalaliProfileClient'

export default async function DalaliProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const [userRes, profileRes] = await Promise.all([
    supabase.from('users').select('full_name, phone').eq('id', user!.id).single(),
    admin.from('dalali_profiles')
      .select('whatsapp_number, bio, rating_avg, rating_count, is_premium_verified')
      .eq('user_id', user!.id)
      .maybeSingle(),
  ])

  return (
    <DalaliProfileClient
      fullName={userRes.data?.full_name ?? ''}
      phone={userRes.data?.phone ?? null}
      whatsappNumber={profileRes.data?.whatsapp_number ?? ''}
      bio={profileRes.data?.bio ?? ''}
      ratingAvg={profileRes.data?.rating_avg ?? 0}
      ratingCount={profileRes.data?.rating_count ?? 0}
      isVerified={profileRes.data?.is_premium_verified ?? false}
    />
  )
}
