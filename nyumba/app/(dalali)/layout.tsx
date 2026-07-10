import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DalaliBottomNav from '@/components/shared/DalaliBottomNav'

export default async function DalaliLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/dashboard')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'dalali' && profile?.role !== 'admin') {
    redirect('/')
  }

  return (
    <>
      <DalaliBottomNav />
      <div className="pb-20">{children}</div>
    </>
  )
}
