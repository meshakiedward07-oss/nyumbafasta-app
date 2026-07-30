import { NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// GET /api/v1/conversations/staff-users
// Returns admin + staff users so any staff member can start an internal conversation.
export async function GET() {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const { data } = await supabaseAdmin
    .from('users')
    .select('id, full_name, avatar_url, role')
    .in('role', ['admin', 'staff'])
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .limit(100)

  return NextResponse.json({ users: data ?? [] })
}
