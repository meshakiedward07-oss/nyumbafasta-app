import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const [subsRes, boostsRes, extrasRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id, plan, status, amount_paid, payment_ref, starts_at, expires_at, created_at')
        .eq('dalali_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('boost_payments')
        .select('id, listing_id, amount, status, payment_ref, weeks, boosted_until, created_at')
        .eq('dalali_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('payments')
        .select('id, type, amount, status, external_id, created_at')
        .eq('dalali_id', user.id)
        .in('type', ['extra_listings', 'upgrade'])
        .order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      subscriptions: subsRes.data ?? [],
      boosts:        boostsRes.data ?? [],
      extras:        extrasRes.data ?? [],
    })
  } catch (err: unknown) {
    console.error('[dalali/payments]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
