import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

const StaffLeadsClient = dynamic(() => import('./StaffLeadsClient'), { ssr: false })

export default async function StaffLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) redirect('/dashboard')

  return <StaffLeadsClient currentUserId={user.id} isAdmin={profile?.role === 'admin'} />
}
