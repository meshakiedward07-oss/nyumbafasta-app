import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { updateOccupancy, resetOccupancy } from '@/lib/listings/occupancy'

// PATCH — update occupancy count
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = me?.role ?? ''

  const admin = createAdminClient()
  const { data: listing } = await admin
    .from('listings')
    .select('id, dalali_id, listing_unit_type, total_capacity, current_occupancy')
    .eq('id', params.id)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
  if (role !== 'admin' && listing.dalali_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
  if (listing.listing_unit_type !== 'multi') return NextResponse.json({ error: 'Listing hii si ya aina ya multi-unit' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (body === null || typeof body.occupancy !== 'number') {
    return NextResponse.json({ error: 'occupancy (number) inahitajika' }, { status: 400 })
  }

  const result = await updateOccupancy({
    listingId: params.id,
    newOccupancy: body.occupancy,
    changedBy: user.id,
  })

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({
    success: true,
    autoDeactivated: result.autoDeactivated,
    message: result.autoDeactivated ? 'Listing imefungwa automatically — imejaa' : 'Idadi imesasishwa',
  })
}

// POST — reset occupancy (tenant moved out, reactivate listing)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = me?.role ?? ''

  const admin = createAdminClient()
  const { data: listing } = await admin
    .from('listings')
    .select('id, dalali_id, listing_unit_type')
    .eq('id', params.id)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
  if (role !== 'admin' && listing.dalali_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
  if (listing.listing_unit_type !== 'multi') return NextResponse.json({ error: 'Listing hii si ya aina ya multi-unit' }, { status: 400 })

  await resetOccupancy(params.id, user.id, true)

  return NextResponse.json({ success: true, message: 'Listing imefunguliwa tena — wapangaji 0' })
}
