import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateListing, checkListingQuality } from '@/lib/security/validate'

// ── Shared: verify ownership ───────────────────────────────────
async function getOwned(id: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('listings')
    .select('id, dalali_id, status')
    .eq('id', id)
    .single()
  if (!data) return { listing: null, admin, error: 'Listing haipatikani' }
  if (data.dalali_id !== userId) return { listing: null, admin, error: 'Huna ruhusa' }
  return { listing: data, admin, error: null }
}

// ── PATCH — edit listing fields OR change status ───────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const { listing, admin, error: ownerErr } = await getOwned(params.id, user.id)
    if (ownerErr || !listing) return NextResponse.json({ error: ownerErr }, { status: 404 })

    const body = await req.json()

    // ── Status change only (taken / active) ──────────────────
    if (body.action === 'set_status') {
      const { status } = body
      if (!['active', 'taken'].includes(status)) {
        return NextResponse.json({ error: 'Status si sahihi' }, { status: 400 })
      }

      await admin.from('listings').update({ status }).eq('id', params.id)

      // Sync Marketplace availability when listing is taken
      if (status === 'taken') {
        void (async () => {
          try {
            const { data: ml } = await admin
              .from('marketplace_listings')
              .select('retailer_id')
              .eq('listing_id', params.id)
              .eq('status', 'active')
              .maybeSingle()
            if (ml?.retailer_id) {
              const { markMarketplaceItemTaken } = await import('@/lib/social/facebookMarketplace')
              await markMarketplaceItemTaken(ml.retailer_id)
              await admin
                .from('marketplace_listings')
                .update({ status: 'sold', availability: 'OUT_OF_STOCK', updated_at: new Date().toISOString() })
                .eq('listing_id', params.id)
            }
          } catch (err) {
            console.error('[Listing] Marketplace taken sync failed (non-fatal):', err)
          }
        })()
      }

      // Notify saved users when listing is taken
      if (status === 'taken') {
        const { data: saved } = await admin
          .from('saved_listings')
          .select('client_id')
          .eq('listing_id', params.id)

        if (saved?.length) {
          await admin.from('notifications').insert(
            saved.map(s => ({
              user_id: s.client_id,
              title: '🏠 Listing Imepangishwa',
              body: 'Listing uliyoipenda imeshapangishwa — tafuta nyingine kama yake.',
              type: 'listing_taken',
              is_read: false,
            }))
          )
        }
      }

      return NextResponse.json({ success: true })
    }

    // ── Full edit — validate before writing ──────────────────
    if (listing.status === 'rejected') {
      return NextResponse.json({ error: 'Listing iliyokataliwa haiwezi kuhaririwa' }, { status: 400 })
    }

    const parsed = validateListing(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Taarifa si sahihi', details: parsed.errors }, { status: 400 })
    }
    const data = parsed.data

    // Re-run quality gate so edits that now meet standards go live immediately
    const quality = checkListingQuality(data)
    const newStatus = quality.passed ? 'active' : 'pending'

    const updatePayload: Record<string, unknown> = {
      type: data.type,
      title: `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} – ${data.district}`,
      price_monthly: data.price_monthly,
      furnished: data.furnished,
      description: data.description ?? null,
      region: data.region,
      district: data.district,
      ward: data.ward ?? null,
      mtaa: data.mtaa ?? null,
      amenities: data.amenities,
      images: data.images,
      status: newStatus,
      street: '',
      latitude: data.latitude,
      longitude: data.longitude,
      address_full: data.address_full,
      place_id: data.place_id,
    }
    if (data.bedrooms !== null) updatePayload.bedrooms = data.bedrooms

    // Commission fields — optional; null clears them
    const VALID_COMMISSION_TYPES = ['one_month', 'percentage', 'fixed', 'negotiable']
    if ('commission_type' in body) {
      updatePayload.commission_type = VALID_COMMISSION_TYPES.includes(body.commission_type)
        ? body.commission_type
        : null
      updatePayload.commission_value = typeof body.commission_value === 'number'
        ? body.commission_value
        : null
      updatePayload.commission_notes = typeof body.commission_notes === 'string'
        ? body.commission_notes.trim() || null
        : null
    }

    const { error } = await admin.from('listings').update(updatePayload).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// ── DELETE — soft delete (status = expired) ────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const { listing, admin, error: ownerErr } = await getOwned(params.id, user.id)
    if (ownerErr || !listing) return NextResponse.json({ error: ownerErr }, { status: 404 })

    // Soft delete — hides listing from all views but retains DB record
    const { error: deleteErr } = await admin
      .from('listings')
      .update({ status: 'deleted' })
      .eq('id', params.id)

    if (deleteErr) {
      console.error('[Listing DELETE] update failed:', deleteErr)
      return NextResponse.json({ error: 'Imeshindwa kufuta listing' }, { status: 500 })
    }

    // Remove from Marketplace (non-fatal)
    void (async () => {
      try {
        const { data: ml } = await admin
          .from('marketplace_listings')
          .select('retailer_id')
          .eq('listing_id', params.id)
          .eq('status', 'active')
          .maybeSingle()
        if (ml?.retailer_id) {
          const { deleteMarketplaceItem } = await import('@/lib/social/facebookMarketplace')
          await deleteMarketplaceItem(ml.retailer_id)
          await admin
            .from('marketplace_listings')
            .update({ status: 'deleted', availability: 'OUT_OF_STOCK', updated_at: new Date().toISOString() })
            .eq('listing_id', params.id)
        }
      } catch (err) {
        console.error('[Listing] Marketplace delete sync failed (non-fatal):', err)
      }
    })()

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
