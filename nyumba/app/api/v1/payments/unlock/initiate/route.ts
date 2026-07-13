import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { mobileCheckout, normalizePhone, detectProvider, generateExternalId, type MobileProvider } from '@/lib/payments/azampay'
import { sendPushToUser } from '@/lib/notifications/send'
import { rateLimit } from '@/lib/security/rateLimit'
import { getPricing } from '@/lib/config/pricing'

export const maxDuration = 30
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
    const { listing_id, msisdn, provider = 'mpesa' } = await req.json()
    const UNLOCK_AMOUNT = (await getPricing()).unlock

    if (!listing_id) {
      return NextResponse.json({ error: 'listing_id inahitajika' }, { status: 400 })
    }
    if (!msisdn) {
      return NextResponse.json({ error: 'Weka namba yako ya simu ya malipo' }, { status: 400 })
    }
    // Validate normalized format: must be 255XXXXXXXXX (12 digits)
    const normalized = normalizePhone(msisdn)
    if (!normalized.startsWith('255') || normalized.length !== 12 || !/^\d{12}$/.test(normalized)) {
      return NextResponse.json({ error: 'Namba ya simu si sahihi. Tumia format ya Tanzania (07XXXXXXXX)' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    // 10 unlock attempts per 10 minutes per user
    const rl = await rateLimit(`unlock:${user.id}`, 10, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi sana. Subiri dakika chache.' }, { status: 429 })
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

    // Fetch all existing rows — avoids PGRST116 crash when multiple rows exist
    const { data: existingList } = await admin
      .from('contact_unlocks')
      .select('id, status')
      .eq('client_id', user.id)
      .eq('listing_id', listing_id)
      .order('created_at', { ascending: false })
      .limit(10)

    const completedRecord = (existingList ?? []).find(r => r.status === 'completed')
    if (completedRecord) {
      return NextResponse.json({ error: 'Tayari umefungua listing hii', already_unlocked: true }, { status: 400 })
    }

    // Only delete failed records — never touch pending ones that may have an in-flight STK push
    const staleIds = (existingList ?? [])
      .filter(r => r.status === 'failed')
      .map(r => r.id)
    if (staleIds.length > 0) {
      await admin.from('contact_unlocks').delete().in('id', staleIds)
    }

    const payment_ref = generateExternalId('NYU')

    // ── Dev / mock mode: complete immediately for ALL providers ──
    if (IS_MOCK) {
      const mockExpiresAt = new Date()
      mockExpiresAt.setFullYear(mockExpiresAt.getFullYear() + 1)

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
          expires_at:     mockExpiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !unlock) {
        return NextResponse.json({ error: insertError?.message ?? 'Imeshindwa kuunda unlock' }, { status: 500 })
      }

      await admin.rpc('increment_lead_count', { listing_id }).maybeSingle()

      const dalaliName   = (listing as typeof listing & { dalali?: { full_name?: string } | null }).dalali?.full_name ?? 'dalali'
      const listingLabel = `${listing.type} – ${listing.district}`
      const leadBody     = `Mteja amepata nambari yako kupitia listing ya ${listingLabel}.`

      // Notify dalali via WhatsApp (non-blocking)
      import('@/lib/listings/rentalReminder')
        .then(m => m.notifyDalaliNewUnlock({
          dalaliId:  listing.dalali_id,
          listingId: listing_id,
          listingLabel,
        }))
        .catch(e => console.error('[RentalReminder] mock notifyDalaliNewUnlock failed (non-fatal):', e))

      await admin.from('notifications').insert({
        user_id:  listing.dalali_id,
        title:    '📲 Lead Mpya!',
        body:     leadBody,
        type:     'new_lead',
        is_read:  false,
        ref_id:   unlock.id,
      })
      await sendPushToUser(listing.dalali_id, '🔔 Mteja Mpya!', leadBody, '/dashboard')

      await admin.from('notifications').insert([
        {
          user_id:  user.id,
          title:    '⭐ Je, ulifurahi na dalali?',
          body:     `Umezungumza na ${dalaliName} (${listingLabel}). Toa maoni yako — inasaidia wengine kuchagua vizuri.`,
          type:     'review_request',
          is_read:  false,
          ref_id:   unlock.id,
        },
        {
          user_id:  user.id,
          title:    '🏠 Je, umepata nyumba?',
          body:     `Umezungumza na ${dalaliName} wiki iliyopita. Je, umepata nyumba? Toa review yako →`,
          type:     'review_reminder',
          is_read:  false,
          ref_id:   unlock.id,
        },
      ])

      return NextResponse.json({ unlock_id: unlock.id, mock: true, amount: UNLOCK_AMOUNT })
    }

    // ── Production path: AzamPay mobile checkout ──────────
    const accountNumber = normalized  // already validated above
    const azamProvider  = provider ? toAzamProvider(provider) : detectProvider(accountNumber)

    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

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
        expires_at:     expiresAt.toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !unlock) {
      console.error('[Unlock/initiate] DB insert failed:', JSON.stringify({
        message: insertError?.message, code: insertError?.code,
        details: insertError?.details, hint: insertError?.hint,
      }))
      return NextResponse.json({ error: 'Imeshindwa kuanzisha malipo. Jaribu tena.' }, { status: 500 })
    }

    const result = await mobileCheckout({
      accountNumber,
      amount:      UNLOCK_AMOUNT,
      externalId:  payment_ref,
      provider:    azamProvider,
      description: 'Fungua contact ya dalali — NyumbaFasta',
    })

    if (!result.ok) {
      console.error('[Unlock/initiate] mobileCheckout failed:', result.message, result.raw)
      await admin.from('contact_unlocks').delete().eq('id', unlock.id)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    return NextResponse.json({ unlock_id: unlock.id, payment_ref, amount: UNLOCK_AMOUNT })
  } catch (err) {
    console.error('[Unlock/initiate] Unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
