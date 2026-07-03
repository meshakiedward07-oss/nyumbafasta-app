import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { postListingToAllPlatforms, getConnectedPlatforms } from '@/lib/social/unifiedPost'
import type { UnifiedPlatform } from '@/lib/social/unifiedPost'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json() as { listingId: string; platforms?: UnifiedPlatform[] }
    const { listingId, platforms } = body
    if (!listingId) return NextResponse.json({ error: 'listingId inahitajika' }, { status: 400 })

    const targetPlatforms: UnifiedPlatform[] = platforms ?? await getConnectedPlatforms()
    if (targetPlatforms.length === 0) {
      return NextResponse.json({ error: 'Hakuna platform iliyounganishwa' }, { status: 400 })
    }

    const result = await postListingToAllPlatforms({ listingId, platforms: targetPlatforms, createdBy: admin.id })

    return NextResponse.json({
      success:      result.successCount > 0,
      results:      result.results,
      successCount: result.successCount,
      failedCount:  result.failedCount,
    })
  } catch (err) {
    console.error('[POST /social/post-all]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
