import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import OrgSetupWizard from '@/components/property/OrgSetupWizard'

export const metadata = { title: 'Unda Shirika — NyumbaFasta Mali' }

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/property/setup')

  // If already has an org, go straight to dashboard
  const admin = createAdminClient()
  const { count } = await admin
    .from('organization_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) > 0) redirect('/property/dashboard')

  return <OrgSetupWizard />
}
