import { createAdminClient } from '@/lib/supabase/server'
import AdminDashboard from '@/components/admin/AdminDashboard'

export default async function AdminPage() {
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
    // All listings — full detail (pending first, then newest)
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

    // Listing counts by status
    admin
      .from('listings')
      .select('status'),

    // All users (basic — for overview stats)
    admin
      .from('users')
      .select('id, full_name, phone, role, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    // Completed unlocks — includes client_id for per-client counts
    admin
      .from('contact_unlocks')
      .select('id, amount_paid, created_at, listing_id, client_id')
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),

    // Active subscriptions — for revenue
    admin
      .from('subscriptions')
      .select('id, plan, status, expires_at, dalali_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100),

    // Pending verification requests
    admin
      .from('dalali_profiles')
      .select(`
        user_id, nida_number, nida_image_front, nida_image_back, selfie_image,
        verification_status, verification_submitted_at, verification_rejected_reason,
        user:user_id ( id, full_name, phone )
      `)
      .eq('verification_status', 'pending')
      .order('verification_submitted_at', { ascending: true }),

    // Madalali — detailed with profiles + subscriptions
    admin
      .from('users')
      .select(`
        id, full_name, email, phone, avatar_url, created_at, is_active,
        dalali_profiles ( whatsapp_number, verification_status, is_premium_verified, rating_avg ),
        subscriptions ( plan, status, expires_at )
      `)
      .eq('role', 'dalali')
      .order('created_at', { ascending: false }),

    // Wateja — detailed
    admin
      .from('users')
      .select('id, full_name, email, phone, avatar_url, created_at, is_active')
      .eq('role', 'client')
      .order('created_at', { ascending: false }),

    // Saved listings — for per-client counts
    admin
      .from('saved_listings')
      .select('client_id'),

    // Boost payments — for revenue stats
    admin
      .from('boost_payments')
      .select('id, amount, weeks, status, boosted_from, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(200),

    // Trial subscriptions — for trial stats
    admin
      .from('subscriptions')
      .select('id, dalali_id, status, is_trial, trial_ends_at, trial_converted_at')
      .eq('is_trial', true),

    // Reports — scam reports
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

  const allAdminListings = (pendingListingsRes.data ?? []) as unknown as AdminListing[]
  const pendingListings   = allAdminListings.filter(l => l.status === 'pending')
  const allListings       = allListingsRes.data ?? []
  const users             = usersRes.data ?? []
  const unlocks           = (unlocksRes.data ?? []) as AdminUnlock[]
  const subscriptions     = subscriptionsRes.data ?? []
  const pendingVerifications = (verificationRes.data ?? []) as unknown as AdminVerification[]
  const madalali          = (madalaliRes.data ?? []) as unknown as AdminDalaliDetailed[]
  const wateja            = (watejaRes.data ?? []) as unknown as AdminClientDetailed[]
  const savedListings     = (savedListingsRes.data ?? []) as { client_id: string }[]
  const boostPayments     = (boostPaymentsRes.data ?? []) as { id: string; amount: number; weeks: number; created_at: string }[]
  const trialSubs         = (trialSubsRes?.data ?? []) as { id: string; status: string; trial_converted_at: string | null }[]
  const reports           = (reportsRes?.data ?? []) as unknown as Parameters<typeof AdminDashboard>[0]['reports']

  // Region stats — count active listings per region
  const regionStats = allAdminListings
    .filter(l => l.status === 'active')
    .reduce<Record<string, number>>((acc, l) => {
      if (l.region) acc[l.region] = (acc[l.region] ?? 0) + 1
      return acc
    }, {})
  const regionStatsSorted = Object.entries(regionStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Trial stats
  const activeTrials     = trialSubs.filter(t => t.status === 'active').length
  const expiredTrials    = trialSubs.filter(t => t.status === 'trial_expired').length
  const convertedTrials  = trialSubs.filter(t => t.trial_converted_at).length
  const totalTrials      = trialSubs.length

  // Stats
  const statusCounts = allListings.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1
    return acc
  }, {})

  const totalUnlockRevenue = unlocks.reduce((sum, u) => sum + (u.amount_paid ?? 0), 0)
  const totalSubRevenue = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.plan === 'premium' ? 25_000 : 10_000), 0)
  const totalBoostRevenue = boostPayments.reduce((sum, b) => sum + (b.amount ?? 0), 0)
  const activeBoostsCount = allAdminListings.filter(l => l.is_boosted).length

  const clientCount  = users.filter(u => u.role === 'client').length
  const dalaliCount  = users.filter(u => u.role === 'dalali').length
  const verifiedCount = madalali.filter(d =>
    (d.dalali_profiles as { verification_status?: string } | null)?.verification_status === 'approved'
  ).length
  const premiumCount = madalali.filter(d =>
    (d.dalali_profiles as { is_premium_verified?: boolean } | null)?.is_premium_verified === true
  ).length

  return (
    <AdminDashboard
      pendingListings={pendingListings}
      allListings={allAdminListings}
      users={users as AdminUser[]}
      unlocks={unlocks}
      subscriptions={subscriptions as AdminSubscription[]}
      pendingVerifications={pendingVerifications}
      madalaliDetailed={madalali}
      watejaDetailed={wateja}
      savedListings={savedListings}
      reports={reports}
      regionStats={regionStatsSorted}
      stats={{
        pendingCount: pendingListings.length,
        activeCount: statusCounts['active'] ?? 0,
        totalListings: allListings.length,
        totalUsers: users.length,
        clientCount,
        dalaliCount,
        verifiedCount,
        premiumCount,
        totalUnlockRevenue,
        totalSubRevenue,
        totalBoostRevenue,
        totalRevenue: totalUnlockRevenue + totalSubRevenue + totalBoostRevenue,
        unlocksCount: unlocks.length,
        activeBoostsCount,
        activeTrials,
        expiredTrials,
        convertedTrials,
        totalTrials,
      }}
    />
  )
}

// ── Types ─────────────────────────────────────────────────

export type AdminListing = {
  id: string
  title: string
  type: string
  status: string
  price_monthly: number
  district: string
  region: string
  furnished: string
  amenities: string[]
  images: string[]
  description: string | null
  bedrooms: number | null
  created_at: string
  is_boosted?: boolean
  dalali: {
    id: string
    full_name: string
    phone: string | null
    dalali_profiles: { whatsapp_number: string; is_premium_verified: boolean } | null
  } | null
}

export type AdminUser = {
  id: string
  full_name: string
  phone: string | null
  role: string
  created_at: string
}

export type AdminUnlock = {
  id: string
  amount_paid: number
  created_at: string
  listing_id: string
  client_id: string | null
}

export type AdminSubscription = {
  id: string
  plan: string
  status: string
  expires_at: string
  dalali_id: string
  created_at: string
}

export type AdminVerification = {
  user_id: string
  nida_number: string | null
  nida_image_front: string | null
  nida_image_back: string | null
  selfie_image: string | null
  verification_status: string
  verification_submitted_at: string | null
  verification_rejected_reason: string | null
  user: { id: string; full_name: string; phone: string | null } | null
}

export type AdminDalaliDetailed = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  is_active: boolean | null
  dalali_profiles: {
    whatsapp_number: string | null
    verification_status: string | null
    is_premium_verified: boolean
    rating_avg: number | null
  } | null
  subscriptions: { plan: string; status: string; expires_at: string | null }[]
}

export type AdminClientDetailed = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  is_active: boolean | null
}
