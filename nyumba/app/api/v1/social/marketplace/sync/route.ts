import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncAllListingsToMarketplace } from '@/lib/social/facebookMarketplace'

export const maxDuration = 300

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// POST /api/v1/social/marketplace/sync — bulk sync all unposted listings
export async function POST() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.FACEBOOK_CATALOG_ID) {
    return NextResponse.json({
      error: 'FACEBOOK_CATALOG_ID haijawekwa — Weka kwenye Vercel environment variables',
    }, { status: 400 })
  }

  const result = await syncAllListingsToMarketplace()
  return NextResponse.json({ ...result, message: 'Sync imekamilika' })
}
