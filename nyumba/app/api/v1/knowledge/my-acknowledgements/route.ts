import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// GET /api/v1/knowledge/my-acknowledgements
// Returns all SOP acknowledgements for the current user.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabaseAdmin
      .from('sop_acknowledgements')
      .select('sop_id, sop_version, acknowledged_at')
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ acks: data ?? [] })
  } catch (err) {
    console.error('[my-acknowledgements GET]', err)
    // Table may not exist yet — return empty gracefully
    return NextResponse.json({ acks: [] })
  }
}
