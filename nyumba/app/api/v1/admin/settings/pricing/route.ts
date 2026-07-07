import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getPricing, pricingToRows, PRICING_DEFAULTS, type Pricing } from '@/lib/config/pricing'
import { revalidatePath } from 'next/cache'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') return null
  return user
}

export async function GET() {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const pricing = await getPricing()
  return NextResponse.json(pricing)
}

export async function PUT(req: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const body = await req.json() as Partial<Pricing>

  // Merge with current to allow partial updates
  const current = await getPricing()
  const updated: Pricing = {
    subscription: {
      basic:      body.subscription?.basic      ?? current.subscription.basic,
      premium:    body.subscription?.premium    ?? current.subscription.premium,
      enterprise: body.subscription?.enterprise ?? current.subscription.enterprise,
    },
    unlock:       body.unlock       ?? current.unlock,
    boost: {
      1:          body.boost?.[1]   ?? current.boost[1],
      2:          body.boost?.[2]   ?? current.boost[2],
      4:          body.boost?.[4]   ?? current.boost[4],
    },
    extraListing: body.extraListing ?? current.extraListing,
  }

  // Validate — all prices must be positive integers ≥ 100
  const values = [
    updated.subscription.basic, updated.subscription.premium, updated.subscription.enterprise,
    updated.unlock, updated.boost[1], updated.boost[2], updated.boost[4], updated.extraListing,
  ]
  if (values.some(v => !Number.isInteger(v) || v < 100)) {
    return NextResponse.json({ error: 'Bei zote lazima ziwe namba nzima angalau 100 TZS' }, { status: 400 })
  }

  // Also enforce logical ordering: basic < premium < enterprise
  if (updated.subscription.basic >= updated.subscription.premium) {
    return NextResponse.json({ error: 'Bei ya Basic lazima iwe chini ya Premium' }, { status: 400 })
  }
  if (updated.subscription.premium >= updated.subscription.enterprise) {
    return NextResponse.json({ error: 'Bei ya Premium lazima iwe chini ya Enterprise' }, { status: 400 })
  }

  const admin  = createAdminClient()
  const rows   = pricingToRows(updated)

  // Upsert all rows
  const { error } = await admin.from('app_settings').upsert(
    rows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
    { onConflict: 'key' }
  )

  if (error) {
    console.error('[PricingSettings] upsert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log admin action (non-fatal)
  admin.from('admin_logs').insert({
    admin_id: user.id,
    action:   'update_pricing',
    note:     JSON.stringify(updated),
  }).then(({ error: logErr }) => {
    if (logErr) console.warn('[PricingSettings] admin_logs insert failed:', logErr.message)
  })

  // Bust the public pricing cache
  revalidatePath('/api/v1/pricing')

  return NextResponse.json({ success: true, pricing: updated })
}

export async function DELETE() {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  const admin = createAdminClient()
  await admin.from('app_settings').upsert(
    pricingToRows(PRICING_DEFAULTS).map(r => ({ ...r, updated_at: new Date().toISOString() })),
    { onConflict: 'key' }
  )

  revalidatePath('/api/v1/pricing')
  return NextResponse.json({ success: true, pricing: PRICING_DEFAULTS, note: 'Reset kwa bei za awali' })
}
