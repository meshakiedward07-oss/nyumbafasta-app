import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import PropertyShell from '@/components/property/PropertyShell'
import type { Organization } from '@/lib/types/property'

export default async function PropertyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/property/dashboard')

  const { data: profile } = await supabase
    .from('users')
    .select('is_active, account_status')
    .eq('id', user.id)
    .single()

  if (profile?.is_active === false) redirect('/login')

  // Fetch user's primary organization (owner role first, then any membership)
  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('organization_members')
    .select('role, organization:organizations(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(10)

  const ownerMembership  = memberships?.find(m => m.role === 'owner')
  const primaryMembership = ownerMembership ?? memberships?.[0] ?? null

  const org     = primaryMembership?.organization as unknown as Organization | null
  const orgRole = primaryMembership?.role ?? null

  return (
    <PropertyShell org={org} orgRole={orgRole}>
      {children}
    </PropertyShell>
  )
}
