import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/crm/dalaliCRM'

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
  const body = await req.json() as {
    result: 'answered' | 'no_answer' | 'unreachable'
    note?:  string
  }

  const descMap: Record<string, string> = {
    answered:    'Simu ilijibiwa ✅',
    no_answer:   'Simu — hakujibu 🔕',
    unreachable: 'Simu — hapatikani 🚫',
  }

  await logActivity({
    leadId:      id,
    staffId:     user.id,
    type:        'call',
    description: body.note || descMap[body.result] || 'Simu imepigwa',
  })

  return NextResponse.json({ success: true })
}
