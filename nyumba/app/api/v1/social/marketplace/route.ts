import { NextRequest, NextResponse } from 'next/server'
import { getMarketplaceStats, postListingToMarketplace, repostListingToMarketplace } from '@/lib/social/facebookMarketplace'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 60

// GET /api/v1/social/marketplace — stats + recent listings
export async function GET() {
  try {
    const admin = await requireAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const catalogConfigured = !!process.env.FACEBOOK_CATALOG_ID
    const stats = await getMarketplaceStats()

    return NextResponse.json({ ...stats, catalogConfigured })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Marketplace GET] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/v1/social/marketplace — post single listing
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { listingId } = await req.json() as { listingId: string }

  if (!listingId) {
    return NextResponse.json({ error: 'listingId inahitajika' }, { status: 400 })
  }

  const { data: listing, error } = await supabaseAdmin
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error || !listing) {
    return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })
  }

  const result = await postListingToMarketplace(listing)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    itemId: result.itemId,
    message: 'Listing imechapishwa kwenye Facebook Marketplace!',
  })
}

// PUT /api/v1/social/marketplace — repost (reset + re-post) a single listing
export async function PUT(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { listingId } = await req.json() as { listingId: string }
  if (!listingId) return NextResponse.json({ error: 'listingId inahitajika' }, { status: 400 })

  const result = await repostListingToMarketplace(listingId)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    itemId: result.itemId,
    message: 'Listing imerepostiwa kwenye Facebook Marketplace!',
  })
}
