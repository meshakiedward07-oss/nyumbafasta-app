import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const admin = createAdminClient()
    const [profileRes, dpRes] = await Promise.all([
      admin.from('users').select('id, full_name, phone, role, username, created_at').eq('id', user.id).single(),
      admin.from('dalali_profiles').select('is_platform_broker').eq('user_id', user.id).maybeSingle(),
    ])

    if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 })

    return NextResponse.json({
      user: {
        ...profileRes.data,
        is_platform_broker: dpRes.data?.is_platform_broker ?? false,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
