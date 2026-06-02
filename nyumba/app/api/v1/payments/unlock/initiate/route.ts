import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { initiateStkPush, initiateCardPayment } from '@/lib/selcom'
import { sendPushToUser } from '@/lib/notifications/send'

const UNLOCK_AMOUNT = 2000
const IS_DEV = !process.env.SELCOM_API_KEY || process.env.SELCOM_API_KEY.startsWith('test_')

export async function POST(req: NextRequest) {
  try {
    const { listing_id, msisdn, provider = 'mpesa', payment_type = 'mobile' } = await req.json()

    if (!listing_id) {
      return NextResponse.json({ error: 'listing_id inahitajika' }, { status: 400 })
    }
    if (payment_type === 'mobile' && !msisdn) {
      return NextResponse.json({ error: 'msisdn inahitajika kwa mobile money' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id, dalali_id, status, type, district, dalali:dalali_id(full_name)')
      .eq('id', listing_id)
      .eq('status', 'active')
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })
    }

    if (listing.dalali_id === user.id) {
      return NextResponse.json({ error: 'Huwezi kufungua listing yako mwenyewe' }, { status: 400 })
    }

    const { data: existing } = await admin
      .from('contact_unlocks')
      .select('id, status')
      .eq('client_id', user.id)
      .eq('listing_id', listing_id)
      .eq('status', 'completed')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Tayari umefungua listing hii', already_unlocked: true }, { status: 400 })
    }

    const payment_ref = `NYU-${user.id.slice(0, 8)}-${Date.now()}`

    // ── Dev / mock mode: complete immediately for ALL providers ──
    if (IS_DEV) {
      const { data: unlock, error: insertError } = await admin
        .from('contact_unlocks')
        .insert({
          client_id:      user.id,
          listing_id,
          dalali_id:      listing.dalali_id,
          amount_paid:    UNLOCK_AMOUNT,
          payment_method: provider,
          payment_ref,
          status:         'completed',
        })
        .select('id')
        .single()

      if (insertError || !unlock) {
        return NextResponse.json({ error: insertError?.message ?? 'Imeshindwa kuunda unlock' }, { status: 500 })
      }

      await admin.rpc('increment_lead_count', { listing_id }).maybeSingle()

      const dalaliName  = (listing as typeof listing & { dalali?: { full_name?: string } | null }).dalali?.full_name ?? 'dalali'
      const listingLabel = `${listing.type} – ${listing.district}`
      const leadBody    = `Mteja amepata nambari yako kupitia listing ya ${listingLabel}.`

      await admin.from('notifications').insert({
        user_id:  listing.dalali_id,
        title:    '📞 Lead Mpya!',
        body:     leadBody,
        type:     'new_lead',
        is_read:  false,
        data:     { listing_id, unlock_id: unlock.id },
      })
      await sendPushToUser(listing.dalali_id, '🔔 Mteja Mpya!', leadBody, '/dashboard')

      const day3 = new Date(); day3.setDate(day3.getDate() + 3)
      const day7 = new Date(); day7.setDate(day7.getDate() + 7)
      const reviewData = { unlock_id: unlock.id, listing_id, dalali_id: listing.dalali_id }

      await admin.from('notifications').insert([
        {
          user_id:  user.id,
          title:    '⭐ Je, ulifurahi na dalali?',
          body:     `Umezungumza na ${dalaliName} (${listingLabel}). Toa maoni yako — inasaidia wengine kuchagua vizuri.`,
          type:     'review_request',
          is_read:  false,
          send_at:  day3.toISOString(),
          data:     reviewData,
        },
        {
          user_id:  user.id,
          title:    '🏠 Je, umepata nyumba?',
          body:     `Umezungumza na ${dalaliName} wiki iliyopita. Je, umepata nyumba? Toa review yako →`,
          type:     'review_reminder',
          is_read:  false,
          send_at:  day7.toISOString(),
          data:     reviewData,
        },
      ])

      return NextResponse.json({ unlock_id: unlock.id, mock: true, amount: UNLOCK_AMOUNT })
    }

    // ── Production paths ──────────────────────────────────

    // Normalize msisdn for mobile
    const normalizedMsisdn = msisdn
      ? (msisdn.startsWith('+') ? msisdn.slice(1)
        : msisdn.startsWith('0') ? `255${msisdn.slice(1)}`
        : msisdn.startsWith('255') ? msisdn : `255${msisdn}`)
      : ''

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/v1/payments/webhook`

    // ── Card payment ──────────────────────────────────────
    if (payment_type === 'card') {
      const { data: userData } = await admin
        .from('users')
        .select('email, full_name')
        .eq('id', user.id)
        .single()

      const { data: unlock, error: insertError } = await admin
        .from('contact_unlocks')
        .insert({
          client_id:      user.id,
          listing_id,
          dalali_id:      listing.dalali_id,
          amount_paid:    UNLOCK_AMOUNT,
          payment_method: provider,
          payment_ref,
          status:         'pending',
        })
        .select('id')
        .single()

      if (insertError || !unlock) {
        return NextResponse.json({ error: 'Imeshindwa kuanzisha malipo' }, { status: 500 })
      }

      const result = await initiateCardPayment({
        order_id:    payment_ref,
        amount:      UNLOCK_AMOUNT,
        webhook_url: webhookUrl,
        buyer_email: userData?.email ?? '',
        buyer_name:  userData?.full_name ?? 'Mteja',
      })

      if (!result.ok) {
        await admin.from('contact_unlocks').delete().eq('id', unlock.id)
        return NextResponse.json({ error: result.error }, { status: 502 })
      }

      return NextResponse.json({
        unlock_id:   unlock.id,
        payment_url: result.payment_url,
        amount:      UNLOCK_AMOUNT,
      })
    }

    // ── Mobile money STK push ─────────────────────────────
    const { data: unlock, error: insertError } = await admin
      .from('contact_unlocks')
      .insert({
        client_id:      user.id,
        listing_id,
        dalali_id:      listing.dalali_id,
        amount_paid:    UNLOCK_AMOUNT,
        payment_method: provider,
        payment_ref,
        status:         'pending',
      })
      .select('id')
      .single()

    if (insertError || !unlock) {
      return NextResponse.json({ error: 'Imeshindwa kuanzisha malipo' }, { status: 500 })
    }

    const result = await initiateStkPush({
      order_id:    payment_ref,
      msisdn:      normalizedMsisdn,
      amount:      UNLOCK_AMOUNT,
      webhook_url: webhookUrl,
      provider,
    })

    if (!result.ok) {
      await admin.from('contact_unlocks').delete().eq('id', unlock.id)
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ unlock_id: unlock.id, payment_ref, amount: UNLOCK_AMOUNT })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
