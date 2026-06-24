import { createAdminClient } from '@/lib/supabase/server'
import type {
  AdminListing,
  AdminVerification,
} from '@/app/(admin)/admin/page'

export type AdminPageData = {
  pendingListings: AdminListing[]
  allListings: AdminListing[]
  pendingVerifications: AdminVerification[]
  reports: unknown[]
  regionStats: [string, number][]
  stats: {
    pendingCount: number
    activeCount: number
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

  const [
    pendingListingsRes,
    allListingsRes,
    clientCountRes,
    dalaliCountRes,
    totalUsersCountRes,
    verificationRes,
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

    admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'dalali'),
    admin.from('users').select('*', { count: 'exact', head: true }),

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

  const allAdminListings     = (pendingListingsRes.data ?? []) as unknown as AdminListing[]
  const pendingListings      = allAdminListings.filter(l => l.status === 'pending')
  const allListings          = allListingsRes.data ?? []
  const pendingVerifications = (verificationRes.data ?? []) as unknown as AdminVerification[]
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

  const statusCounts = allListings.reduce<Record<string, number>>((acc, l) => {
    acc[(l as { status: string }).status] = (acc[(l as { status: string }).status] ?? 0) + 1
    return acc
  }, {})

  return {
    pendingListings,
    allListings:        allAdminListings,
    pendingVerifications,
    reports,
    regionStats,
    stats: {
      pendingCount:    pendingListings.length,
      activeCount:     statusCounts['active'] ?? 0,
      totalListings:   allListings.length,
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
