import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const admin = createAdminClient()

    const [userRes, listingRes] = await Promise.all([
      admin
        .from('users')
        .select('created_at, listing_deadline_days, role')
        .eq('id', user.id)
        .single(),
      admin
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', user.id),
    ])

    // If listing_deadline_days column doesn't exist yet (migration pending), fall back
    // to querying only the columns that always exist
    let userData = userRes.data
    if (userRes.error || !userData) {
      const { data: fallback } = await admin
        .from('users')
        .select('created_at, role')
        .eq('id', user.id)
        .single()
      if (fallback?.role !== 'dalali') {
        return NextResponse.json({ error: 'Si dalali' }, { status: 403 })
      }
      userData = { ...fallback, listing_deadline_days: null }
    }

    if (userData.role !== 'dalali') {
      return NextResponse.json({ error: 'Si dalali' }, { status: 403 })
    }

    const listingCount  = listingRes.count ?? 0
    const createdAt     = new Date(userData.created_at)
    const deadlineDays  = (userData.listing_deadline_days as number | null) ?? 90
    const daysSince     = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000)
    const daysRemaining = Math.max(0, deadlineDays - daysSince)

    return NextResponse.json({
      hasListings:    listingCount > 0,
      listingCount,
      daysRemaining,
      daysSince,
      deadlineDays,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
