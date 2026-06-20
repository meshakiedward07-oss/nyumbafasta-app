import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'

// GET — recent activity for a staff member (last 50 actions)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data: activities, error } = await admin
    .from('staff_activity_log')
    .select('id, action_type, resource_type, resource_id, description, created_at')
    .eq('staff_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ activities: activities ?? [] })
}
