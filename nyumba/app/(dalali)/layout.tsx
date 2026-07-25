import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  if (profile?.role !== 'dalali' && profile?.role !== 'admin') {
    redirect('/')
  }

  if (profile?.is_active === false) {
    redirect('/login?suspended=1')
  }

  return (
    <>
      <DalaliBottomNav />
      <div className="pb-20">{children}</div>
    </>
  )
}
