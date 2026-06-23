import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
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

  if (userRes.data?.role !== 'dalali') {
    return NextResponse.json({ error: 'Si dalali' }, { status: 403 })
  }

  const listingCount  = listingRes.count ?? 0
  const createdAt     = new Date(userRes.data.created_at)
  const deadlineDays  = (userRes.data.listing_deadline_days as number | null) ?? 90
  const daysSince     = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000)
  const daysRemaining = Math.max(0, deadlineDays - daysSince)

  return NextResponse.json({
    hasListings:    listingCount > 0,
    listingCount,
    daysRemaining,
    daysSince,
    deadlineDays,
  })
}
