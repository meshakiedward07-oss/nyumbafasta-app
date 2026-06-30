import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConnectedPlatforms } from '@/lib/social/platformConnections'

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  tiktok:    'TikTok',
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const connected = await getConnectedPlatforms()

    const allPlatforms = (['instagram', 'facebook', 'tiktok'] as const).map(p => ({
      platform:     p,
      label:        PLATFORM_LABELS[p],
      is_connected: connected.includes(p),
    }))

    return NextResponse.json({ platforms: allPlatforms, connectedCount: connected.length })
  } catch (err) {
    console.error('[GET /social/connections]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
