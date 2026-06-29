import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { postListingCarousel, getRecentCarousels } from '@/lib/social/carouselPost'
import type { Listing } from '@/lib/types/database'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 60

// POST /api/v1/social/carousel  — { listingId }
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { listingId } = await req.json() as { listingId?: string }

  if (!listingId) {
    return NextResponse.json({ error: 'listingId inahitajika' }, { status: 400 })
  }

  const { data: listing, error } = await supabaseAdmin
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error || !listing) {
    return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
  }

  const l = listing as Listing

  if (!l.images || l.images.length < 2) {
    return NextResponse.json(
      {
        error:       `Carousel inahitaji picha angalau 2. Listing hii ina picha ${l.images?.length ?? 0} tu.`,
        imagesCount: l.images?.length ?? 0,
      },
      { status: 400 },
    )
  }

  console.log('[API/carousel] Starting for listing:', listingId)
  const result = await postListingCarousel(l)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success:     true,
    postId:      result.postId,
    slidesCount: result.slidesCount,
    message:     `Carousel imechapishwa! (Slides: ${result.slidesCount})`,
  })
}

// GET /api/v1/social/carousel  — carousel history
export async function GET(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  const carousels = await getRecentCarousels(limit)
  return NextResponse.json({ carousels })
}
