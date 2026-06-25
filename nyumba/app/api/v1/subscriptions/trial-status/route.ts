import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/subscriptions/trial-status
 * Returns the current dalali's trial subscription status.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const admin = createAdminClient()

  const { data: trial } = await admin
    .from('subscriptions')
    .select('id, plan, status, is_trial, starts_at, expires_at, trial_converted_at')
    .eq('dalali_id', user.id)
    .eq('is_trial', true)
    .order('created_at', { ascending: false })
    .maybeSingle()

  const { data: active } = await admin
    .from('subscriptions')
    .select('id, plan, status, expires_at')
    .eq('dalali_id', user.id)
    .eq('status', 'active')
    .eq('is_trial', false)
    .order('expires_at', { ascending: false })
    .maybeSingle()

  return NextResponse.json({
    has_trial:        !!trial,
    trial_status:     trial?.status ?? null,
    trial_expires_at: trial?.expires_at ?? null,
    trial_converted:  !!(trial?.trial_converted_at),
    has_paid_plan:    !!active,
    paid_plan:        active?.plan ?? null,
    paid_expires_at:  active?.expires_at ?? null,
  })
}
