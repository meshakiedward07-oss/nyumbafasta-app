import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/users/search?phone=+255...
// Allows org members to look up any registered user by phone (for adding tenants/members)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const phone = req.nextUrl.searchParams.get('phone')?.trim()
    if (!phone) return NextResponse.json({ error: 'Nambari ya simu inahitajika' }, { status: 400 })

    const admin = createAdminClient()
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
