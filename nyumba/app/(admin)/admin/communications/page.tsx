import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffPermissions } from '@/lib/staff/checkPermission'
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

  // 'communications' permission gate (2026-09-01 compose-email audit) —
  // this hub also bundles WhatsApp/internal-messages/notifications/
  // knowledge, which stay open to any staff as before; only the Barua
  // Pepe (Email) tab is gated, since that's the one that can read every
  // client/dalali/advertiser's email history and send as the company.
  const perms   = await getStaffPermissions(user.id)
  const canEmail = perms.includes('communications')

  return (
    <CommunicationsHub
      userId={user.id}
      userName={profile.full_name ?? 'Mtumiaji'}
      userAvatar={profile.avatar_url ?? null}
      senderName={profile.full_name ?? 'Timu ya NyumbaFasta'}
      canEmail={canEmail}
    />
  )
}
