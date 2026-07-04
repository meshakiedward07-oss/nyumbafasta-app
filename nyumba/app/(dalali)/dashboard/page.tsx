import { createClient, createAdminClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dalali/DashboardClient'
import type { Listing } from '@/lib/types/database'

export default async function DalaliDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  // Fetch in parallel
  const [userRes, profileRes, subscriptionRes, listingsRes, leadsRes] = await Promise.all([
    supabase.from('users').select('full_name, phone').eq('id', user!.id).single(),

    admin.from('dalali_profiles')
      .select('whatsapp_number, bio, rating_avg, rating_count, is_premium_verified, verification_status, verification_rejected_reason')
      .eq('user_id', user!.id)
      .maybeSingle(),

    supabase.from('subscriptions')
      .select('plan, status, expires_at, grace_period_until, is_trial, trial_ends_at')
      .eq('dalali_id', user!.id)
      .in('status', ['active', 'grace_period', 'trial_expired'])
      .order('expires_at', { ascending: false })
      .maybeSingle(),

    supabase.from('listings')
      .select('id, title, type, status, price_monthly, district, region, images, view_count, lead_count, created_at, is_boosted')
      .eq('dalali_id', user!.id)
      .order('created_at', { ascending: false }),

    supabase.from('contact_unlocks')
      .select('id', { count: 'exact', head: true })
      .eq('dalali_id', user!.id)
      .eq('status', 'completed'),
  ])

  const dalaliUser = userRes.data
  const dalaliProfile = profileRes.data
  const subscription = subscriptionRes.data
  const listings = (listingsRes.data as Listing[]) ?? []
  const totalLeads = leadsRes.count ?? 0

  // Compute stats from listings
  const totalViews = listings.reduce((sum, l) => sum + (l.view_count ?? 0), 0)
  const activeCount = listings.filter(l => l.status === 'active').length
  const pendingCount = listings.filter(l => l.status === 'pending').length

  return (
    <DashboardClient
      dalaliName={dalaliUser?.full_name ?? 'Dalali'}
      profile={dalaliProfile}
      subscription={subscription}
      listings={listings}
      stats={{ totalViews, totalLeads, activeCount, pendingCount, totalListings: listings.length }}
    />
  )
}
