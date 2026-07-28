import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireStaffAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// GET /api/v1/leads/[id]/activity — fetch activity log for a lead
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const { id } = params
  if (!id) return NextResponse.json({ error: 'ID inahitajika' }, { status: 400 })

  try {
    const { data, error } = await supabaseAdmin
      .from('lead_activity_log')
      .select('id, actor_name, action_type, old_value, new_value, notes, created_at')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ activity: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
