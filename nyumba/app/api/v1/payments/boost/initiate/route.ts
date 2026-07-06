import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { mobileCheckout, normalizePhone, generateExternalId, type MobileProvider } from '@/lib/payments/azampay'
import { rateLimit } from '@/lib/security/rateLimit'

export const maxDuration = 30

const PRICES: Record<number, number> = { 1: 5_000, 2: 9_000, 4: 16_000 }
const IS_MOCK = process.env.AZAMPAY_MOCK === 'true'

function toAzamProvider(p: string): MobileProvider {
  const map: Record<string, MobileProvider> = {
    mpesa: 'Mpesa', airtel: 'Airtel', tigo: 'Tigo', tigopesa: 'Tigo', halopesa: 'Halopesa', azampesa: 'Azampesa',
    Mpesa: 'Mpesa', Airtel: 'Airtel', Tigo: 'Tigo', Halopesa: 'Halopesa', Azampesa: 'Azampesa',
    AirtelMoney: 'Airtel', Tigopesa: 'Tigo',
  }
  return map[p] ?? 'Mpesa'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const rl = await rateLimit(`boost-initiate:${user.id}`, 10, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi sana — subiri dakika 10' }, { status: 429 })
    }

    const { listing_id, weeks, msisdn, provider = 'mpesa' } = await req.json()

    if (!listing_id) return NextResponse.json({ error: 'listing_id inahitajika' }, { status: 400 })
    if (!PRICES[weeks]) return NextResponse.json({ error: 'Wiki si sahihi (1, 2, au 4)' }, { status: 400 })
    if (!msisdn) return NextResponse.json({ error: 'msisdn inahitajika' }, { status: 400 })

    const accountNumber = normalizePhone(msisdn)
    if (!accountNumber.startsWith('255') || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Namba ya simu si sahihi. Tumia format ya Tanzania (07XXXXXXXX)' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: listing } = await admin
      .from('listings')
      .select('id, dalali_id, status, boosted_until, boost_count')
      .eq('id', listing_id)
      .single()

    if (!listing) return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })
    if (listing.dalali_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    if (!['active', 'pending'].includes(listing.status)) {
      return NextResponse.json({ error: 'Listing lazima iwe active' }, { status: 400 })
    }

    const amount      = PRICES[weeks]
    const payment_ref = generateExternalId('BST')
    const azamProvider = toAzamProvider(provider)

    const currentUntil = listing.boosted_until ? new Date(listing.boosted_until) : new Date()
    const base         = currentUntil > new Date() ? currentUntil : new Date()
    const boostedUntil = new Date(base)
    boostedUntil.setDate(boostedUntil.getDate() + weeks * 7)
    const boostedUntilISO = boostedUntil.toISOString()

    // ── Mock mode ─────────────────────────────────────────────
    if (IS_MOCK) {
      await admin.from('boost_payments').insert({
        listing_id, dalali_id: user.id, amount, weeks,
        status: 'completed', payment_method: provider, payment_ref,
        boosted_from: new Date().toISOString(), boosted_until: boostedUntilISO,
      })
      await admin.from('listings').update({
        is_boosted: true, boosted_until: boostedUntilISO,
        boost_count: (listing.boost_count ?? 0) + 1,
      }).eq('id', listing_id)
      await admin.from('notifications').insert({
        user_id: user.id, title: '⚡ Listing Imeboostwa!',
        body: `Listing yako itaonekana juu ya wote kwa wiki ${weeks}.`,
        type: 'boost_activated', is_read: false, data: { listing_id },
      })
      return NextResponse.json({ mock: true, boosted_until: boostedUntilISO, amount })
    }

    // ── Create pending boost_payment ──────────────────────────
    const { data: boostPayment, error: insertErr } = await admin
      .from('boost_payments')
      .insert({
        listing_id, dalali_id: user.id, amount, weeks,
        status: 'pending', payment_method: provider, payment_ref,
        boosted_from: new Date().toISOString(), boosted_until: boostedUntilISO,
      })
      .select('id')
      .single()

    if (insertErr || !boostPayment) {
      console.error('[Boost/initiate] Insert failed:', insertErr)
      return NextResponse.json({ error: insertErr?.message ?? 'Imeshindwa kuanzisha malipo' }, { status: 500 })
    }

    const result = await mobileCheckout({
      accountNumber,
      amount,
      externalId:  payment_ref,
      provider:    azamProvider,
    })

    if (!result.ok) {
      console.error('[Boost/initiate] mobileCheckout failed:', result.message)
      await admin.from('boost_payments').delete().eq('id', boostPayment.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    return NextResponse.json({
      success:          true,
      boost_payment_id: boostPayment.id,
      payment_ref,
      amount,
      message:          'Subiri USSD popup kwenye simu yako',
    })
  } catch (err) {
    console.error('[Boost/initiate] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
