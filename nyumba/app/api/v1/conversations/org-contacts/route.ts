import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/conversations/org-contacts
// Returns admin/staff contacts that org owners can initiate conversations with
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('users')
      .select('id, full_name, avatar_url, role')
      .in('role', ['admin', 'staff'])
      .order('full_name')
      .limit(50)

    if (error) throw error
    return NextResponse.json({ contacts: data ?? [] })
  } catch (err) {
    console.error('[GET /conversations/org-contacts]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
