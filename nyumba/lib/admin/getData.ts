import { createAdminClient } from '@/lib/supabase/server'
import type {
  AdminListing, AdminUser, AdminUnlock, AdminSubscription,
  AdminVerification, AdminDalaliDetailed, AdminClientDetailed,
} from '@/app/(admin)/admin/page'

export type AdminPageData = {
  pendingListings: AdminListing[]
  allListings: AdminListing[]
  users: AdminUser[]
  unlocks: AdminUnlock[]
  subscriptions: AdminSubscription[]
  pendingVerifications: AdminVerification[]
  madalaliDetailed: AdminDalaliDetailed[]
  watejaDetailed: AdminClientDetailed[]
  savedListings: { client_id: string }[]
  reports: unknown[]
  regionStats: [string, number][]
  stats: {
    pendingCount: number
    activeCount: number
    totalListings: number
    totalUsers: number
    clientCount: number
    dalaliCount: number
    verifiedCount: number
    premiumCount: number
    totalUnlockRevenue: number
    totalSubRevenue: number
    totalBoostRevenue: number
    totalRevenue: number
    unlocksCount: number
    activeBoostsCount: number
    activeTrials: number
    expiredTrials: number
    convertedTrials: number
    totalTrials: number
  }
}

export async function getAdminData(): Promise<AdminPageData> {
  const admin = createAdminClient()

  const [
    pendingListingsRes,
    allListingsRes,
    usersRes,
    unlocksRes,
    subscriptionsRes,
    verificationRes,
    madalaliRes,
    watejaRes,
    savedListingsRes,
    boostPaymentsRes,
    trialSubsRes,
    reportsRes,
  ] = await Promise.all([
    admin
      .from('listings')
      .select(`
        id, title, type, status, price_monthly,
        district, region, furnished, amenities,
        images, description, bedrooms, created_at,
        dalali:dalali_id (
          id, full_name, phone,
          dalali_profiles ( whatsapp_number, is_premium_verified )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(300),

    admin.from('listings').select('status'),

    admin
      .from('users')
      .select('id, full_name, phone, role, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    admin
      .from('contact_unlocks')
      .select('id, amount_paid, created_at, listing_id, client_id')
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),

    admin
      .from('subscriptions')
      .select('id, plan, status, expires_at, dalali_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    admin
      .from('dalali_profiles')
      .select(`
        user_id, nida_number, nida_image_front, nida_image_back, selfie_image,
        verification_status, verification_submitted_at, verification_rejected_reason,
        user:user_id ( id, full_name, phone )
      `)
      .eq('verification_status', 'pending')
      .order('verification_submitted_at', { ascending: true }),

    admin
      .from('users')
      .select(`
        id, full_name, email, phone, avatar_url, created_at, is_active,
        dalali_profiles ( whatsapp_number, verification_status, is_premium_verified, rating_avg ),
        subscriptions ( plan, status, expires_at )
      `)
      .eq('role', 'dalali')
      .order('created_at', { ascending: false }),

    admin
      .from('users')
      .select('id, full_name, email, phone, avatar_url, created_at, is_active')
      .eq('role', 'client')
      .order('created_at', { ascending: false }),

    admin.from('saved_listings').select('client_id'),

    admin
      .from('boost_payments')
      .select('id, amount, weeks, status, boosted_from, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(200),

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
      .limit(200),
  ])

  const allAdminListings   = (pendingListingsRes.data ?? []) as unknown as AdminListing[]
  const pendingListings    = allAdminListings.filter(l => l.status === 'pending')
  const allListings        = allListingsRes.data ?? []
  const users              = (usersRes.data ?? []) as AdminUser[]
  const unlocks            = (unlocksRes.data ?? []) as AdminUnlock[]
  const subscriptions      = (subscriptionsRes.data ?? []) as AdminSubscription[]
  const pendingVerifications = (verificationRes.data ?? []) as unknown as AdminVerification[]
  const madalaliDetailed   = (madalaliRes.data ?? []) as unknown as AdminDalaliDetailed[]
  const watejaDetailed     = (watejaRes.data ?? []) as unknown as AdminClientDetailed[]
  const savedListings      = (savedListingsRes.data ?? []) as { client_id: string }[]
  const boostPayments      = (boostPaymentsRes.data ?? []) as { id: string; amount: number }[]
  const trialSubs          = (trialSubsRes?.data ?? []) as { id: string; status: string; trial_converted_at: string | null }[]
  const reports            = (reportsRes?.data ?? []) as unknown[]

  const regionStats: [string, number][] = Object.entries(
    allAdminListings
      .filter(l => l.status === 'active')
      .reduce<Record<string, number>>((acc, l) => {
        if (l.region) acc[l.region] = (acc[l.region] ?? 0) + 1
        return acc
      }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const statusCounts = allListings.reduce<Record<string, number>>((acc, l) => {
    acc[(l as { status: string }).status] = (acc[(l as { status: string }).status] ?? 0) + 1
    return acc
  }, {})

  const totalUnlockRevenue = unlocks.reduce((sum, u) => sum + (u.amount_paid ?? 0), 0)
  const totalSubRevenue    = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.plan === 'premium' ? 25_000 : 10_000), 0)
  const totalBoostRevenue  = boostPayments.reduce((sum, b) => sum + (b.amount ?? 0), 0)
  const clientCount        = users.filter(u => u.role === 'client').length
  const dalaliCount        = users.filter(u => u.role === 'dalali').length
  const verifiedCount      = madalaliDetailed.filter(d =>
    (d.dalali_profiles as { verification_status?: string } | null)?.verification_status === 'approved'
  ).length
  const premiumCount       = madalaliDetailed.filter(d =>
    (d.dalali_profiles as { is_premium_verified?: boolean } | null)?.is_premium_verified === true
  ).length

  return {
    pendingListings,
    allListings:        allAdminListings,
    users,
    unlocks,
    subscriptions,
    pendingVerifications,
    madalaliDetailed,
    watejaDetailed,
    savedListings,
    reports,
    regionStats,
    stats: {
      pendingCount:       pendingListings.length,
      activeCount:        statusCounts['active'] ?? 0,
      totalListings:      allListings.length,
      totalUsers:         users.length,
      clientCount,
      dalaliCount,
      verifiedCount,
      premiumCount,
      totalUnlockRevenue,
      totalSubRevenue,
      totalBoostRevenue,
      totalRevenue:       totalUnlockRevenue + totalSubRevenue + totalBoostRevenue,
      unlocksCount:       unlocks.length,
      activeBoostsCount:  allAdminListings.filter(l => l.is_boosted).length,
      activeTrials:       trialSubs.filter(t => t.status === 'active').length,
      expiredTrials:      trialSubs.filter(t => t.status === 'trial_expired').length,
      convertedTrials:    trialSubs.filter(t => t.trial_converted_at).length,
      totalTrials:        trialSubs.length,
    },
  }
}
