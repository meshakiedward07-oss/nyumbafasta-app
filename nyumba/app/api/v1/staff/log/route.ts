import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logStaffActivity } from '@/lib/staff/checkPermission'

// POST /api/v1/staff/log — log a staff activity from client-side code
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role, staff_active').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(me?.role ?? '')) {
    return NextResponse.json({ error: 'Ruhusa imekataliwa' }, { status: 403 })
  }
  if (me?.role === 'staff' && me?.staff_active === false) {
    return NextResponse.json({ error: 'Akaunti ya staff imezimwa' }, { status: 403 })
  }

  const { actionType, resourceType, resourceId, description } = await req.json() as {
    actionType:    string
    resourceType?: string
    resourceId?:   string
    description:   string
  }

  if (!actionType || !description) {
    return NextResponse.json({ error: 'actionType na description zinahitajika' }, { status: 400 })
  }

  await logStaffActivity({
    staffId:  user.id,
    actionType,
    resourceType,
    resourceId,
    description,
  })

  return NextResponse.json({ ok: true })
}
