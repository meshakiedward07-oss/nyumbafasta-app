import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/notifications/send'
import { auditLog } from '@/lib/security/auditLog'
import { getClientIp } from '@/lib/security/rateLimit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })
    }

    const { action } = await req.json()
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action si sahihi' }, { status: 400 })
    }

    const admin = createAdminClient()
    const newStatus = action === 'approve' ? 'active' : 'rejected'

    const { error: updateError } = await admin
      .from('listings')
      .update({ status: newStatus })
      .eq('id', params.id)
      .eq('status', 'pending')

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await auditLog({
      action: action === 'approve' ? 'listing_approved' : 'listing_rejected',
      user_id: user.id,
      target_id: params.id,
      target_type: 'listing',
      ip_address: getClientIp(req),
      severity: 'info',
    })

    // Notify dalali via notifications table
    const { data: listing } = await admin
      .from('listings')
      .select('dalali_id, type, district')
      .eq('id', params.id)
      .single()

    if (listing) {
      const notifTitle = action === 'approve' ? '✅ Listing Imeidhibitiwa' : '❌ Listing Ilikataliwa'
      const notifBody  = action === 'approve'
        ? `${listing.type} yako – ${listing.district} imeidhibitiwa na inaonekana kwa wateja.`
        : `${listing.type} yako – ${listing.district} ilikataliwa. Angalia sababu na uirekebisha.`

      await admin.from('notifications').insert({
        user_id: listing.dalali_id,
        title: notifTitle,
        body: notifBody,
        type: action === 'approve' ? 'listing_approved' : 'listing_rejected',
        is_read: false,
        data: { listing_id: params.id },
      })

      // Push notification
      await sendPushToUser(listing.dalali_id, notifTitle, notifBody, '/dashboard/listings')
    }

    // Auto-post to Facebook Marketplace on approval (non-fatal)
    if (action === 'approve' && listing) {
      void (async () => {
        try {
          const { data: fullListing } = await admin
            .from('listings')
            .select('*')
            .eq('id', params.id)
            .single()
          if (fullListing) {
            const { postListingToMarketplace } = await import('@/lib/social/facebookMarketplace')
            const mResult = await postListingToMarketplace(fullListing)
            console.log(`[Approval] Marketplace: ${mResult.success ? '✅ ' + mResult.itemId : '❌ ' + mResult.error}`)
          }
        } catch (err) {
          console.error('[Approval] Marketplace post failed (non-fatal):', err)
        }
      })()
    }

    // Auto-post to TikTok on approval if listing has video (non-fatal, non-blocking)
    if (action === 'approve' && listing) {
      void (async () => {
        try {
          const { data: fullListing } = await admin
            .from('listings')
            .select('*')
            .eq('id', params.id)
            .single()
          if (fullListing?.video_url) {
            const { postVideoToTikTok, generateTikTokCaption } = await import('@/lib/social/tiktok')
            const caption = generateTikTokCaption(fullListing as import('@/lib/types/database').Listing)
            const ttResult = await postVideoToTikTok({
              videoUrl: fullListing.video_url,
              caption,
              listingId: params.id,
            })
            console.log(`[Approval] TikTok: ${ttResult.success ? '✅ ' + ttResult.publishId : '❌ ' + ttResult.error}`)
          }
        } catch (err) {
          console.error('[Approval] TikTok post failed (non-fatal):', err)
        }
      })()
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
