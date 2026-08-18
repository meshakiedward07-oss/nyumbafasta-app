import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { updateOccupancy, resetOccupancy } from '@/lib/listings/occupancy'

// PATCH — update occupancy count
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
    const role = me?.role ?? ''

    const admin = createAdminClient()
    const { data: listing } = await admin
      .from('listings')
      .select('id, dalali_id, listing_unit_type, total_capacity, current_occupancy')
      .eq('id', id)
      .single()

    if (!listing) return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
    if (role !== 'admin' && listing.dalali_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    if (listing.listing_unit_type !== 'multi') return NextResponse.json({ error: 'Listing hii si ya aina ya multi-unit' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (body === null || typeof body.occupancy !== 'number') {
      return NextResponse.json({ error: 'occupancy (number) inahitajika' }, { status: 400 })
    }

    const result = await updateOccupancy({
      listingId: id,
      newOccupancy: body.occupancy,
      changedBy: user.id,
    })

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({
      success: true,
      autoDeactivated: result.autoDeactivated,
      message: result.autoDeactivated ? 'Listing imefungwa automatically — imejaa' : 'Idadi imesasishwa',
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH app/api/v1/listings/[id]/occupancy]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST — reactivate listing (dalali specifies how many more tenants are still needed)
// Body (optional): { remaining_needed: number } — how many MORE tenants are still wanted.
// If provided, sets total_capacity = remaining_needed and resets occupancy to 0 (fresh intake round).
// If omitted, behaves as a plain reset: occupancy = 0, status = active.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
    const role = me?.role ?? ''

    const admin = createAdminClient()
    const { data: listing } = await admin
      .from('listings')
      .select('id, dalali_id, listing_unit_type')
      .eq('id', id)
      .single()

    if (!listing) return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
    if (role !== 'admin' && listing.dalali_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    if (listing.listing_unit_type !== 'multi') return NextResponse.json({ error: 'Listing hii si ya aina ya multi-unit' }, { status: 400 })

    const body = await req.json().catch(() => null)
    const remainingNeeded = body?.remaining_needed

    if (remainingNeeded !== undefined) {
      const n = Number(remainingNeeded)
      if (!Number.isInteger(n) || n < 1 || n > 500) {
        return NextResponse.json({ error: 'remaining_needed lazima iwe kati ya 1 na 500' }, { status: 400 })
      }
      // Fresh intake round: reset occupancy and update total_capacity to how many are still needed
      await admin
        .from('listings')
        .update({ current_occupancy: 0, total_capacity: n, status: 'active', auto_deactivated_at: null })
        .eq('id', id)
      await admin.from('listing_occupancy_log').insert({
        listing_id: id,
        previous_occupancy: null,
        new_occupancy: 0,
        changed_by: user.id,
        change_reason: 'reactivate_remaining',
      })
    } else {
      await resetOccupancy(id, user.id, true)
    }

    return NextResponse.json({
      success: true,
      message: remainingNeeded
        ? `Listing imefunguliwa — unahitaji wapangaji ${remainingNeeded} zaidi`
        : 'Listing imefunguliwa tena',
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/listings/[id]/occupancy]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
