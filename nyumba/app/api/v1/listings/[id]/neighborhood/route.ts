import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNeighborhoodInfo } from '@/lib/listings/neighborhoodInfo'

// Nominatim (6s) + Overpass with fallbacks (up to 24s) — allow headroom
export const maxDuration = 45

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const supabase = await createClient()

    const { data: listing, error } = await supabase
      .from('listings')
      .select('region, district, ward, latitude, longitude')
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle()

    if (error || !listing) {
      return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
    }

    if (!listing.region || !listing.district) {
      return NextResponse.json({ error: 'Listing haina taarifa za eneo' }, { status: 404 })
    }

    const data = await getNeighborhoodInfo({
      listingId: id,
      region:    listing.region,
      district:  listing.district,
      ward:      listing.ward   ?? null,
      lat:       listing.latitude  ? Number(listing.latitude)  : null,
      lng:       listing.longitude ? Number(listing.longitude) : null,
    })

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=1800' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    console.error('[Neighborhood API]', msg)
    return NextResponse.json({ error: 'Imeshindwa kupata habari za mtaa' }, { status: 500 })
  }
}
