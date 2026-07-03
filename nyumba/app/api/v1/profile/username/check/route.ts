import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 10

// GET /api/v1/profile/username/check?u=<username>
// Public — no auth required (availability check is safe to expose)
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u')?.toLowerCase().trim() ?? ''

  if (u.length < 3) {
    return NextResponse.json({ available: false, reason: 'too_short' })
  }
  if (!/^[a-z0-9_]{3,30}$/.test(u)) {
    return NextResponse.json({ available: false, reason: 'invalid_format' })
  }

  const admin = createAdminClient()

  const [reservedRes, takenRes] = await Promise.all([
    admin.from('reserved_usernames').select('username').eq('username', u).maybeSingle(),
    admin.from('users').select('id').eq('username', u).maybeSingle(),
  ])

  if (reservedRes.data) return NextResponse.json({ available: false, reason: 'reserved' })
  if (takenRes.data)    return NextResponse.json({ available: false, reason: 'taken' })

  return NextResponse.json({ available: true, username: u })
}
