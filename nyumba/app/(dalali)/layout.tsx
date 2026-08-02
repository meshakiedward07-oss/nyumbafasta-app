import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import DalaliBottomNav from '@/components/shared/DalaliBottomNav'

export default async function DalaliLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/dashboard')

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active, account_status')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'staff') {
    // Staff members may access dalali features only if they are platform brokers
    const admin = createAdminClient()
    const { data: dp } = await admin
      .from('dalali_profiles')
      .select('is_platform_broker')
      .eq('user_id', user.id)
      .eq('is_platform_broker', true)
      .maybeSingle()
    if (!dp) redirect('/staff/dashboard')
  } else if (profile?.role !== 'dalali' && profile?.role !== 'admin') {
    redirect('/')
  }

  if (profile?.is_active === false) {
    redirect('/login?suspended=1')
  }

  return (
    <>
      <DalaliBottomNav />
      <div>{children}</div>
    </>
  )
}
