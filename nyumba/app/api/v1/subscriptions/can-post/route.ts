import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPricing } from '@/lib/config/pricing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/subscriptions/can-post
 * Returns whether the current dalali can post a new listing.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const admin = createAdminClient()

    // Platform brokers bypass the subscription check — they post on behalf of NyumbaFasta
    const { data: dp } = await admin
      .from('dalali_profiles')
      .select('is_platform_broker')
      .eq('user_id', user.id)
      .eq('is_platform_broker', true)
      .maybeSingle()
    if (dp) {
      return NextResponse.json({ can_post: true, limit: 999, plan: 'platform_broker' })
    }

    const [subRes, countRes, pricing] = await Promise.all([
      admin
        .from('subscriptions')
        .select('plan, extra_listings, status, expires_at')
        .eq('dalali_id', user.id)
        .eq('status', 'active')
        .order('expires_at', { ascending: false })
        .maybeSingle(),
      // Do NOT use .neq('status', 'deleted') — 'deleted' is not in the DB enum
      admin
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', user.id)
        .in('status', ['pending', 'active', 'taken', 'expired']),
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

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/subscriptions/can-post]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
