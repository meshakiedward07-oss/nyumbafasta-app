import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/conversations/dalali-contacts
// Returns staff/admin users that a dalali can message.
// Dalali can only initiate conversations with staff/admin.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'dalali') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data } = await admin
      .from('users')
      .select('id, full_name, avatar_url, role')
      .in('role', ['admin', 'staff'])
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(50)

    return NextResponse.json({ contacts: data ?? [] })
  } catch (err) {
    console.error('[GET /conversations/dalali-contacts]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
