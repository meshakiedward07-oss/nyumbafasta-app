import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { sendPushToUser } from '@/lib/notifications/send'
import { auditLog } from '@/lib/security/auditLog'
import { getClientIp } from '@/lib/security/rateLimit'
import { sendMail } from '@/lib/email/resend'
import { listingApprovedEmail, listingRejectedEmail } from '@/lib/email/templates'

// Social posting on approval can take 30-60s per platform across 3 platforms
export const maxDuration = 120

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await requireAdminUser()
    if (!adminUser) return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })
    const user = adminUser

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
      })

      // Push notification
      await sendPushToUser(listing.dalali_id, notifTitle, notifBody, '/dashboard/listings')

      // WhatsApp + email (non-blocking)
      ;(async () => {
        try {
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
          const listingLabel = `${listing.type} – ${listing.district}`

          // WhatsApp to dalali
          const { data: dp } = await admin
            .from('dalali_profiles')
            .select('whatsapp_number')
            .eq('id', listing.dalali_id)
            .maybeSingle()
          if (dp?.whatsapp_number) {
            const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
            const msg = action === 'approve'
              ? `✅ *Listing Yako Imeidhibitiwa!*\n\n${listingLabel} inaonekana kwa wateja sasa!\n\n👉 ${APP_URL}/listings/${params.id}`
              : `❌ *Listing Yako Ilikataliwa*\n\n${listingLabel} haikuidhinishwa. Rekebisha na utume tena.\n\n👉 ${APP_URL}/dashboard/listings`
            await sendTextMessage(formatPhoneNumber(dp.whatsapp_number), msg).catch(() => {})
          }

          // Email
          if (process.env.RESEND_API_KEY) {
            const [dalaliEmail, dalaliNameRes] = await Promise.all([
              admin.auth.admin.getUserById(listing.dalali_id).then(r => r.data?.user?.email ?? null),
              admin.from('users').select('full_name').eq('id', listing.dalali_id).single()
                .then(r => r.data?.full_name ?? 'Dalali'),
            ])
            if (dalaliEmail) {
              if (action === 'approve') {
                const listingUrl = `${APP_URL}/listings/${params.id}`
                const { subject, html } = listingApprovedEmail(dalaliNameRes, listingLabel, listingUrl)
                await sendMail({ to: dalaliEmail, subject, html })
              } else {
                const { subject, html } = listingRejectedEmail(dalaliNameRes, listingLabel)
                await sendMail({ to: dalaliEmail, subject, html })
              }
            }
          }
        } catch (e) {
          console.error('[Listing Action] Notification error:', e)
        }
      })()
    }

    // Auto-post to ALL social platforms on approval (non-fatal, non-blocking)
    if (action === 'approve' && listing) {
      void (async () => {
        try {
          const { data: fullListing } = await admin
            .from('listings')
            .select('*')
            .eq('id', params.id)
            .single()

          if (!fullListing) return

          // Facebook Marketplace
          const { postListingToMarketplace } = await import('@/lib/social/facebookMarketplace')
          const mResult = await postListingToMarketplace(fullListing)
          if (!mResult.success) console.error('[Approval] Marketplace failed:', mResult.error)

          // Instagram + Facebook + TikTok via unified orchestrator (video)
          const { postListingToAllPlatforms, getConnectedPlatforms } = await import('@/lib/social/unifiedPost')
          const connectedPlatforms = await getConnectedPlatforms()
          if (connectedPlatforms.length > 0) {
            const uResult = await postListingToAllPlatforms({
              listingId: params.id,
              platforms: connectedPlatforms,
              createdBy: user.id,
            })
            for (const r of uResult.results) {
              if (!r.success) console.error(`[Approval] ${r.platform} failed: ${r.error}`)
            }
          }

          // Carousel — post 5 seconds after video to avoid rate limits (requires 2+ images)
          if ((fullListing.images?.length ?? 0) >= 2) {
            await new Promise(r => setTimeout(r, 5000))
            try {
              const { postListingCarousel } = await import('@/lib/social/carouselPost')
              const cResult = await postListingCarousel(fullListing)
              if (!cResult.success) console.error('[Approval] Carousel failed:', cResult.error)
            } catch (cErr) {
              console.error('[Approval] Carousel failed (non-fatal):', cErr)
            }
          }

          // Instagram Story — post first image as story
          if ((fullListing.images?.length ?? 0) >= 1) {
            await new Promise(r => setTimeout(r, 2000))
            try {
              const { postListingStoryAllPlatforms } = await import('@/lib/social/instagramStories')
              await postListingStoryAllPlatforms(fullListing)
            } catch (sErr) {
              console.error('[Approval] Story failed (non-fatal):', sErr)
            }
          }
        } catch (err) {
          console.error('[Approval] Social post failed (non-fatal):', err)
        }
      })()
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE — admin hard-deletes a listing (removes row from DB)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await requireAdminUser()
    if (!adminUser) return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })

    const admin = createAdminClient()

    const { data: listing } = await admin
      .from('listings')
      .select('id, dalali_id, title, type, district')
      .eq('id', params.id)
      .single()

    if (!listing) return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })

    // Non-fatal: remove from Marketplace before deleting the row
    try {
      const { data: ml } = await admin
        .from('marketplace_listings')
        .select('retailer_id')
        .eq('listing_id', params.id)
        .eq('status', 'active')
        .maybeSingle()
      if (ml?.retailer_id) {
        const { deleteMarketplaceItem } = await import('@/lib/social/facebookMarketplace')
        await deleteMarketplaceItem(ml.retailer_id).catch(() => {})
      }
    } catch { /* non-fatal */ }

    // Cascade-delete FK-constrained child records before hard-deleting the listing row
    await Promise.all([
      admin.from('saved_listings').delete().eq('listing_id', params.id),
      admin.from('contact_unlocks').delete().eq('listing_id', params.id),
      admin.from('marketplace_listings').delete().eq('listing_id', params.id),
      admin.from('social_posts').delete().eq('listing_id', params.id),
    ])

    const { error } = await admin
      .from('listings')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auditLog({
      action: 'listing_deleted',
      user_id: adminUser.id,
      target_id: params.id,
      target_type: 'listing',
      ip_address: getClientIp(req),
      severity: 'warning',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
