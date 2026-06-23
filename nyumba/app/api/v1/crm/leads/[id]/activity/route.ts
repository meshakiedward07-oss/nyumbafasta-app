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
    type:         'call' | 'whatsapp' | 'note'
    description?: string
  }

  const typeLabels: Record<string, string> = {
    whatsapp: 'WhatsApp imetumwa',
    call:     'Simu imepigwa',
    note:     'Kumbuka imeandikwa',
  }

  await logActivity({
    leadId:      id,
    staffId:     user.id,
    type:        body.type || 'note',
    description: body.description || typeLabels[body.type] || 'Shughuli',
  })

  return NextResponse.json({ success: true })
}
