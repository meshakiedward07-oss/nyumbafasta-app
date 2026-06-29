import { NextRequest, NextResponse } from 'next/server'
import { postListingStoryAllPlatforms, postPromoStory, getRecentStories } from '@/lib/social/instagramStories'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { Listing } from '@/lib/types/database'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 60

// GET /api/v1/social/stories — list recent stories
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const stories = await getRecentStories(30)
    return NextResponse.json({ stories })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/v1/social/stories
// Body: { storyType: 'listing'|'promotion', listingId?, imageUrl?, linkUrl? }
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { storyType = 'listing', listingId, imageUrl, linkUrl } = await req.json() as {
    storyType?: 'listing' | 'promotion'
    listingId?: string
    imageUrl?:  string
    linkUrl?:   string
  }

  try {
    if (storyType === 'listing') {
      if (!listingId) {
        return NextResponse.json({ error: 'listingId inahitajika kwa listing story' }, { status: 400 })
      }

      const { data: listing, error } = await supabaseAdmin
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single()

      if (error || !listing) {
        return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })
      }

      const result = await postListingStoryAllPlatforms(listing as Listing)
      return NextResponse.json({
        ok:           result.successCount > 0,
        successCount: result.successCount,
        failedCount:  result.failedCount,
        results:      result.results,
      })
    }

    // Promotional story
    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl inahitajika kwa promo story' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
    const result = await postPromoStory({ imageUrl, linkUrl: linkUrl ?? appUrl })
    const expiresAt = result.success
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null

    return NextResponse.json({ ok: result.success, ...result, expiresAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    console.error('[Stories API]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
