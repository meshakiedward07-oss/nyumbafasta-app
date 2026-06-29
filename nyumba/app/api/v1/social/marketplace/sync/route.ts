import { NextResponse } from 'next/server'
import { syncAllListingsToMarketplace } from '@/lib/social/facebookMarketplace'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 300

// POST /api/v1/social/marketplace/sync — bulk sync all unposted listings
export async function POST() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.FACEBOOK_CATALOG_ID) {
    return NextResponse.json({
      error: 'FACEBOOK_CATALOG_ID haijawekwa — Weka kwenye Vercel environment variables',
    }, { status: 400 })
  }

  const result = await syncAllListingsToMarketplace()
  return NextResponse.json({ ...result, message: 'Sync imekamilika' })
}
