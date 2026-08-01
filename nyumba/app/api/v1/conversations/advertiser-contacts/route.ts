import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/conversations/advertiser-contacts
// Returns staff/admin users that an advertiser can message.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Verify caller is an active advertiser
    const { data: adv } = await admin
      .from('advertisers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!adv) return NextResponse.json({ error: 'Huna akaunti ya utangazaji' }, { status: 403 })

    const { data } = await admin
      .from('users')
      .select('id, full_name, avatar_url, role')
      .in('role', ['admin', 'staff'])
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(50)

    return NextResponse.json({ contacts: data ?? [] })
  } catch (err) {
    console.error('[GET /conversations/advertiser-contacts]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
