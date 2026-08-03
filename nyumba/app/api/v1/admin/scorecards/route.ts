import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateScorecards } from '@/lib/scorecards/scorer'
import { cached, TTL } from '@/lib/cache/memoryCache'

const CACHE_KEY = 'admin:scorecards'

// GET /api/v1/admin/scorecards[?force=1]
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const force = new URL(req.url).searchParams.get('force') === '1'

  try {
    const report = force
      ? await generateScorecards()
      : await cached(CACHE_KEY, TTL.STATS, generateScorecards)

    return NextResponse.json({ report })
  } catch (err) {
    console.error('[scorecards GET]', err)
    return NextResponse.json({ error: 'Imeshindwa kupata taarifa' }, { status: 500 })
  }
}
