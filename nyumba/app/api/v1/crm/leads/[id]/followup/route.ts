import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scheduleFollowup } from '@/lib/crm/dalaliCRM'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as { followup_at: string; note?: string }

  if (!body.followup_at) {
    return NextResponse.json({ error: 'Tarehe ya follow-up inahitajika' }, { status: 400 })
  }

  await scheduleFollowup(id, user.id, new Date(body.followup_at), body.note)

  return NextResponse.json({ success: true })
}
