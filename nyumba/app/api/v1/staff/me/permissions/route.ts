import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffPermissions } from '@/lib/staff/checkPermission'

// GET — permissions for the currently logged-in staff/admin user
export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })
  }

  if (profile?.role === 'staff' && profile?.staff_active === false) {
    return NextResponse.json({ error: 'Akaunti ya staff imezimwa' }, { status: 403 })
  }

  const granted = await getStaffPermissions(user.id)

  return NextResponse.json({ granted, role: profile?.role })
}
