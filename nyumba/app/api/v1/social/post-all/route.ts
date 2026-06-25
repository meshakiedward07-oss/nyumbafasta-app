import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { postListingToAllPlatforms, getConnectedPlatforms } from '@/lib/social/unifiedPost'
import type { UnifiedPlatform } from '@/lib/social/unifiedPost'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })
    }

    const body = await req.json() as { listingId: string; platforms?: UnifiedPlatform[] }
    const { listingId, platforms } = body
    if (!listingId) return NextResponse.json({ error: 'listingId inahitajika' }, { status: 400 })

    const targetPlatforms: UnifiedPlatform[] = platforms ?? await getConnectedPlatforms()
    if (targetPlatforms.length === 0) {
      return NextResponse.json({ error: 'Hakuna platform iliyounganishwa' }, { status: 400 })
    }

    const result = await postListingToAllPlatforms({ listingId, platforms: targetPlatforms, createdBy: user.id })

    return NextResponse.json({
      success: result.successCount > 0,
      results: result.results,
      successCount: result.successCount,
      failedCount: result.failedCount,
    })
  } catch (err) {
    console.error('[POST /social/post-all]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
