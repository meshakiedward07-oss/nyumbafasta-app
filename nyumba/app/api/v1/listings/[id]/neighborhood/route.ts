import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getNeighborhoodInfo } from '@/lib/listings/neighborhoodInfo'
import { rateLimit } from '@/lib/security/rateLimit'

// Nominatim (6s) + Overpass with fallbacks (up to 24s) — allow headroom
export const maxDuration = 45

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    // Rate limit: 30 requests per minute per IP — each cache miss triggers external API calls
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
    const rl = await rateLimit(`neighborhood:${ip}`, 30, 60_000)
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    // Admin client — this is a public, read-only lookup (region/district/ward/
    // lat/lng are already shown on the public listing detail page itself), and
    // the RLS client silently returned zero rows here regardless of the
    // listings table's public-read policy, making every listing 404 with
    // "Listing haikupatikana" and the neighbourhood section render empty.
    const admin = createAdminClient()

    const { data: listing, error } = await admin
      .from('listings')
      .select('region, district, ward, latitude, longitude')
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      console.error('[Neighborhood API] listing lookup failed:', error.message)
    }
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
