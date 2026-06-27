import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { postVideoToTikTok, generateTikTokCaption } from '@/lib/social/tiktok'
import type { Listing } from '@/lib/types/database'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin tu' }, { status: 403 })

  const body = await req.json() as {
    listingId?: string
    videoUrl: string
    caption?: string
    privacyLevel?: string
    disableComment?: boolean
    disableDuet?: boolean
    disableStitch?: boolean
  }

  const { listingId, videoUrl, privacyLevel, disableComment, disableDuet, disableStitch } = body

  if (!videoUrl) return NextResponse.json({ error: 'videoUrl inahitajika' }, { status: 400 })

  let caption = body.caption ?? ''

  if (!caption && listingId) {
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single()
    if (listing) caption = await generateTikTokCaption(listing as Listing)
  }

  if (!caption) caption = '🏠 Nyumba inapatikana Tanzania! nyumbafasta.co #NyumbaFasta'

  const result = await postVideoToTikTok({
    videoUrl,
    caption,
    listingId,
    privacyLevel,
    disableComment,
    disableDuet,
    disableStitch,
  })

  return NextResponse.json(result)
}
