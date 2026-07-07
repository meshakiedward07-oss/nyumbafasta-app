import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const admin  = createAdminClient()
  const userId = params.userId

  const [subsRes, unlocksRes, boostRes] = await Promise.all([
    admin
      .from('subscriptions')
      .select('id, plan, status, amount_paid, payment_method, payment_ref, starts_at, expires_at, created_at')
      .eq('dalali_id', userId)
      .order('created_at', { ascending: false }),

    admin
      .from('contact_unlocks')
      .select('id, listing_id, dalali_id, status, amount_paid, payment_method, payment_ref, created_at')
      .eq('client_id', userId)
      .order('created_at', { ascending: false }),

    admin
      .from('boost_payments')
      .select('id, listing_id, amount, weeks, status, payment_method, payment_ref, boosted_from, boosted_until, created_at')
      .eq('dalali_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const subscriptions  = subsRes.data   ?? []
  const client_unlocks = unlocksRes.data ?? []
  const boost_payments = boostRes.data   ?? []

  const totalSpent = [
    ...subscriptions.filter(s => ['active', 'expired', 'grace_period'].includes(s.status)).map(s => s.amount_paid ?? 0),
    ...client_unlocks.filter(u => u.status === 'completed').map(u => u.amount_paid ?? 2000),
    ...boost_payments.filter(b => b.status === 'completed').map(b => b.amount ?? 0),
  ].reduce((a, b) => a + b, 0)

  const pendingCount =
    subscriptions.filter(s => s.status === 'pending').length +
    client_unlocks.filter(u => u.status === 'pending').length +
    boost_payments.filter(b => b.status === 'pending').length

  return NextResponse.json({
    subscriptions,
    client_unlocks,
    boost_payments,
    summary: {
      total_spent:        totalSpent,
      subscription_count: subscriptions.length,
      unlock_count:       client_unlocks.length,
      boost_count:        boost_payments.length,
      pending_count:      pendingCount,
    },
  })
}
