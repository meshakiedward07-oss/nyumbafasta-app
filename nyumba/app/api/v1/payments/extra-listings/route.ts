import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { initiateStkPush } from '@/lib/selcom'

const PRICE_PER_EXTRA = 2_000
const IS_DEV = !process.env.SELCOM_API_KEY || process.env.SELCOM_API_KEY.startsWith('test_')

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { count, msisdn, provider = 'mpesa' } = await req.json()
    if (!count || count < 1 || count > 20) {
      return NextResponse.json({ error: 'count lazima iwe kati ya 1 na 20' }, { status: 400 })
    }
    if (!msisdn) {
      return NextResponse.json({ error: 'msisdn inahitajika' }, { status: 400 })
    }

    const admin  = createAdminClient()
    const amount = count * PRICE_PER_EXTRA

    // Find active subscription
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, extra_listings, extra_listings_fee')
      .eq('dalali_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .maybeSingle()

    if (!sub) {
      return NextResponse.json({ error: 'Huna subscription inayofanya kazi' }, { status: 400 })
    }

    // Dev mode — activate immediately
    if (IS_DEV) {
      await admin.from('subscriptions').update({
        extra_listings:     (sub.extra_listings ?? 0) + count,
        extra_listings_fee: (sub.extra_listings_fee ?? 0) + amount,
      }).eq('id', sub.id)

      await admin.from('notifications').insert({
        user_id: user.id,
        title:   '✅ Listings za Ziada Zimeongezwa!',
        body:    `Umefanikiwa kuongeza listings ${count} za ziada. Unaweza sasa kupost listings zaidi.`,
        type:    'subscription_active',
        is_read: false,
        data:    { extra_count: count },
      })

      return NextResponse.json({ success: true, mock: true, added: count, amount })
    }

    // Production — STK push
    const payment_ref  = `EXTRA-${user.id.slice(0, 8)}-${Date.now()}`
    const webhookUrl   = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/v1/payments/extra-listings/webhook`
    const normalizedMs = msisdn.startsWith('+') ? msisdn.slice(1)
      : msisdn.startsWith('0')   ? `255${msisdn.slice(1)}`
      : msisdn.startsWith('255') ? msisdn : `255${msisdn}`

    const result = await initiateStkPush({
      order_id:    payment_ref,
      msisdn:      normalizedMs,
      amount,
      webhook_url: webhookUrl,
      provider,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    // Store pending payment metadata in subscription for webhook to pick up
    await admin.from('subscriptions').update({
      extra_listings_fee: (sub.extra_listings_fee ?? 0) + amount,
    }).eq('id', sub.id)

    return NextResponse.json({ payment_ref, amount, sub_id: sub.id, extra_count: count })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
