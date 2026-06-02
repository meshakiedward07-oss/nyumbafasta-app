import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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

    // ── Full edit (resubmits for review) ─────────────────────
    if (listing.status === 'rejected') {
      return NextResponse.json({ error: 'Listing iliyokataliwa haiwezi kuhaririwa' }, { status: 400 })
    }

    const { type, price_monthly, bedrooms, furnished, description, region, district, amenities, images } = body
    const updatePayload: Record<string, unknown> = {
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} – ${district}`,
      price_monthly: Number(price_monthly),
      furnished,
      description: description ?? null,
      region, district,
      amenities: amenities ?? [],
      images: images ?? [],
      status: 'pending',
      street: '',
    }
    if (bedrooms !== undefined) updatePayload.bedrooms = bedrooms ?? null

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

    // Soft delete — keeps data for records
    await admin.from('listings').update({ status: 'expired' }).eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
