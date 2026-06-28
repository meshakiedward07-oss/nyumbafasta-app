import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/social/listings
// Returns all active listings joined with their most recent social post per platform.
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch active listings
  const { data: listings, error } = await supabaseAdmin
    .from('listings')
    .select('id, title, type, district, region, price_monthly, images, video_url, bedrooms, furnished, is_boosted, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!listings?.length) return NextResponse.json({ listings: [] })

  // Fetch latest social post per listing+platform in one query
  const listingIds = listings.map(l => l.id)
  const { data: posts } = await supabaseAdmin
    .from('social_posts')
    .select('listing_id, platform, status, created_at')
    .in('listing_id', listingIds)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // Build a map: listingId → { instagram: latestDate, facebook: latestDate, tiktok: latestDate }
  type PlatformKey = 'instagram' | 'facebook' | 'tiktok'
  const postMap: Record<string, Record<PlatformKey, string | null>> = {}

  for (const post of (posts ?? [])) {
    const lid = post.listing_id as string
    const p   = post.platform as string

    if (!postMap[lid]) postMap[lid] = { instagram: null, facebook: null, tiktok: null }

    const key = p === 'both' ? null : (p as PlatformKey)
    if (key && !postMap[lid][key]) {
      postMap[lid][key] = post.created_at as string
    }
    // 'both' counts as instagram + facebook
    if (p === 'both') {
      if (!postMap[lid].instagram) postMap[lid].instagram = post.created_at as string
      if (!postMap[lid].facebook)  postMap[lid].facebook  = post.created_at as string
    }
  }

  const result = listings.map(l => ({
    ...l,
    social: postMap[l.id] ?? { instagram: null, facebook: null, tiktok: null },
  }))

  return NextResponse.json({ listings: result })
}
