import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Credits a dalali-to-dalali referral (the `referrals` table + UI at
 * app/(dalali)/dashboard/referral/page.tsx — distinct from the influencer
 * program in lib/influencer/payoutTriggers.ts) the first time the REFERRED
 * dalali's subscription is confirmed as a real, paid activation — not the
 * free trial, not an admin grant. Extends BOTH dalali's current
 * subscriptions by `reward_days` (7 by default) and notifies both, per
 * the referral page's own copy: "Anapolipa subscription yake ya kwanza —
 * ninyi wote mnapata siku 7 za ziada" ("you BOTH get 7 extra days").
 *
 * Found 2026-09-02: the referrals table, RLS, and full UI (link, share
 * buttons, history list) were built (migration referral_2026_07_31.sql),
 * but nothing anywhere ever transitioned a referral from 'pending' to
 * 'credited' or actually granted the promised reward — every referral
 * stayed "Pending" forever and no dalali ever received their days. This
 * is the missing piece, called from the subscription payment webhook
 * (app/api/v1/payments/subscription/webhook/route.ts) — the only place a
 * REAL paid activation (as opposed to a trial or admin grant) is
 * confirmed.
 */
export async function creditReferralIfAny(
  referredDalaliId: string,
  admin: SupabaseClient,
): Promise<void> {
  const { data: referral } = await admin
    .from('referrals')
    .select('id, referrer_id, reward_days')
    .eq('referred_id', referredDalaliId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!referral) return

  // Atomic guard — .eq('status','pending') means only the first caller to
  // reach this (the first real payment; renewals find nothing, since
  // status is already 'credited' by then) ever credits it, even under
  // concurrent webhook retries.
  const { data: updated } = await admin
    .from('referrals')
    .update({ status: 'credited', credited_at: new Date().toISOString() })
    .eq('id', referral.id)
    .eq('status', 'pending')
    .select('id')

  if (!updated || updated.length === 0) return // already credited by a concurrent call

  const rewardDays = referral.reward_days ?? 7

  await Promise.all([
    extendSubscription(admin, referral.referrer_id, rewardDays),
    extendSubscription(admin, referredDalaliId, rewardDays),
  ])

  await admin.from('notifications').insert([
    {
      user_id: referral.referrer_id,
      title:   '🎉 Umepata Siku za Ziada za Rufaa!',
      body:    `Rafiki uliyemwalika amelipa subscription yake ya kwanza! Umepata siku ${rewardDays} za ziada kwenye kifurushi chako.`,
      type:    'subscription_active',
      is_read: false,
    },
    {
      user_id: referredDalaliId,
      title:   '🎉 Umepata Siku za Ziada za Rufaa!',
      body:    `Kwa kuwa ulijiunga kupitia rufaa ya rafiki yako, umepata siku ${rewardDays} za ziada kwenye kifurushi chako.`,
      type:    'subscription_active',
      is_read: false,
    },
  ])
}

// Extends a dalali's current active/grace_period subscription by
// `days` — same "current subscription" lookup used everywhere else in
// the app (subscriptions/can-post/route.ts, admin extend, etc.). If the
// dalali has no active subscription at all (rare — e.g. they let their
// plan lapse between referring and now), there's nothing to extend; the
// 'credited' record still stands as proof they earned it.
async function extendSubscription(admin: SupabaseClient, dalaliId: string, days: number): Promise<void> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, expires_at')
    .eq('dalali_id', dalaliId)
    .in('status', ['active', 'grace_period'])
    .order('expires_at', { ascending: false })
    .maybeSingle()

  if (!sub) return

  const now  = new Date()
  const base = sub.expires_at && new Date(sub.expires_at) > now ? new Date(sub.expires_at) : now
  const newExpiry = new Date(base)
  newExpiry.setDate(newExpiry.getDate() + days)

  await admin
    .from('subscriptions')
    .update({ expires_at: newExpiry.toISOString(), status: 'active' })
    .eq('id', sub.id)
}
