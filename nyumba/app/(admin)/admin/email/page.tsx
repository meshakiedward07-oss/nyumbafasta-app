import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmailLoader from './EmailLoader'

export default async function EmailPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff-login?redirect=/admin/email')

  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) redirect('/')

  return <EmailLoader senderName={profile?.full_name ?? 'Timu ya NyumbaFasta'} />
}
