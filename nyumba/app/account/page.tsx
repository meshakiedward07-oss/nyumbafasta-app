import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountClient from '@/components/client/AccountClient'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/account')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, email, phone, role, created_at')
    .eq('id', user.id)
    .single()

  const [{ count: savedCount }, { count: unlocksCount }, { data: unlockStats }] = await Promise.all([
    supabase.from('saved_listings').select('id', { count: 'exact', head: true }).eq('client_id', user.id),
    supabase.from('contact_unlocks').select('id', { count: 'exact', head: true }).eq('client_id', user.id).eq('status', 'completed'),
    supabase.from('contact_unlocks').select('amount_paid').eq('client_id', user.id).eq('status', 'completed'),
  ])

  const totalSpent = (unlockStats ?? []).reduce((sum, u) => sum + (u.amount_paid ?? 0), 0)

  return (
    <AccountClient
      fullName={profile?.full_name ?? ''}
      email={profile?.email ?? user.email ?? null}
      phone={profile?.phone ?? user.phone ?? null}
      role={profile?.role ?? 'client'}
      joinedAt={profile?.created_at ?? user.created_at}
      savedCount={savedCount ?? 0}
      unlocksCount={unlocksCount ?? 0}
      totalSpent={totalSpent}
    />
  )
}
