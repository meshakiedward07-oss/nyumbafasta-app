// Pay from wallet — handles unlock, subscription, boost
// Payment is instant (no USSD). Returns result immediately.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { debitWallet } from '@/lib/payments/wallet'
import { sendPushToUser } from '@/lib/notifications/send'
import { rateLimit } from '@/lib/security/rateLimit'

export const maxDuration = 30

const PLAN_PRICES: Record<string, number> = { basic: 10_000, premium: 25_000, enterprise: 50_000 }
const BOOST_PRICES: Record<number, number> = { 1: 5_000, 2: 9_000, 4: 16_000 }
const UNLOCK_AMOUNT = 2_000

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const rl = await rateLimit(`wallet-pay:${user.id}`, 20, 5 * 60 * 1000)
    if (!rl.allowed) return NextResponse.json({ error: 'Maombi mengi sana' }, { status: 429 })

    const body = await req.json()
    const { type } = body

    const admin = createAdminClient()

    // ── UNLOCK ────────────────────────────────────────────────
    if (type === 'unlock') {
      const { listing_id } = body
      if (!listing_id) return NextResponse.json({ error: 'listing_id inahitajika' }, { status: 400 })

      const { data: listing } = await admin
        .from('listings')
        .select('id, dalali_id, status, type, district, dalali:dalali_id(full_name)')
        .eq('id', listing_id)
        .eq('status', 'active')
        .single()

      if (!listing) return NextResponse.json({ error: 'Listing haipatikani au haipo active' }, { status: 404 })
      if (listing.dalali_id === user.id) return NextResponse.json({ error: 'Huwezi kufungua listing yako mwenyewe' }, { status: 400 })

      const { data: existing } = await admin
        .from('contact_unlocks')
        .select('id')
        .eq('client_id', user.id)
        .eq('listing_id', listing_id)
        .eq('status', 'completed')
        .maybeSingle()

      if (existing) return NextResponse.json({ error: 'Tayari umefungua listing hii', already_unlocked: true }, { status: 400 })

      const debit = await debitWallet({
        userId:         user.id,
        amount:         UNLOCK_AMOUNT,
        description:    `Fungua contact — ${listing_id}`,
        referenceType:  'unlock',
      }, admin)

      if (!debit.ok) return NextResponse.json({ error: debit.message }, { status: 402 })

      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)

      const { data: unlock, error: insertErr } = await admin
        .from('contact_unlocks')
        .insert({
          client_id:      user.id,
          listing_id,
          dalali_id:      listing.dalali_id,
          amount_paid:    UNLOCK_AMOUNT,
          payment_method: 'wallet',
          payment_ref:    debit.wallet ? `WLT-${Date.now()}` : `WLT-${Date.now()}`,
          status:         'completed',
          expires_at:     expiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (insertErr || !unlock) {
        // Refund wallet on DB failure
        const { creditWallet } = await import('@/lib/payments/wallet')
        await creditWallet({ userId: user.id, amount: UNLOCK_AMOUNT, description: 'Refund — fungua listing ilishindwa', referenceType: 'refund' }, admin)
        return NextResponse.json({ error: 'Imeshindwa kuhifadhi unlock — salio limerudishwa' }, { status: 500 })
      }

      // Update wallet transaction with reference_id
      await admin
        .from('wallet_transactions')
        .update({ reference_id: unlock.id })
        .eq('user_id', user.id)
        .eq('reference_type', 'unlock')
        .is('reference_id', null)
        .order('created_at', { ascending: false })
        .limit(1)

      await admin.rpc('increment_lead_count', { listing_id }).maybeSingle()

      const dalaliName   = (listing as typeof listing & { dalali?: { full_name?: string } | null }).dalali?.full_name ?? 'dalali'
      const listingLabel = `${listing.type} – ${listing.district}`
      const leadBody     = `Mteja amepata nambari yako kupitia listing ya ${listingLabel}.`

      // Notify dalali (non-blocking)
      import('@/lib/listings/rentalReminder')
        .then(m => m.notifyDalaliNewUnlock({ dalaliId: listing.dalali_id, listingId: listing_id, listingLabel }))
        .catch(e => console.error('[Wallet/pay] notifyDalaliNewUnlock (non-fatal):', e))

      await admin.from('notifications').insert({
        user_id: listing.dalali_id, title: '📲 Lead Mpya!', body: leadBody,
        type: 'new_lead', is_read: false, data: { listing_id, unlock_id: unlock.id },
      })
      await sendPushToUser(listing.dalali_id, '🔔 Mteja Mpya!', leadBody, '/dashboard')

      const day3 = new Date(); day3.setDate(day3.getDate() + 3)
      const day7 = new Date(); day7.setDate(day7.getDate() + 7)
      const reviewData = { unlock_id: unlock.id, listing_id, dalali_id: listing.dalali_id }
      await admin.from('notifications').insert([
        { user_id: user.id, title: '⭐ Je, ulifurahi na dalali?', body: `Umezungumza na ${dalaliName} (${listingLabel}). Toa maoni yako.`, type: 'review_request', is_read: false, send_at: day3.toISOString(), data: reviewData },
        { user_id: user.id, title: '🏠 Je, umepata nyumba?', body: `Toa review yako →`, type: 'review_reminder', is_read: false, send_at: day7.toISOString(), data: reviewData },
      ])

      return NextResponse.json({ success: true, unlock_id: unlock.id, wallet_balance: debit.wallet?.balance ?? 0 })
    }

    // ── SUBSCRIPTION ──────────────────────────────────────────
    if (type === 'subscription') {
      const { plan } = body
      if (!plan || !PLAN_PRICES[plan]) return NextResponse.json({ error: 'Plan si sahihi' }, { status: 400 })

      const amount     = PLAN_PRICES[plan]
      const expiresAt  = new Date(); expiresAt.setDate(expiresAt.getDate() + 30)

      const debit = await debitWallet({ userId: user.id, amount, description: `Subscription ${plan}`, referenceType: 'subscription' }, admin)
      if (!debit.ok) return NextResponse.json({ error: debit.message }, { status: 402 })

      const { data: subscription, error: insertErr } = await admin
        .from('subscriptions')
        .insert({ dalali_id: user.id, plan, status: 'active', amount_paid: amount, payment_method: 'wallet', payment_ref: `WLT-${Date.now()}`, starts_at: new Date().toISOString(), expires_at: expiresAt.toISOString() })
        .select('id').single()

      if (insertErr || !subscription) {
        const { creditWallet } = await import('@/lib/payments/wallet')
        await creditWallet({ userId: user.id, amount, description: 'Refund — subscription ilishindwa', referenceType: 'refund' }, admin)
        return NextResponse.json({ error: 'Imeshindwa kuunda subscription — salio limerudishwa' }, { status: 500 })
      }

      const planName = plan === 'premium' ? 'Premium ⭐' : 'Basic'
      await admin.from('notifications').insert({ user_id: user.id, title: '✅ Subscription Imewashwa!', body: `Plan yako ya ${planName} imefanikiwa.`, type: 'subscription_active', is_read: false, data: { plan } })

      return NextResponse.json({ success: true, subscription_id: subscription.id, wallet_balance: debit.wallet?.balance ?? 0 })
    }

    // ── BOOST ─────────────────────────────────────────────────
    if (type === 'boost') {
      const { listing_id, weeks } = body
      if (!listing_id || !BOOST_PRICES[weeks]) return NextResponse.json({ error: 'listing_id na weeks (1/2/4) zinahitajika' }, { status: 400 })

      const amount = BOOST_PRICES[weeks]

      const { data: listing } = await admin
        .from('listings').select('id, dalali_id, status, boosted_until, boost_count').eq('id', listing_id).single()
      if (!listing) return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })
      if (listing.dalali_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

      const debit = await debitWallet({ userId: user.id, amount, description: `Boost listing wiki ${weeks}`, referenceType: 'boost' }, admin)
      if (!debit.ok) return NextResponse.json({ error: debit.message }, { status: 402 })

      const currentUntil = listing.boosted_until ? new Date(listing.boosted_until) : new Date()
      const base         = currentUntil > new Date() ? currentUntil : new Date()
      const boostedUntil = new Date(base); boostedUntil.setDate(boostedUntil.getDate() + weeks * 7)

      const { data: bp, error: bpErr } = await admin
        .from('boost_payments')
        .insert({ listing_id, dalali_id: user.id, amount, weeks, status: 'completed', payment_method: 'wallet', payment_ref: `WLT-${Date.now()}`, boosted_from: new Date().toISOString(), boosted_until: boostedUntil.toISOString() })
        .select('id').single()

      if (bpErr || !bp) {
        const { creditWallet } = await import('@/lib/payments/wallet')
        await creditWallet({ userId: user.id, amount, description: 'Refund — boost ilishindwa', referenceType: 'refund' }, admin)
        return NextResponse.json({ error: 'Imeshindwa kuhifadhi boost — salio limerudishwa' }, { status: 500 })
      }

      await admin.from('listings').update({ is_boosted: true, boosted_until: boostedUntil.toISOString(), boost_count: (listing.boost_count ?? 0) + 1 }).eq('id', listing_id)
      await admin.from('notifications').insert({ user_id: user.id, title: '⚡ Listing Imeboostwa!', body: `Listing yako itaonekana juu ya wote kwa wiki ${weeks}.`, type: 'boost_activated', is_read: false, data: { listing_id } })

      return NextResponse.json({ success: true, boost_payment_id: bp.id, boosted_until: boostedUntil.toISOString(), wallet_balance: debit.wallet?.balance ?? 0 })
    }

    return NextResponse.json({ error: 'Aina ya malipo haijulikani' }, { status: 400 })
  } catch (err) {
    console.error('[Wallet/pay]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
