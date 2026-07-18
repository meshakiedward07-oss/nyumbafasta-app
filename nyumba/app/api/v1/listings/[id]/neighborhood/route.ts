import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNeighborhoodInfo } from '@/lib/listings/neighborhoodInfo'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()

    const { data: listing, error } = await supabase
      .from('listings')
      .select('region, district, ward, latitude, longitude')
      .eq('id', params.id)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !listing) {
      return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
    }

    if (!listing.region || !listing.district) {
      return NextResponse.json({ error: 'Listing haina taarifa za eneo' }, { status: 404 })
    }

    const data = await getNeighborhoodInfo({
      listingId: params.id,
      region:    listing.region,
      district:  listing.district,
      ward:      listing.ward   ?? null,
      lat:       listing.latitude  ? Number(listing.latitude)  : null,
      lng:       listing.longitude ? Number(listing.longitude) : null,
    })

    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    console.error('[Neighborhood API]', msg)
    return NextResponse.json({ error: 'Imeshindwa kupata habari za mtaa' }, { status: 500 })
  }
}
