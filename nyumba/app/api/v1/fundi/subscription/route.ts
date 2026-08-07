import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/fundi/subscription
// Returns the calling fundi's active (or most recent) subscription AND available plans.
// Plans are included here so the subscription page does not need to call the admin-only
// /api/v1/admin/fundi-subscription-plans endpoint.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const admin = createAdminClient()

    const [subRes, plansRes] = await Promise.all([
      // Prefer active, then fall back to most recent
      admin
        .from('fundi_subscriptions')
        .select(`
          id, plan_id, status, starts_at, expires_at,
          plan:fundi_subscription_plans!plan_id(name, billing_cycle, max_job_forms)
        `)
        .eq('fundi_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Active subscription plans — visible to all authenticated fundis
      admin
        .from('fundi_subscription_plans')
        .select('id, name, description, price_tzs, billing_cycle, max_job_forms, is_default')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
    ])

    return NextResponse.json({
      subscription: subRes.data ?? null,
      plans:        plansRes.data ?? [],
    })
  } catch (err) {
    console.error('[GET /fundi/subscription]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
