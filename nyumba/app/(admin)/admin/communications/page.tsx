import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import CommunicationsHub from './CommunicationsHub'

export const metadata = { title: 'Mawasiliano Hub — NyumbaFasta Admin' }

export default async function CommunicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff-login?redirect=/admin/communications')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('id, full_name, avatar_url, role, staff_active, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'staff'].includes(profile.role)) redirect('/')
  if (profile.is_active === false) redirect('/staff-login')
  if (profile.role === 'staff' && !profile.staff_active) redirect('/staff-login')

  return (
    <CommunicationsHub
      userId={user.id}
      userName={profile.full_name ?? 'Mtumiaji'}
      userAvatar={profile.avatar_url ?? null}
      senderName={profile.full_name ?? 'Timu ya NyumbaFasta'}
    />
  )
}
