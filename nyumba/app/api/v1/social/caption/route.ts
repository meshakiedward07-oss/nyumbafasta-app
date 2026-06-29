import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { generateCaption } from '@/lib/social/captionGenerator'
import type { Listing } from '@/lib/types/database'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 30

// POST /api/v1/social/caption
// Body: { listingId, platform? }
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { listingId, platform = 'instagram' } = await req.json() as {
    listingId: string
    platform?: 'instagram' | 'facebook'
  }

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

  try {
    const { caption, hashtags } = await generateCaption(listing as Listing, platform)
    return NextResponse.json({ ok: true, caption, hashtags })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
