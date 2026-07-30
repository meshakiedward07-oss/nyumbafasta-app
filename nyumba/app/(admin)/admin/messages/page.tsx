import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import dynamic from 'next/dynamic'

const MessagesPanel = dynamic(() => import('./MessagesPanel'), { ssr: false })

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff-login?redirect=/admin/messages')

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
    <MessagesPanel
      currentUserId={user.id}
      currentUserName={profile.full_name ?? 'Mtumiaji'}
      currentUserAvatar={profile.avatar_url ?? null}
    />
  )
}
