import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StaffDashboardLoader from './StaffDashboardLoader'

export default async function StaffDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff-login?redirect=/admin/staff-dashboard')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role, staff_active, must_change_password')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) redirect('/')
  if (profile?.role === 'staff' && !profile?.staff_active) redirect('/login?suspended=1')
  if (profile?.role === 'staff' && profile?.must_change_password) redirect('/account/change-password')

  return <StaffDashboardLoader />
}
