import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function generateCode(userId: string): string {
  // Deterministic 6-char uppercase alphanumeric code from userId
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff
    hash = hash >>> 0
  }
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[hash % chars.length]
    hash = Math.floor(hash / chars.length) + userId.charCodeAt(i % userId.length)
    hash = hash >>> 0
  }
  return code
}

// GET — return my referral code + stats
export async function GET(): Promise<Response> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()

  // Ensure user has a referral_code; generate if missing
  let { data: profile } = await admin
    .from('users')
    .select('referral_code, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.referral_code) {
    const code = generateCode(user.id)
    await admin.from('users').update({ referral_code: code }).eq('id', user.id)
    profile = { referral_code: code, full_name: profile?.full_name ?? '' }
  }

  // Referral stats
  const { data: referrals } = await admin
    .from('referrals')
    .select('id, status, reward_days, credited_at, created_at, referred:referred_id(full_name, created_at)')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false })

  const list = referrals ?? []
  const total_referred = list.length
  const credited       = list.filter(r => r.status === 'credited').length
  const pending        = list.filter(r => r.status === 'pending').length
  const total_days     = list.filter(r => r.status === 'credited').reduce((s, r) => s + (r.reward_days ?? 7), 0)

  const referral_code = profile?.referral_code ?? ''
  // role=dalali — this is a dalali-to-dalali referral program (see the
  // "Jiunge na NyumbaFasta — jukwaa bora la madalali" share text in
  // app/(dalali)/dashboard/referral/page.tsx). Without it the link
  // defaulted to role=client (register/page.tsx's fallback), so a
  // referred dalali had to manually re-select "Dalali" on step 1.
  // Found 2026-09-02.
  const referral_link = `${APP_URL}/register?role=dalali&ref=${referral_code}`

  return Response.json({
    referral_code,
    referral_link,
    stats: { total_referred, credited, pending, total_days },
    referrals: list,
  })
}

// POST — apply a referral code to the current user (called after sign-up)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const code = (body.referral_code ?? '').trim().toUpperCase()
  if (!code) return Response.json({ error: 'Nambari ya rufaa inahitajika' }, { status: 400 })

  const admin = getAdmin()

  // Check current user is not already referred
  const { data: existing } = await admin
    .from('referrals')
    .select('id')
    .eq('referred_id', user.id)
    .maybeSingle()
  if (existing) return Response.json({ error: 'Umeshawahi tumia rufaa' }, { status: 409 })

  // Find referrer by code
  const { data: referrer } = await admin
    .from('users')
    .select('id')
    .eq('referral_code', code)
    .neq('id', user.id)
    .maybeSingle()
  if (!referrer) return Response.json({ error: 'Nambari ya rufaa haipo' }, { status: 404 })

  // Create referral record (starts as pending; credited when referred pays first sub)
  const { error: insertErr } = await admin.from('referrals').insert({
    referrer_id: referrer.id,
    referred_id: user.id,
    status:      'pending',
    reward_days: 7,
  })
  if (insertErr) {
    if (insertErr.code === '23505') return Response.json({ error: 'Umeshawahi tumia rufaa' }, { status: 409 })
    return Response.json({ error: insertErr.message }, { status: 500 })
  }

  return Response.json({ success: true, message: 'Rufaa imesajiliwa! Utapata siku 7 za ziada baada ya rafiki wako kulipa.' })
}
