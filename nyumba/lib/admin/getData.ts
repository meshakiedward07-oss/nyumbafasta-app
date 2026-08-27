import { createAdminClient } from '@/lib/supabase/server'
import type {
  AdminListing,
  AdminVerification,
} from '@/app/(admin)/admin/page'

export type AdminPageData = {
  pendingListings: AdminListing[]
  allListings: AdminListing[]
  pendingVerifications: AdminVerification[]
  verifiedDalalis: AdminVerification[]
  reports: unknown[]
  regionStats: [string, number][]
  stats: {
    pendingCount: number
    activeCount: number
    takenCount: number
    rejectedCount: number
    expiredCount: number
    totalListings: number
    totalUsers: number
    clientCount: number
    dalaliCount: number
    activeTrials: number
    expiredTrials: number
    convertedTrials: number
    totalTrials: number
  }
}

export async function getAdminData(): Promise<AdminPageData> {
  const admin = createAdminClient()

  const listingSelectCols = `
        id, title, type, status, price_monthly,
        district, region, furnished, amenities,
        images, description, bedrooms, created_at,
        dalali:dalali_id (
          id, full_name, phone,
          dalali_profiles ( whatsapp_number, is_premium_verified )
        )
      `

  const [
    allListingsRes,
    pendingListingsRes,
    totalListingsCountRes,
    activeListingsCountRes,
    pendingListingsCountRes,
    takenListingsCountRes,
    rejectedListingsCountRes,
    expiredListingsCountRes,
    clientCountRes,
    dalaliCountRes,
    totalUsersCountRes,
    verificationRes,
    verifiedDalalisRes,
    trialSubsRes,
    reportsRes,
  ] = await Promise.all([
    // Full listing rows across all statuses (for the "Zote/Zinapatikana/
    // Zimepangishwa/..." browse tabs + region stats) — capped at 300 most
    // recent. The exact per-status COUNTS below do NOT depend on this cap,
    // since pending/rejected/expired listings (often older, untouched since
    // submission) can otherwise silently fall outside the cap once the
    // platform accumulates more rows than the limit, making the admin
    // panel under-report — or show zero for — statuses that actually have
    // listings waiting. Exclude hard-deleted listings so they don't
    // reappear on refresh.
    admin
      .from('listings')
      .select(listingSelectCols)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(300),

    // Pending-approval queue: fetched on its own (oldest-first, so nothing
    // waits forever unreviewed), independent of the mixed-status cap above.
    admin
      .from('listings')
      .select(listingSelectCols)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(200),

    // Count queries — no rows transferred, pure metadata, always exact
    // regardless of how many listings exist.
    admin.from('listings').select('id', { count: 'exact', head: true }).neq('status', 'deleted'),
    admin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'taken'),
    admin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    admin.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'expired'),

    admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'client'),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'dalali'),
    admin.from('users').select('id', { count: 'exact', head: true }),

    admin
      .from('dalali_profiles')
      .select(`
        user_id, nida_number, nida_image_front, nida_image_back, selfie_image,
        business_license_url,
        verification_status, verification_submitted_at, verification_approved_at, verification_rejected_reason,
        user:user_id ( id, full_name, phone )
      `)
      .eq('verification_status', 'pending')
      .order('verification_submitted_at', { ascending: true }),

    admin
      .from('dalali_profiles')
      .select(`
        user_id, nida_number, nida_image_front, nida_image_back, selfie_image,
        business_license_url,
        verification_status, verification_submitted_at, verification_approved_at, verification_rejected_reason,
        user:user_id ( id, full_name, phone )
      `)
      .eq('verification_status', 'approved')
      .order('verification_approved_at', { ascending: false })
      .limit(100),

    admin
      .from('subscriptions')
      .select('id, dalali_id, status, is_trial, trial_ends_at, trial_converted_at')
      .eq('is_trial', true),

    admin
      .from('reports')
      .select(`
        id, reason, details, status, created_at,
        reporter:reporter_id ( id, full_name ),
        dalali:reported_dalali_id ( id, full_name, email,
          dalali_profiles ( whatsapp_number )
        ),
        listing:listing_id ( id, title, type, district )
      `)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const allAdminListings     = (allListingsRes.data ?? []) as unknown as AdminListing[]
  const pendingListings      = (pendingListingsRes.data ?? []) as unknown as AdminListing[]
  const pendingVerifications = (verificationRes.data ?? []) as unknown as AdminVerification[]
  const verifiedDalalis      = (verifiedDalalisRes.data ?? []) as unknown as AdminVerification[]
  const trialSubs            = (trialSubsRes?.data ?? []) as { id: string; status: string; trial_converted_at: string | null }[]
  const reports              = (reportsRes?.data ?? []) as unknown[]

  const clientCount  = clientCountRes.count  ?? 0
  const dalaliCount  = dalaliCountRes.count  ?? 0
  const totalUsers   = totalUsersCountRes.count ?? 0

  const regionStats: [string, number][] = Object.entries(
    allAdminListings
      .filter(l => l.status === 'active')
      .reduce<Record<string, number>>((acc, l) => {
        if (l.region) acc[l.region] = (acc[l.region] ?? 0) + 1
        return acc
      }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 10)

  return {
    pendingListings,
    allListings:        allAdminListings,
    pendingVerifications,
    verifiedDalalis,
    reports,
    regionStats,
    stats: {
      pendingCount:    pendingListingsCountRes.count ?? 0,
      activeCount:     activeListingsCountRes.count ?? 0,
      takenCount:      takenListingsCountRes.count ?? 0,
      rejectedCount:   rejectedListingsCountRes.count ?? 0,
      expiredCount:    expiredListingsCountRes.count ?? 0,
      totalListings:   totalListingsCountRes.count ?? 0,
      totalUsers,
      clientCount,
      dalaliCount,
      activeTrials:    trialSubs.filter(t => t.status === 'active').length,
      expiredTrials:   trialSubs.filter(t => t.status === 'trial_expired').length,
      convertedTrials: trialSubs.filter(t => t.trial_converted_at).length,
      totalTrials:     trialSubs.length,
    },
  }
}
