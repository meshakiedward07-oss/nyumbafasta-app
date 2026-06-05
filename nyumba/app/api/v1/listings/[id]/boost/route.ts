import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const PRICES: Record<number, number> = { 1: 5_000, 2: 9_000, 4: 16_000 }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Verify listing ownership
    const { data: listing } = await admin
      .from('listings')
      .select('id, dalali_id, title, boosted_until, boost_count, status')
      .eq('id', params.id)
      .single()

    if (!listing) return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })
    if (listing.dalali_id !== user.id) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }
    if (!['active', 'pending'].includes(listing.status)) {
      return NextResponse.json({ error: 'Listing lazima iwe active' }, { status: 400 })
    }

    const body = await req.json()
    const { weeks, payment_method, payment_phone } = body
    if (!PRICES[weeks]) {
      return NextResponse.json({ error: 'Wiki si sahihi (1, 2, au 4)' }, { status: 400 })
    }

    const amount = PRICES[weeks]

    // Calculate boosted_until — extend from current if still active, else from now
    const currentUntil = listing.boosted_until ? new Date(listing.boosted_until) : new Date()
    const base = currentUntil > new Date() ? currentUntil : new Date()
    const boostedUntil = new Date(base)
    boostedUntil.setDate(boostedUntil.getDate() + weeks * 7)

    const boostedUntilISO = boostedUntil.toISOString()
    const now = new Date().toISOString()

    // Record payment
    const insertData: Record<string, unknown> = {
      listing_id: params.id,
      dalali_id: user.id,
      amount,
      weeks,
      status: 'completed',
      payment_method: payment_method || 'mock',
      payment_ref: `BOOST-${user.id.slice(0, 8)}-${Date.now()}`,
      boosted_from: now,
      boosted_until: boostedUntilISO,
    }
    if (payment_phone) insertData.payment_phone = payment_phone
    await admin.from('boost_payments').insert(insertData)

    // Update listing
    await admin.from('listings').update({
      is_boosted: true,
      boosted_until: boostedUntilISO,
      boost_count: (listing.boost_count ?? 0) + 1,
    }).eq('id', params.id)

    // In-app notification
    await admin.from('notifications').insert({
      user_id: user.id,
      title: '🚀 Listing Imeboostwa!',
      body: `Listing yako itaonekana juu ya wote kwa wiki ${weeks}.`,
      type: 'boost_activated',
      is_read: false,
      data: { listing_id: params.id },
    })

    return NextResponse.json({ ok: true, boosted_until: boostedUntilISO, amount })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
