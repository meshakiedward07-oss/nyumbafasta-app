import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCRMStats } from '@/lib/crm/dalaliCRM'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })
  }

  const isAdmin = profile?.role === 'admin'
  const stats = await getCRMStats(isAdmin ? undefined : user.id, isAdmin)

  return NextResponse.json(stats)
}
