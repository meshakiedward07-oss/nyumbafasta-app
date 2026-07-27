import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import FundiShell from '@/components/fundi/FundiShell'

export default async function FundiLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/fundi/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role, full_name').eq('id', user.id).maybeSingle()

  if (profile && profile.role !== 'fundi') redirect('/')

  return (
    <FundiShell fundiName={profile?.full_name ?? null}>
      {children}
    </FundiShell>
  )
}
