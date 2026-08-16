import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — list all influencers with referral + payout stats
export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  // Fetch all influencer profiles with user info
  const { data: profiles, error } = await admin
    .from('influencer_profiles')
    .select('id, user_id, referral_code, is_active, social_handle, platform, created_at, user:user_id(full_name, staff_title)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const influencerIds = (profiles ?? []).map(p => p.id)
  const userIds       = (profiles ?? []).map(p => p.user_id)

  if (influencerIds.length === 0) {
    return NextResponse.json({ influencers: [] })
  }

  // Fetch referral counts + payout totals in parallel
  const [referralsRes, payoutsRes, emailsRes] = await Promise.all([
    admin.from('referral_attributions')
      .select('influencer_id')
      .in('influencer_id', influencerIds),

    admin.from('influencer_payout_stages')
      .select('influencer_id, amount_tzs, status')
      .in('influencer_id', influencerIds),

    Promise.allSettled(
      userIds.map(id => admin.auth.admin.getUserById(id).then(r => ({ id, email: r.data?.user?.email ?? null })))
    ),
  ])

  // Build aggregation maps
  const referralCountMap: Record<string, number> = {}
  for (const r of referralsRes.data ?? []) {
    referralCountMap[r.influencer_id] = (referralCountMap[r.influencer_id] ?? 0) + 1
  }

  type PayoutAgg = { totalEarned: number; totalPaid: number; totalHold: number; balance: number }
  const payoutMap: Record<string, PayoutAgg> = {}
  for (const p of payoutsRes.data ?? []) {
    if (!payoutMap[p.influencer_id]) payoutMap[p.influencer_id] = { totalEarned: 0, totalPaid: 0, totalHold: 0, balance: 0 }
    const earned = p.status === 'earned' || p.status === 'paid'
    if (earned) payoutMap[p.influencer_id].totalEarned += p.amount_tzs
    if (p.status === 'paid')  payoutMap[p.influencer_id].totalPaid  += p.amount_tzs
    if (p.status === 'hold')  payoutMap[p.influencer_id].totalHold  += p.amount_tzs
    payoutMap[p.influencer_id].balance = payoutMap[p.influencer_id].totalEarned - payoutMap[p.influencer_id].totalPaid
  }

  const emailMap = new Map<string, string | null>()
  for (const r of emailsRes) {
    if (r.status === 'fulfilled') emailMap.set(r.value.id, r.value.email)
  }

  const influencers = (profiles ?? []).map(p => ({
    id:           p.id,
    userId:       p.user_id,
    // @ts-expect-error supabase join typing
    fullName:     (p.user as { full_name: string } | null)?.full_name ?? null,
    // @ts-expect-error supabase join typing
    staffTitle:   (p.user as { staff_title: string | null } | null)?.staff_title ?? null,
    email:        emailMap.get(p.user_id) ?? null,
    referralCode: p.referral_code,
    isActive:     p.is_active,
    socialHandle: p.social_handle,
    platform:     p.platform,
    createdAt:    p.created_at,
    referrals:    referralCountMap[p.id] ?? 0,
    ...(payoutMap[p.id] ?? { totalEarned: 0, totalPaid: 0, totalHold: 0, balance: 0 }),
  }))

  return NextResponse.json({ influencers })
}

// PATCH — confirm a payout stage as paid, or toggle influencer active status
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  let body: { action: string; stageId?: string; influencerId?: string; adminNote?: string; isActive?: boolean }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // ── Mark payout stage as paid ─────────────────────────────────────────────
  if (body.action === 'mark_paid') {
    if (!body.stageId) return NextResponse.json({ error: 'stageId inahitajika' }, { status: 400 })

    const { data, error } = await admin
      .from('influencer_payout_stages')
      .update({
        status:     'paid',
        paid_at:    new Date().toISOString(),
        admin_note: body.adminNote ?? null,
      })
      .eq('id', body.stageId)
      .eq('status', 'earned')   // can only pay out earned stages (not hold/already paid)
      .select('id, influencer_id, referred_user_id, stage, amount_tzs')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Stage haipatikani au haiko katika hali ya earned' }, { status: 404 })

    return NextResponse.json({ ok: true, stage: data })
  }

  // ── Toggle influencer active / inactive ───────────────────────────────────
  if (body.action === 'toggle_active') {
    if (!body.influencerId || body.isActive === undefined) {
      return NextResponse.json({ error: 'influencerId na isActive vinahitajika' }, { status: 400 })
    }

    const { error } = await admin
      .from('influencer_profiles')
      .update({ is_active: body.isActive })
      .eq('id', body.influencerId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Action si sahihi' }, { status: 400 })
}
