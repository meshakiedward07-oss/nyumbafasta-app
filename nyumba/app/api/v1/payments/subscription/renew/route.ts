import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const PLAN_PRICES: Record<string, number> = { basic: 10_000, premium: 25_000, enterprise: 50_000 }

// Loyalty discount based on consecutive completed months
function getLoyaltyDiscount(months: number): number {
  if (months >= 12) return 20
  if (months >= 6)  return 15
  if (months >= 3)  return 10
  return 0
}

function applyDiscount(price: number, discountPct: number): number {
  return Math.round(price * (1 - discountPct / 100))
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { plan } = await req.json()
    if (!plan || !['basic', 'premium', 'enterprise'].includes(plan)) {
      return NextResponse.json({ error: 'Plan si sahihi' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get current subscription
    const { data: currentSub } = await admin
      .from('subscriptions')
      .select('id, plan, status, expires_at, grace_period_until')
      .eq('dalali_id', user.id)
      .in('status', ['active', 'grace_period'])
      .order('expires_at', { ascending: false })
      .maybeSingle()

    // Count completed months for loyalty discount
    const { count: completedMonths } = await admin
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('dalali_id', user.id)
      .in('status', ['active', 'expired', 'grace_period'])

    const discount = getLoyaltyDiscount(completedMonths ?? 0)
    const basePrice = PLAN_PRICES[plan]
    const finalPrice = applyDiscount(basePrice, discount)

    // New subscription starts from current expiry (if active) or now (if expired/grace)
    const now = new Date()
    let startsFrom = now

    if (currentSub?.status === 'active' && currentSub.expires_at) {
      const expiry = new Date(currentSub.expires_at)
      if (expiry > now) startsFrom = expiry  // extend from current expiry
    } else if (currentSub?.status === 'grace_period' && currentSub.grace_period_until) {
      const gracePeriod = new Date(currentSub.grace_period_until)
      if (gracePeriod > now) startsFrom = gracePeriod
    }

    const expiresAt = new Date(startsFrom)
    expiresAt.setDate(expiresAt.getDate() + 30)

    const payment_ref = `REN-${user.id.slice(0, 8)}-${Date.now()}`

    // Create new subscription
    const { data: newSub, error: insertError } = await admin
      .from('subscriptions')
      .insert({
        dalali_id: user.id,
        plan,
        status: 'active',
        amount_paid: finalPrice,
        payment_method: 'mock',
        payment_ref,
        starts_at: startsFrom.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !newSub) {
      return NextResponse.json({ error: insertError?.message ?? 'Imeshindwa' }, { status: 500 })
    }

    // Mark old subscription as expired if it's in grace_period
    if (currentSub?.status === 'grace_period') {
      await admin.from('subscriptions').update({ status: 'expired' }).eq('id', currentSub.id)
    }

    const planName = plan === 'premium' ? 'Premium ⭐' : 'Basic'
    const discountMsg = discount > 0 ? ` (punguzo ${discount}% ya uaminifu)` : ''

    await admin.from('notifications').insert({
      user_id: user.id,
      title: '🔄 Subscription Imefanywa Upya!',
      body: `Plan ya ${planName} imehuishwa hadi ${expiresAt.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}${discountMsg}.`,
      type: 'subscription_renewed',
      is_read: false,
      data: { plan, subscription_id: newSub.id, discount },
    })

    return NextResponse.json({
      ok: true,
      subscription_id: newSub.id,
      plan,
      amount: finalPrice,
      discount,
      expires_at: expiresAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
