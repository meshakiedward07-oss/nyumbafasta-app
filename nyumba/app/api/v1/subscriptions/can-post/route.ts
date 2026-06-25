import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PLAN_LIMITS: Record<string, number> = {
  free:       2,
  basic:      5,
  premium:   20,
  enterprise: 50,
}

/**
 * GET /api/v1/subscriptions/can-post
 * Returns whether the current dalali can post a new listing.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const admin = createAdminClient()

  const [subRes, countRes] = await Promise.all([
    admin
      .from('subscriptions')
      .select('plan, extra_listings, status, expires_at')
      .eq('dalali_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .maybeSingle(),
    admin
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('dalali_id', user.id)
      .in('status', ['active', 'pending']),
  ])

  const sub   = subRes.data
  const count = countRes.count ?? 0
  const base  = sub ? (PLAN_LIMITS[sub.plan] ?? 0) : 0
  const limit = base + (sub?.extra_listings ?? 0)

  return NextResponse.json({
    can_post:    count < limit,
    current:     count,
    limit,
    plan:        sub?.plan ?? null,
    expires_at:  sub?.expires_at ?? null,
  })
}
