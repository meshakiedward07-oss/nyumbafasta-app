import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/selcom'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const digest = req.headers.get('Digest') ?? ''
    const ts = req.headers.get('Timestamp') ?? ''

    if (!verifyWebhookSignature(rawBody, digest, ts)) {
      return NextResponse.json({ error: 'Signature batili' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    const { order_id, resultcode, result } = payload

    if (!order_id) return NextResponse.json({ received: true })

    const admin = createAdminClient()

    // payment_ref stores what we called order_id (our unique reference)
    const { data: unlock } = await admin
      .from('contact_unlocks')
      .select('id, client_id, listing_id, dalali_id, status')
      .eq('payment_ref', order_id)
      .maybeSingle()

    if (!unlock || unlock.status !== 'pending') {
      return NextResponse.json({ received: true })
    }

    const succeeded = resultcode === '000' || result === 'SUCCESS'
    const newStatus = succeeded ? 'completed' : 'failed'

    await admin.from('contact_unlocks').update({ status: newStatus }).eq('id', unlock.id)

    if (succeeded) {
      await admin.rpc('increment_lead_count', { listing_id: unlock.listing_id }).maybeSingle()

      const { data: listing } = await admin
        .from('listings')
        .select('type, district, dalali:dalali_id(full_name)')
        .eq('id', unlock.listing_id)
        .single()

      if (listing) {
        const dalaliName = (listing as typeof listing & { dalali?: { full_name?: string } | null }).dalali?.full_name ?? 'dalali'
        const listingLabel = `${listing.type} – ${listing.district}`

        const day3 = new Date(); day3.setDate(day3.getDate() + 3)
        const day7 = new Date(); day7.setDate(day7.getDate() + 7)
        const reviewData = { unlock_id: unlock.id, listing_id: unlock.listing_id, dalali_id: unlock.dalali_id }

        await admin.from('notifications').insert([
          {
            user_id: unlock.dalali_id,
            title: '📞 Lead Mpya!',
            body: `Mteja amepata nambari yako kupitia listing ya ${listingLabel}.`,
            type: 'new_lead',
            is_read: false,
            data: { listing_id: unlock.listing_id, unlock_id: unlock.id },
          },
          {
            user_id: unlock.client_id,
            title: '⭐ Je, ulifurahi na dalali?',
            body: `Umezungumza na ${dalaliName} (${listingLabel}). Toa maoni yako — inasaidia wengine kuchagua vizuri.`,
            type: 'review_request',
            is_read: false,
            send_at: day3.toISOString(),
            data: reviewData,
          },
          {
            user_id: unlock.client_id,
            title: '🏠 Je, umepata nyumba?',
            body: `Umezungumza na ${dalaliName} wiki iliyopita. Je, umepata nyumba? Toa review yako →`,
            type: 'review_reminder',
            is_read: false,
            send_at: day7.toISOString(),
            data: reviewData,
          },
        ])
      }
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ received: true })
  }
}
