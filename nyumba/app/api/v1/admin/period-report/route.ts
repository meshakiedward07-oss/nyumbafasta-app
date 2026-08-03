import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateReview, type ReviewPeriod } from '@/lib/reviews/generator'
import { cached, TTL } from '@/lib/cache/memoryCache'

// GET /api/v1/admin/period-report?period=weekly|monthly&date=YYYY-MM-DD[&force=1]
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const periodParam = searchParams.get('period') ?? 'weekly'
  const dateParam   = searchParams.get('date')   ?? new Date().toISOString().split('T')[0]
  const force       = searchParams.get('force')  === '1'

  if (!['weekly', 'monthly'].includes(periodParam)) {
    return NextResponse.json({ error: 'period must be weekly or monthly' }, { status: 400 })
  }

  const period        = periodParam as ReviewPeriod
  const referenceDate = new Date(dateParam)
  if (isNaN(referenceDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  // Cache per period+date — 5 min; force=1 bypasses cache (for "Unda Upya" button)
  const cacheKey = `period-report:${period}:${dateParam}`
  try {
    const report = force
      ? await generateReview(period, referenceDate)
      : await cached(cacheKey, TTL.STATS, () => generateReview(period, referenceDate))

    return NextResponse.json({ report })
  } catch (err) {
    console.error('[period-report GET]', err)
    return NextResponse.json({ error: 'Imeshindwa kutengeneza ripoti' }, { status: 500 })
  }
}
