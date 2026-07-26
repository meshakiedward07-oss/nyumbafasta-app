import { createAdminClient } from '@/lib/supabase/server'
import type { PlanFeatures } from '@/lib/types/property'

// Statuses that still grant full plan access (don't penalise during grace/due)
const ACTIVE_STATUSES = new Set(['trial', 'active', 'past_due', 'grace_period'])

// Fallback used when org has no active subscription or plan is cancelled/expired
export const FREE_FEATURES: PlanFeatures = {
  max_properties:             2,
  max_units:                  5,
  max_members:                2,
  has_reports:                false,
  has_maintenance:            true,
  has_communication_hub:      true,
  has_vendor_directory:       false,
  has_staff_assisted_listing: false,
  has_priority_support:       false,
  trial_days:                 14,
}

/**
 * Fetches the effective feature set for an org.
 * - trial/active/past_due/grace_period → plan's features
 * - cancelled/expired or no subscription → FREE_FEATURES
 */
export async function getOrgFeatures(orgId: string): Promise<PlanFeatures> {
  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('organization_subscriptions')
    .select('status, plan:subscription_plans(features)')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!sub || !ACTIVE_STATUSES.has(sub.status)) return FREE_FEATURES

  const planFeatures = (sub.plan as unknown as { features: PlanFeatures } | null)?.features
  return planFeatures ?? FREE_FEATURES
}

/**
 * Checks a numeric limit. Returns { ok: true } or { ok: false, error, status }.
 * max === -1 means unlimited.
 */
export function checkLimit(
  current: number,
  max: number,
  resourceLabel: string,
): { ok: true } | { ok: false; error: string; status: number } {
  if (max === -1) return { ok: true }
  if (current >= max) {
    return {
      ok: false,
      error: `Umefika kikomo cha ${resourceLabel} (${max}) kwenye mpango wako. Panda mpango ili kuongeza zaidi.`,
      status: 403,
    }
  }
  return { ok: true }
}

/**
 * Checks a boolean feature flag. Returns { ok: true } or { ok: false, error, status }.
 */
export function checkFeature(
  features: PlanFeatures,
  key: keyof PlanFeatures,
  featureLabel: string,
): { ok: true } | { ok: false; error: string; status: number } {
  if (features[key]) return { ok: true }
  return {
    ok: false,
    error: `Kipengele cha "${featureLabel}" hakipo kwenye mpango wako. Panda mpango ili kupata ufikiaji.`,
    status: 403,
  }
}
