import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/fundi/subscription
// Returns the calling fundi's active (or most recent) subscription.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const admin = createAdminClient()

    // Prefer active, then fall back to most recent
    const { data: sub } = await admin
      .from('fundi_subscriptions')
      .select(`
        id, plan_id, status, starts_at, expires_at,
        plan:fundi_subscription_plans!plan_id(name, billing_cycle, max_job_forms)
      `)
      .eq('fundi_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ subscription: sub ?? null })
  } catch (err) {
    console.error('[GET /fundi/subscription]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
