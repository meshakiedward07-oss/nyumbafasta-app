import { NextRequest, NextResponse } from 'next/server'
import { postListingToSocialMedia, schedulePost } from '@/lib/social/autoPost'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 60

// POST /api/v1/social/post
// Body: { listingId, platform, scheduledAt? }
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { listingId, platform = 'both', scheduledAt } = await req.json() as {
    listingId:   string
    platform?:   'instagram' | 'facebook' | 'both'
    scheduledAt?: string
  }

  if (!listingId) {
    return NextResponse.json({ error: 'listingId inahitajika' }, { status: 400 })
  }

  try {
    if (scheduledAt) {
      const scheduleId = await schedulePost(
        listingId,
        platform,
        new Date(scheduledAt),
        admin.id,
      )
      return NextResponse.json({ ok: true, scheduled: true, scheduleId })
    }

    const result = await postListingToSocialMedia(listingId, platform, admin.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    console.error('[Social/post]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
