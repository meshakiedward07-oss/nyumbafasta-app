import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationsClient from '@/components/shared/NotificationsClient'
import type { Notification } from '@/lib/types/database'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/notifications')

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, type, is_read, ref_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <NotificationsClient
      notifications={(notifications ?? []) as unknown as Notification[]}
      role={userRow?.role ?? 'client'}
    />
  )
}
