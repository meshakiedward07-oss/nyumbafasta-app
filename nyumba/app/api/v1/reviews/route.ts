import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/reviews?listing_id=xxx  — fetch reviews for a listing (via dalali_id)
export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get('listing_id')
  if (!listingId) {
    return NextResponse.json({ error: 'listing_id inahitajika' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get dalali_id from listing
  const { data: listing } = await supabase
    .from('listings')
    .select('dalali_id')
    .eq('id', listingId)
    .single()

  if (!listing) {
    return NextResponse.json({ reviews: [] })
  }

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select(`
      id, rating, comment, created_at,
      reviewer:reviewer_id ( full_name )
    `)
    .eq('dalali_id', listing.dalali_id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reviews: reviews ?? [] })
}

// POST /api/v1/reviews — submit a review after successful unlock
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const body = await req.json()
    const { unlock_id, rating, comment, found_house } = body

    if (!unlock_id || !rating) {
      return NextResponse.json({ error: 'unlock_id na rating vinahitajika' }, { status: 400 })
    }
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json({ error: 'Rating lazima iwe 1-5' }, { status: 400 })
    }
    if (comment != null && (typeof comment !== 'string' || comment.length > 500)) {
      return NextResponse.json({ error: 'Maoni ni marefu sana (max 500)' }, { status: 400 })
    }

    // Verify the unlock belongs to this user and is completed
    const { data: unlock } = await supabase
      .from('contact_unlocks')
      .select('id, dalali_id, status')
      .eq('id', unlock_id)
      .eq('client_id', user.id)
      .eq('status', 'completed')
      .single()

    if (!unlock) {
      return NextResponse.json({ error: 'Unlock haipatikani au haijafanikiwa' }, { status: 403 })
    }

    // Check no existing review for this unlock
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('unlock_id', unlock_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Umeshatoa maoni kwa unlock hii' }, { status: 409 })
    }

    // Insert the review
    const { data: review, error: insertError } = await supabase
      .from('reviews')
      .insert({
        unlock_id,
        reviewer_id: user.id,
        dalali_id: unlock.dalali_id,
        rating,
        comment: comment?.trim() || null,
        found_house: typeof found_house === 'boolean' ? found_house : null,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Recalculate rating_avg and rating_count for the dalali
    const admin = createAdminClient()
    const { data: allReviews } = await admin
      .from('reviews')
      .select('rating')
      .eq('dalali_id', unlock.dalali_id)

    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      await admin
        .from('dalali_profiles')
        .update({
          rating_avg: Math.round(avg * 10) / 10,
          rating_count: allReviews.length,
        })
        .eq('user_id', unlock.dalali_id)
    }

    // Remove scheduled review reminders — review imekwisha tolewa
    await admin
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .in('type', ['review_request', 'review_reminder'])
      .eq('data->>unlock_id', unlock_id)

    // Fetch reviewer name for notification
    const { data: reviewer } = await admin
      .from('users').select('full_name').eq('id', user.id).single()
    const stars = '⭐'.repeat(rating)

    // Notify dalali
    await admin.from('notifications').insert({
      user_id: unlock.dalali_id,
      title: `${stars} Maoni Mapya!`,
      body: `${reviewer?.full_name ?? 'Mteja'} ameandika review — angalia na ujibu.`,
      type: 'new_review',
      is_read: false,
      data: { review_id: review.id },
    })

    return NextResponse.json({ review: { id: review.id } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
