import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import WhatsAppLoader from './WhatsAppLoader'

export default async function AdminWhatsAppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff-login?redirect=/admin/whatsapp')

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
    const { data: perm } = await admin
      .from('staff_permissions')
      .select('permission_key')
      .eq('staff_id', user.id)
      .eq('permission_key', 'whatsapp_support')
      .maybeSingle()

    if (!perm) redirect('/admin/no-access')
  }

  return <WhatsAppLoader />
}
