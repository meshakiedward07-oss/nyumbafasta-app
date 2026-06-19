import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getNeighborhoodInfo } from '@/lib/listings/neighborhoodInfo'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = createAdminClient()

    const { data: listing, error } = await admin
      .from('listings')
      .select('latitude, longitude, region')
      .eq('id', params.id)
      .maybeSingle()

    if (error || !listing) {
      return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
    }

    if (!listing.latitude || !listing.longitude) {
      return NextResponse.json({ error: 'Listing haina location data' }, { status: 404 })
    }

    const data = await getNeighborhoodInfo(
      params.id,
      Number(listing.latitude),
      Number(listing.longitude),
      listing.region ?? undefined,
    )

    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    console.error('[Neighborhood API]', msg)
    return NextResponse.json({ error: 'Imeshindwa kupata habari za mtaa' }, { status: 500 })
  }
}
