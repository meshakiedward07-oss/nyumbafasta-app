import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StaffLeadsLoader from './StaffLeadsLoader'

export default async function StaffLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/staff-login?redirect=/admin/staff-leads')

  const { data: profile } = await supabase
    .from('users')
    .select('role, staff_active, must_change_password')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) redirect('/dashboard')
  if (profile?.role === 'staff' && !profile?.staff_active) redirect('/staff-login?suspended=1')
  if (profile?.role === 'staff' && profile?.must_change_password) redirect('/account/change-password')

  return <StaffLeadsLoader currentUserId={user.id} isAdmin={profile?.role === 'admin'} />
}
