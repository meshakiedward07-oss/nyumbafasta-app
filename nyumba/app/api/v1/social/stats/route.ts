import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUnifiedStats } from '@/lib/social/unifiedPost'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') ?? 'month') as 'today' | 'week' | 'month' | 'all'

    const stats = await getUnifiedStats(period)
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[GET /social/stats]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
