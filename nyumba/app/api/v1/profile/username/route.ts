import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 15

// GET — return the current dalali's username
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data } = await supabase
    .from('users')
    .select('username, role')
    .eq('id', user.id)
    .single()

  if (!data || data.role !== 'dalali') {
    return NextResponse.json({ error: 'Dalali tu anaweza kupata profile URL' }, { status: 403 })
  }

  return NextResponse.json({ username: data.username ?? null })
}

// POST — claim or update username
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const body = await req.json() as { username?: string }
  const clean = (body.username ?? '').toLowerCase().trim()

  if (!clean || !/^[a-z0-9_]{3,30}$/.test(clean)) {
    return NextResponse.json({ error: 'Username si sahihi — tumia herufi ndogo, nambari, underscore (min 3, max 30)' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify caller is a verified dalali
  const { data: me } = await admin
    .from('users')
    .select('role, username, username_changed_at')
    .eq('id', user.id)
    .single()

  if (!me || me.role !== 'dalali') {
    return NextResponse.json({ error: 'Dalali tu anaweza kupata profile URL' }, { status: 403 })
  }

  // Check dalali is premium-verified
  const { data: profile } = await admin
    .from('dalali_profiles')
    .select('is_premium_verified')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.is_premium_verified) {
    return NextResponse.json({ error: 'Profile URL inapatikana kwa dalali walioidhibitiwa tu' }, { status: 403 })
  }

  // Enforce 30-day cooldown on username changes
  if (me.username && me.username !== clean && me.username_changed_at) {
    const daysSince = (Date.now() - new Date(me.username_changed_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince < 30) {
      const remaining = Math.ceil(30 - daysSince)
      return NextResponse.json({
        error: `Unaweza kubadilisha username baada ya siku ${remaining} zaidi`,
      }, { status: 400 })
    }
  }

  // Check reserved
  const { data: reserved } = await admin
    .from('reserved_usernames')
    .select('username')
    .eq('username', clean)
    .maybeSingle()

  if (reserved) {
    return NextResponse.json({ error: 'Username hii imehifadhiwa — chagua nyingine' }, { status: 400 })
  }

  // Check taken by someone else
  const { data: taken } = await admin
    .from('users')
    .select('id')
    .eq('username', clean)
    .neq('id', user.id)
    .maybeSingle()

  if (taken) {
    return NextResponse.json({ error: 'Username imechukuliwa — jaribu jina lingine' }, { status: 400 })
  }

  // Save
  const { error } = await admin
    .from('users')
    .update({ username: clean, username_changed_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Username imechukuliwa — jaribu jina lingine' }, { status: 400 })
    }
    console.error('[Profile/username POST]', error.message)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  return NextResponse.json({
    success: true,
    username: clean,
    profileUrl: `${APP_URL}/agent/${clean}`,
  })
}
