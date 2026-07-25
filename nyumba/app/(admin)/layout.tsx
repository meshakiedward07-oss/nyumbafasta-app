import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import ErrorBoundary from '@/components/shared/ErrorBoundary'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/staff-login?redirect=/admin')

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active, staff_active, must_change_password')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) redirect('/')
  if (profile?.is_active === false) redirect('/staff-login')
  if (profile?.role === 'staff' && profile?.staff_active === false) redirect('/staff-login')

  if (profile?.role === 'staff' && profile?.must_change_password) {
    redirect('/account/change-password')
  }

  return (
    <AdminShell initialRole={profile?.role ?? 'admin'}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </AdminShell>
  )
}
