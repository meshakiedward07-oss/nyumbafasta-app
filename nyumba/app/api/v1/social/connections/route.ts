import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { getConnectedPlatforms } from '@/lib/social/platformConnections'

export const maxDuration = 15

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  tiktok:    'TikTok',
}

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
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
