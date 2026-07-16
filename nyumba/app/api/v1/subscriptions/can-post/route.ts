import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPricing } from '@/lib/config/pricing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/subscriptions/can-post
 * Returns whether the current dalali can post a new listing.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const admin = createAdminClient()

  const [subRes, countRes, pricing] = await Promise.all([
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
      .neq('status', 'deleted'),
    getPricing(),
  ])

  const sub    = subRes.data
  const count  = countRes.count ?? 0
  const limits = pricing.listingLimits
  const base   = sub ? (limits[sub.plan as keyof typeof limits] ?? 0) : 0
  const limit  = base + (sub?.extra_listings ?? 0)

  return NextResponse.json({
    can_post:    count < limit,
    current:     count,
    limit,
    plan:        sub?.plan ?? null,
    expires_at:  sub?.expires_at ?? null,
  })
}
