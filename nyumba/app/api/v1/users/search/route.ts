import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/users/search?phone=+255...
// Allows org members to look up any registered user by phone (for adding tenants/members)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Caller must be admin/staff or an org member (to use tenant/member lookup)
    const { data: callerUser } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(callerUser?.role ?? '')

    if (!isAdminStaff) {
      const { count: orgCount } = await admin
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if ((orgCount ?? 0) === 0) {
        return NextResponse.json({ error: 'Huna ruhusa ya kutafuta watumiaji' }, { status: 403 })
      }
    }

    const phone = req.nextUrl.searchParams.get('phone')?.trim()
    if (!phone) return NextResponse.json({ error: 'Nambari ya simu inahitajika' }, { status: 400 })

    const { data, error } = await admin
      .from('users')
      .select('id, full_name, phone, avatar_url')
      .eq('phone', phone)
      .single()

    if (error || !data) return NextResponse.json({ user: null })
    return NextResponse.json({ user: data })
  } catch (err) {
    console.error('[GET /users/search]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
