import { NextResponse } from 'next/server'
import { syncAllListingsToMarketplace, validateMarketplaceToken } from '@/lib/social/facebookMarketplace'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 300

// POST /api/v1/social/marketplace/sync — bulk sync all unposted listings
export async function POST() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Validate token before starting the sync — gives a clear error if expired
  const tokenCheck = await validateMarketplaceToken()
  if (!tokenCheck.valid) {
    return NextResponse.json({ error: tokenCheck.error }, { status: 401 })
  }

  const result = await syncAllListingsToMarketplace()
  return NextResponse.json({ ...result, message: 'Sync imekamilika' })
}
