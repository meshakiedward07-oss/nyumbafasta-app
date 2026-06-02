import { createClient } from '@/lib/supabase/server'
import BottomNav from './BottomNav'

export default async function RoleBottomNav() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return <BottomNav role="client" />
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
    return <BottomNav role={data?.role ?? 'client'} />
  } catch {
    return <BottomNav role="client" />
  }
}
