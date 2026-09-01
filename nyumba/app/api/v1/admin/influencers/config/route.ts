import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/security/auditLog'

export const dynamic = 'force-dynamic'

// GET — current reward amount for each of the 3 payout stages
export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('influencer_payout_config')
    .select('stage, amount_tzs, label, updated_at')
    .order('stage', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data ?? [] })
}

// PATCH — update the reward amount (and/or label) for one stage.
// lib/influencer/payoutTriggers.ts reads amount_tzs from this table live,
// falling back to the original hardcoded defaults only if a stage's row is
// somehow missing (e.g. before this migration has been run).
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  let body: { stage?: number; amountTzs?: number; label?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (![1, 2, 3].includes(body.stage as number)) {
    return NextResponse.json({ error: 'stage lazima iwe 1, 2, au 3' }, { status: 400 })
  }
  if (typeof body.amountTzs !== 'number' || !Number.isFinite(body.amountTzs) || body.amountTzs < 0) {
    return NextResponse.json({ error: 'amountTzs lazima iwe namba isiyopungua sifuri' }, { status: 400 })
  }

  const admin = createAdminClient()

  const updates: Record<string, unknown> = {
    amount_tzs: Math.round(body.amountTzs),
    updated_at: new Date().toISOString(),
    updated_by: auth.userId,
  }
  if (typeof body.label === 'string' && body.label.trim()) {
    updates.label = body.label.trim()
  }

  const { data, error } = await admin
    .from('influencer_payout_config')
    .update(updates)
    .eq('stage', body.stage)
    .select('stage, amount_tzs, label, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  auditLog({
    action:      'admin_action',
    user_id:     auth.userId,
    target_type: 'influencer_payout_config',
    metadata:    { event: 'stage_amount_updated', stage: body.stage, amount_tzs: updates.amount_tzs },
    severity:    'info',
  }).catch(() => {})

  return NextResponse.json({ ok: true, config: data })
}
