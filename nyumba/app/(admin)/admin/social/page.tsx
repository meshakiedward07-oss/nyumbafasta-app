import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import SocialLoader from './SocialLoader'

export const metadata = { title: 'Social Media — NyumbaFasta Admin' }

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff-login?redirect=/admin/social')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role, staff_active, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'staff'].includes(profile.role)) redirect('/')
  if (profile.is_active === false) redirect('/staff-login')
  if (profile.role === 'staff' && !profile.staff_active) redirect('/staff-login')

  if (profile.role === 'staff') {
    const { data: perms } = await admin
      .from('staff_permissions')
      .select('permission_key')
      .eq('staff_id', user.id)
      .in('permission_key', ['social_media', 'spam_moderation'])

    if (!perms || perms.length === 0) redirect('/admin/no-access')
  }

  return <SocialLoader />
}
