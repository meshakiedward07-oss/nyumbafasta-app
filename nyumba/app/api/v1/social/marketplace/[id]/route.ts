import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'
import {
  updateMarketplaceItem,
  markMarketplaceItemTaken,
  deleteMarketplaceItem,
} from '@/lib/social/facebookMarketplace'

// PATCH /api/v1/social/marketplace/[id] — update marketplace item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const admin = await requireAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as { availability?: 'IN_STOCK' | 'OUT_OF_STOCK' }

    const { data: ml } = await supabaseAdmin
      .from('marketplace_listings')
      .select('retailer_id')
      .eq('listing_id', id)
      .eq('status', 'active')
      .maybeSingle()

    if (!ml?.retailer_id) {
      return NextResponse.json({ error: 'Marketplace listing haipatikani' }, { status: 404 })
    }

    let result
    if (body.availability === 'OUT_OF_STOCK') {
      result = await markMarketplaceItemTaken(ml.retailer_id)
      if (result.success) {
        await supabaseAdmin
          .from('marketplace_listings')
          .update({ availability: 'OUT_OF_STOCK', status: 'sold', updated_at: new Date().toISOString() })
          .eq('listing_id', id)
      }
    } else if (body.availability === 'IN_STOCK') {
      result = await updateMarketplaceItem(ml.retailer_id, { availability: 'IN_STOCK' })
      if (result.success) {
        await supabaseAdmin
          .from('marketplace_listings')
          .update({ availability: 'IN_STOCK', status: 'active', updated_at: new Date().toISOString() })
          .eq('listing_id', id)
      }
    } else {
      return NextResponse.json({ error: 'availability lazima iwe IN_STOCK au OUT_OF_STOCK' }, { status: 400 })
    }

    return NextResponse.json({ ok: result.success, error: result.error })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH app/api/v1/social/marketplace/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/social/marketplace/[id] — remove from marketplace
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const admin = await requireAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: ml } = await supabaseAdmin
      .from('marketplace_listings')
      .select('retailer_id')
      .eq('listing_id', id)
      .maybeSingle()

    if (!ml?.retailer_id) {
      return NextResponse.json({ error: 'Marketplace listing haipatikani' }, { status: 404 })
    }

    const result = await deleteMarketplaceItem(ml.retailer_id)

    if (result.success) {
      await supabaseAdmin
        .from('marketplace_listings')
        .update({ status: 'deleted', availability: 'OUT_OF_STOCK', updated_at: new Date().toISOString() })
        .eq('listing_id', id)
      await supabaseAdmin
        .from('listings')
        .update({ marketplace_posted: false, marketplace_item_id: null })
        .eq('id', id)
    }

    return NextResponse.json({ ok: result.success, error: result.error })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE app/api/v1/social/marketplace/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
