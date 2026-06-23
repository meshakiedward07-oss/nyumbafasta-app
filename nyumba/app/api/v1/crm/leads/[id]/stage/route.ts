import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { moveLeadStage, PIPELINE_STAGES, type PipelineStage } from '@/lib/crm/dalaliCRM'

export const dynamic = 'force-dynamic'

const VALID_STAGES = PIPELINE_STAGES.map(s => s.key)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Ruhusa inahitajika' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as { stage: string; note?: string }

  if (!VALID_STAGES.includes(body.stage as PipelineStage)) {
    return NextResponse.json({ error: 'Stage si sahihi' }, { status: 400 })
  }

  const result = await moveLeadStage(id, body.stage as PipelineStage, user.id, body.note)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
