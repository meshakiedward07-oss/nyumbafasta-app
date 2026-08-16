import type { SupabaseClient } from '@supabase/supabase-js'

const REFERRAL_WINDOW_DAYS  = 100
const LISTING_STAGE_AMOUNT  = 300
const SUB_STAGE_1_AMOUNT    = 700
const SUB_STAGE_2_AMOUNT    = 1000
const LISTING_HOLD_DAYS     = 7
const LISTINGS_REQUIRED     = 3

// Returns null if dalali is not referred or signup is outside the 100-day window.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveAttribution(dalaliId: string, admin: SupabaseClient<any>) {
  const { data } = await admin
    .from('referral_attributions')
    .select('influencer_id, signed_up_at')
    .eq('referred_user_id', dalaliId)
    .maybeSingle()

  if (!data) return null

  const daysSinceSignup =
    (Date.now() - new Date(data.signed_up_at).getTime()) / 86_400_000

  if (daysSinceSignup > REFERRAL_WINDOW_DAYS) return null

  return { influencerId: data.influencer_id }
}

/**
 * Called after a listing is approved for a dalali.
 * If the dalali is referred and now has >= 3 approved listings, triggers Stage 1
 * with a 7-day fraud hold. Idempotent — the UNIQUE constraint prevents duplicates.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function triggerListingStage(dalaliId: string, admin: SupabaseClient<any>): Promise<void> {
  const attr = await resolveAttribution(dalaliId, admin)
  if (!attr) return

  // Count active/approved listings for this dalali
  const { count } = await admin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('dalali_id', dalaliId)
    .eq('status', 'active')

  if ((count ?? 0) < LISTINGS_REQUIRED) return

  const holdUntil = new Date(Date.now() + LISTING_HOLD_DAYS * 86_400_000).toISOString()

  // insert … on conflict do nothing (idempotent via UNIQUE constraint)
  await admin.from('influencer_payout_stages').upsert(
    {
      influencer_id:    attr.influencerId,
      referred_user_id: dalaliId,
      stage:            1,
      amount_tzs:       LISTING_STAGE_AMOUNT,
      status:           'hold',
      hold_until:       holdUntil,
    },
    { onConflict: 'influencer_id,referred_user_id,stage', ignoreDuplicates: true }
  )
}

/**
 * Called after a real paid subscription payment succeeds for a dalali.
 * Triggers Stage 2 on the first payment, Stage 3 on the second.
 * Trial subscriptions must NOT call this function.
 * Stages set status='earned' immediately (no hold for subscription stages).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function triggerSubscriptionStage(dalaliId: string, admin: SupabaseClient<any>): Promise<void> {
  const attr = await resolveAttribution(dalaliId, admin)
  if (!attr) return

  // Count how many subscription stages have already been earned for this referral
  const { count: existingCount } = await admin
    .from('influencer_payout_stages')
    .select('id', { count: 'exact', head: true })
    .eq('influencer_id', attr.influencerId)
    .eq('referred_user_id', dalaliId)
    .in('stage', [2, 3])

  const nextStage = (existingCount ?? 0) + 2   // 2 or 3
  if (nextStage > 3) return                      // both stages already earned

  const amount = nextStage === 2 ? SUB_STAGE_1_AMOUNT : SUB_STAGE_2_AMOUNT

  await admin.from('influencer_payout_stages').upsert(
    {
      influencer_id:    attr.influencerId,
      referred_user_id: dalaliId,
      stage:            nextStage,
      amount_tzs:       amount,
      status:           'earned',
      hold_until:       null,
    },
    { onConflict: 'influencer_id,referred_user_id,stage', ignoreDuplicates: true }
  )
}
