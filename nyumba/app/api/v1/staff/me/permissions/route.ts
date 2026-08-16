import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffPermissions } from '@/lib/staff/checkPermission'

// GET — permissions for the currently logged-in staff/admin user
export async function GET() {
  try {
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

    // Influencer accounts use /api/v1/influencer/* routes
    if (profile?.role === 'staff') {
      const { data: influencerCheck } = await supabase.from('influencer_profiles')
        .select('id').eq('user_id', user.id).maybeSingle()
      if (influencerCheck) return NextResponse.json({ error: 'influencer_account' }, { status: 403 })
    }

    const granted = await getStaffPermissions(user.id)

    return NextResponse.json({ granted, role: profile?.role })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/staff/me/permissions]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
