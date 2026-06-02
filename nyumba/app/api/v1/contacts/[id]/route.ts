import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH — hifadhi client_notes kwa contact_unlock
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { client_notes } = await req.json()

    // Update — RLS policy inahakikisha ni wako tu
    const { error } = await supabase
      .from('contact_unlocks')
      .update({ client_notes: client_notes ?? null })
      .eq('id', params.id)
      .eq('client_id', user.id)
      .eq('status', 'completed')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
